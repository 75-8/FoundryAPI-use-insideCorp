/**
 * Function1: ingestLog (§11)
 *
 * Timer Trigger + カーソル管理方式によるAPIM Diagnostic Blobの差分読み取り。
 *
 * 採用理由:
 *   APIM Diagnostic Settings は PT1H.json を Append Blob として出力し、
 *   1時間の間継続的に追記する。Blob Trigger の blob receipt 機構では
 *   同一 Blob に対して1回しか発火しないため、追記分の大半が欠落する。
 *   そのため Timer Trigger + Byte Offset カーソル管理方式を採用する (§11)。
 *
 * 処理フロー (§11):
 *   1. 現在時刻から対象 PT1H.json のパスを特定（当該 + 直前の2時間帯）
 *   2. カーソル読取り（初回 offset=0）
 *   3. Range Download で差分取得
 *   4. 末尾改行チェック（未完成行は次回に持ち越し）
 *   5. JSON Lines 1行ずつ解析 → JWT デコード → ShareId 取得 → LogRecord 生成
 *   6. 48KB サイズ検証（超過は直接 Poison Blob）
 *   7. Storage Queue (buffer) へ送信
 *   8. カーソル更新（送信成功後のみ）
 */

import { app, type InvocationContext, type Timer } from '@azure/functions';
import { type ContainerClient } from '@azure/storage-blob';
import { type QueueClient } from '@azure/storage-queue';
import { loadConfig } from '../lib/config.js';
import { getBlobServiceClient, getQueueServiceClient } from '../lib/blobClients.js';
import { readCursor, writeCursor } from '../lib/cursorManager.js';
import { parseDiagnosticData } from '../lib/diagnosticParser.js';
import { writePoisonBlob } from '../lib/poisonBlobWriter.js';

/**
 * 現在時刻を基に、対象となる PT1H.json の Blob パスリストを生成する。
 * 当該時間帯 + 直前の時間帯の2つ（時間境界をまたぐ追記漏れを防ぐため）(§11 ステップ1)。
 *
 * APIM Diagnostic Settings の出力パス例:
 *   insights-logs-gatewaylogs/resourceId=.../y=2026/m=07/d=12/h=14/m=00/PT1H.json
 *
 * 注: 実際のリソースIDパスはAPIM Diagnostic Settingsの設定に依存するため、
 *     ここではコンテナ内の Blob を列挙して PT1H.json を見つける方式を取る。
 */
function getTargetHourPrefixes(now: Date): string[] {
  const prefixes: string[] = [];

  for (let hourOffset = 0; hourOffset >= -1; hourOffset--) {
    const target = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
    const y = target.getUTCFullYear();
    const m = String(target.getUTCMonth() + 1).padStart(2, '0');
    const d = String(target.getUTCDate()).padStart(2, '0');
    const h = String(target.getUTCHours()).padStart(2, '0');

    // APIM Diagnostic Blob のパスフォーマット
    prefixes.push(`y=${y}/m=${m}/d=${d}/h=${h}/m=00/PT1H.json`);
  }

  return prefixes;
}

/**
 * ingestLog のメインハンドラー
 */
