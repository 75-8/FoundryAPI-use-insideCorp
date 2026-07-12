/**
 * Function4: archiveDaily (§11, §17)
 *
 * Archive Parquet の日次バッチ生成。
 *
 * 採用理由 (§11):
 *   processQueue 内でメッセージ単位（1リクエスト=1ファイル）に Parquet を生成すると、
 *   Parquet 本来の列指向フォーマットとしての利点が活きず、ファイル数増加による
 *   トランザクションコスト増・ストレージ効率の悪化を招く。
 *   Archive は証跡保管専用でありリアルタイム性を要求しないため、日次バッチ処理へ分離。
 *
 * 処理 (§11):
 *   1. 前日分（UTC 日付）の Analytics JSON を全件列挙・取得
 *   2. 全 LogRecord を1つの Parquet ファイルにまとめる（schemaVersion 列含む）
 *   3. archive/yyyy/MM/dd/{yyyy-MM-dd}.parquet へ Archive Tier で直接アップロード
 *
 * 異常時 (§11):
 *   - Function 単位 retry ポリシー（最大3回）で再試行
 *   - それでも失敗した場合は Poison Blob に記録し、翌日以降のスケジュール実行はブロックしない
 */

import { app, type InvocationContext, type Timer } from '@azure/functions';
import { loadConfig } from '../lib/config.js';
import { getBlobServiceClient } from '../lib/blobClients.js';
import { convertToParquetBuffer, uploadParquetToArchive } from '../lib/parquetWriter.js';
import { writePoisonBlob } from '../lib/poisonBlobWriter.js';
import type { LogRecord } from '../lib/logRecord.js';

/**
 * archiveDaily のメインハンドラー
 */
export async function archiveDailyHandler(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log('archiveDaily: Timer trigger started.');

  const config = loadConfig();
  const blobServiceClient = getBlobServiceClient();
  const analyticsContainer = blobServiceClient.getContainerClient(config.analyticsContainer);
  const archiveContainer = blobServiceClient.getContainerClient(config.archiveContainer);
  const poisonContainer = blobServiceClient.getContainerClient(config.poisonContainer);

  // 前日分（UTC 日付）を対象とする (§11 ステップ1)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const year = yesterday.getUTCFullYear();
  const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const prefix = `${year}/${month}/${day}/`;

  context.log(`archiveDaily: Processing analytics for date ${dateStr} (prefix: ${prefix})`);

  try {
    // ステップ1: 前日分の Analytics JSON を全件列挙・取得
    const records: LogRecord[] = [];

    for await (const blob of analyticsContainer.listBlobsFlat({ prefix })) {
      if (!blob.name.endsWith('.json')) continue;

      try {
        const blobClient = analyticsContainer.getBlobClient(blob.name);
        const downloadResponse = await blobClient.download(0);

        if (!downloadResponse.readableStreamBody) continue;

        const chunks: Buffer[] = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks).toString('utf-8');
        const record = JSON.parse(body) as LogRecord;
        records.push(record);
      } catch (err) {
        context.warn(
          `archiveDaily: Failed to read/parse analytics blob ${blob.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
        // 個別ファイルの読取失敗はスキップし処理を継続
      }
    }

    if (records.length === 0) {
      context.log(`archiveDaily: No analytics records found for ${dateStr}. Skipping.`);
      return;
    }

    context.log(`archiveDaily: Found ${records.length} records for ${dateStr}. Converting to Parquet.`);

    // ステップ2: Parquet 変換（schemaVersion 列含む）(§17)
    const parquetBuffer = await convertToParquetBuffer(records);

    // ステップ3: Archive Tier へ直接アップロード (§17)
    // パス: archive/yyyy/MM/dd/{yyyy-MM-dd}.parquet
    const archiveBlobPath = `${year}/${month}/${day}/${dateStr}.parquet`;
    const archiveBlobClient = archiveContainer.getBlockBlobClient(archiveBlobPath);

    await uploadParquetToArchive(archiveBlobClient, parquetBuffer);

    context.log(`archiveDaily: Parquet uploaded to archive/${archiveBlobPath} (Archive Tier)`);
  } catch (err) {
    // 処理失敗 → Poison Blob に記録 (§11)
    context.error(
      `archiveDaily: Failed to process archive for ${dateStr}: ${err instanceof Error ? err.message : String(err)}`,
    );

    try {
      await writePoisonBlob(
        poisonContainer,
        'archiveDaily',
        `Failed to generate/upload archive Parquet for ${dateStr}: ${err instanceof Error ? err.message : String(err)}`,
        { date: dateStr },
        {
          exceptionType: err instanceof Error ? err.constructor.name : 'Error',
          stackTrace: err instanceof Error ? err.stack ?? '' : '',
        },
      );
      context.log(`archiveDaily: Failure record written to Poison Blob for ${dateStr}`);
    } catch (poisonErr) {
      context.error(
        `archiveDaily: CRITICAL - Failed to write Poison Blob for ${dateStr}: ${poisonErr instanceof Error ? poisonErr.message : String(poisonErr)}`,
      );
    }

    // 翌日以降のスケジュール実行はブロックしない (§11)
    // 例外は再スローしない
  }

  context.log('archiveDaily: Timer trigger completed.');
}

/**
 * Timer Trigger 登録 (§11)
 *
 * スケジュールはアプリケーション設定 ARCHIVE_TIMER_SCHEDULE からパラメータ化。
 * Function 単位の retry ポリシー（最大3回）(§11)。
 * 組み込みシングルトン保証により多重実行は発生しない。
 */
app.timer('archiveDaily', {
  schedule: '%ARCHIVE_TIMER_SCHEDULE%',
  handler: archiveDailyHandler,
  retry: {
    strategy: 'fixedDelay',
    maxRetryCount: 3,
    delayInterval: {
      seconds: 60,
    },
  },
});