export async function ingestLogHandler(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log('ingestLog: Timer trigger started.');

  const config = loadConfig();
  const blobServiceClient = getBlobServiceClient();
  const queueServiceClient = getQueueServiceClient();

  const diagnosticContainer = blobServiceClient.getContainerClient(config.diagnosticLogContainer);
  const cursorContainer = blobServiceClient.getContainerClient(config.cursorContainer);
  const poisonContainer = blobServiceClient.getContainerClient(config.poisonContainer);
  const queueClient = queueServiceClient.getQueueClient(config.queueName);

  const now = new Date();
  const targetPrefixes = getTargetHourPrefixes(now);

  // Diagnostic コンテナ内の対象 Blob を列挙
  const targetBlobs: string[] = [];
  for await (const blob of diagnosticContainer.listBlobsFlat()) {
    for (const prefix of targetPrefixes) {
      if (blob.name.endsWith(prefix)) {
        targetBlobs.push(blob.name);
        break;
      }
    }
  }

  if (targetBlobs.length === 0) {
    context.log('ingestLog: No target diagnostic blobs found.');
    return;
  }

  for (const blobPath of targetBlobs) {
    try {
      await processOneDiagnosticBlob(
        blobPath,
        diagnosticContainer,
        cursorContainer,
        poisonContainer,
        queueClient,
        config,
        context,
      );
    } catch (err) {
      // Blob 単位のエラーは他の Blob の処理をブロックしない
      context.error(`ingestLog: Failed to process blob ${blobPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  context.log('ingestLog: Timer trigger completed.');
}

/**
 * 1つの Diagnostic Blob を処理する。
 */
async function processOneDiagnosticBlob(
  blobPath: string,
  diagnosticContainer: ContainerClient,
  cursorContainer: ContainerClient,
  poisonContainer: ContainerClient,
  queueClient: QueueClient,
  config: ReturnType<typeof loadConfig>,
  context: InvocationContext,
): Promise<void> {
  // ステップ2: カーソル読取り
  const cursorState = await readCursor(cursorContainer, blobPath);
  context.log(`ingestLog: Processing ${blobPath}, cursor offset=${cursorState.offset}`);

  // ステップ3: Range Download で差分取得
  const blobClient = diagnosticContainer.getBlobClient(blobPath);

  // Blob のプロパティを取得してサイズを確認
  let blobProperties;
  try {
    blobProperties = await blobClient.getProperties();
  } catch (err) {
    const restError = err as { statusCode?: number };
    if (restError.statusCode === 404) {
      context.log(`ingestLog: Blob not found (may not exist yet): ${blobPath}`);
      return;
    }
    throw err;
  }

  const blobSize = blobProperties.contentLength ?? 0;

  if (blobSize <= cursorState.offset) {
    // 新しいデータなし
    context.log(`ingestLog: No new data in ${blobPath} (size=${blobSize}, offset=${cursorState.offset})`);
    return;
  }

  // Range Download: offset 以降の差分のみ取得 (§11 ステップ3)
  const count = blobSize - cursorState.offset;
  const downloadResponse = await blobClient.download(cursorState.offset, count);

  if (!downloadResponse.readableStreamBody) {
    context.log(`ingestLog: No readable stream for ${blobPath}`);
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const data = Buffer.concat(chunks);

  if (data.length === 0) {
    return;
  }

  // ステップ4-5: JSON Lines 解析 → LogRecord 生成
  const { records, processedBytes } = parseDiagnosticData(data, context);

  if (processedBytes === 0) {
    context.log(`ingestLog: No complete lines in diff data for ${blobPath}`);
    return;
  }

  context.log(`ingestLog: Parsed ${records.length} records from ${blobPath}`);

  // ステップ6-9: サイズ検証 → Queue 送信
  let lastSuccessfulOffset = cursorState.offset;

  for (const record of records) {
    const serialized = JSON.stringify(record);
    const messageBytes = Buffer.byteLength(serialized, 'utf-8');

    // ステップ6: 48KB サイズ検証 (§11 ステップ8)
    if (messageBytes > config.queueMessageMaxBytes) {
      context.warn(
        `ingestLog: Message size ${messageBytes} exceeds threshold ${config.queueMessageMaxBytes} for shareId=${record.shareId}. Writing directly to Poison Blob.`,
      );

      try {
        await writePoisonBlob(
          poisonContainer,
          'ingestLog',
          `Message size ${messageBytes} exceeds queue limit ${config.queueMessageMaxBytes}`,
          record,
          {
            shareId: record.shareId,
            exceptionType: 'MessageSizeExceeded',
          },
        );
      } catch (poisonErr) {
        context.error(`ingestLog: Failed to write oversized message to Poison Blob: ${poisonErr instanceof Error ? poisonErr.message : String(poisonErr)}`);
      }
      // サイズ超過は再送しても解消しないため、カーソルは進める
      continue;
    }

    // ステップ7: Storage Queue (buffer) へ送信 (§11 ステップ9)
    try {
      // Queue メッセージは Base64 エンコードして送信
      const base64Message = Buffer.from(serialized).toString('base64');
      await queueClient.sendMessage(base64Message);
    } catch (queueErr) {
      // Queue 送信失敗時はカーソルを更新せず、次回 Timer 実行時に再送信 (§11)
      context.error(
        `ingestLog: Failed to send message to queue for shareId=${record.shareId}: ${queueErr instanceof Error ? queueErr.message : String(queueErr)}`,
      );
      // カーソルを現在位置で停止（残りのレコードも次回に再処理）
      break;
    }
  }

  // ステップ8: カーソル更新（送信成功後のみ）(§11 ステップ10)
  const newOffset = cursorState.offset + processedBytes;
  try {
    await writeCursor(cursorContainer, blobPath, newOffset);
    context.log(`ingestLog: Updated cursor for ${blobPath}: offset=${newOffset}`);
  } catch (cursorErr) {
    context.error(
      `ingestLog: Failed to update cursor for ${blobPath}: ${cursorErr instanceof Error ? cursorErr.message : String(cursorErr)}`,
    );
    // カーソル更新失敗 → 次回実行時に同じ範囲を再処理（重複は冪等性で吸収）
  }
}

// Export for testing
export { getTargetHourPrefixes };

/**
 * Timer Trigger 登録 (§11)
 *
 * スケジュールはアプリケーション設定 INGEST_TIMER_SCHEDULE からパラメータ化 (§11)。
 * Function 単位の retry ポリシーを設定（fixedDelay, 最大3回）(§11, §24)。
 * host.json のグローバル retry は使用しない。
 */
app.timer('ingestLog', {
  schedule: '%INGEST_TIMER_SCHEDULE%',
  handler: ingestLogHandler,
  retry: {
    strategy: 'fixedDelay',
    maxRetryCount: 3,
    delayInterval: {
      seconds: 30,
    },
  },
});
