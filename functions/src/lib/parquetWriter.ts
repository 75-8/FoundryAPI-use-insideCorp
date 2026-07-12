/**
 * Parquet 変換 (§17)
 *
 * ライブラリ: @dsnp/parquetjs v1.5.0+
 *   - 選定理由: メンテナンスが活発（直近1年以内の更新実績あり）、
 *     Node.js 20 / TypeScript で型定義利用可能、ESM/CJS 双方対応。
 *   - 仕様書 §17 の必須条件をすべて満たす。
 *
 * Archive Tier への直接アップロード (§17):
 *   - BlockBlobClient.upload() (低レベルAPI) に { tier: 'Archive' } を指定。
 *   - uploadData() / uploadFile() / uploadStream() 等の簡易メソッドは
 *     Tier 指定に対応していないため使用しない。
 */

import * as parquet from '@dsnp/parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BlockBlobClient } from '@azure/storage-blob';
import type { LogRecord } from './logRecord.js';

/**
 * Parquet スキーマ定義 (§10 LogRecord + schemaVersion)
 */
const PARQUET_SCHEMA = new parquet.ParquetSchema({
  schemaVersion: { type: 'UTF8' },
  shareId: { type: 'UTF8' },
  eventTime: { type: 'UTF8' },
  httpMethod: { type: 'UTF8' },
  routePath: { type: 'UTF8' },
  apiName: { type: 'UTF8' },
  operationName: { type: 'UTF8' },
  statusCode: { type: 'INT64', optional: true },
  latencyMs: { type: 'INT64', optional: true },
  clientIp: { type: 'UTF8' },
  subjectId: { type: 'UTF8' },
  tenantId: { type: 'UTF8' },
  userPrincipalName: { type: 'UTF8' },
  appId: { type: 'UTF8' },
  source: { type: 'UTF8' },
});

/**
 * LogRecord 配列を Parquet ファイルに変換し、そのバッファを返す。
 *
 * @param records 変換対象の LogRecord 配列
 * @returns Parquet ファイルの Buffer
 */
export async function convertToParquetBuffer(records: LogRecord[]): Promise<Buffer> {
  // 一時ファイルに書き出してからバッファとして読み込む
  // （@dsnp/parquetjs はストリームベースの API を提供するが、
  //   メモリ内完結の API がないため一時ファイルを経由する）
  const tempFilePath = path.join(
    os.tmpdir(),
    `archive-${Date.now()}-${Math.random().toString(36).substring(2)}.parquet`,
  );

  try {
    const writer = await parquet.ParquetWriter.openFile(PARQUET_SCHEMA, tempFilePath);

    for (const record of records) {
      await writer.appendRow({
        schemaVersion: record.schemaVersion,
        shareId: record.shareId,
        eventTime: record.eventTime,
        httpMethod: record.httpMethod,
        routePath: record.routePath,
        apiName: record.apiName,
        operationName: record.operationName,
        statusCode: record.statusCode,
        latencyMs: record.latencyMs,
        clientIp: record.clientIp,
        subjectId: record.identity.subjectId,
        tenantId: record.identity.tenantId,
        userPrincipalName: record.identity.userPrincipalName,
        appId: record.identity.appId,
        source: record.source,
      });
    }

    await writer.close();

    return fs.readFileSync(tempFilePath);
  } finally {
    // 一時ファイルのクリーンアップ
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

/**
 * Parquet バッファを Archive Tier に直接アップロードする (§17)。
 *
 * BlockBlobClient.upload() (低レベルAPI) を使用し、
 * tier: 'Archive' を明示的に指定する。
 * uploadData() / uploadFile() / uploadStream() は Tier 指定に
 * 対応していないため使用しない。
 *
 * @param blockBlobClient アップロード先の BlockBlobClient
 * @param parquetBuffer Parquet ファイルのバッファ
 */
export async function uploadParquetToArchive(
  blockBlobClient: BlockBlobClient,
  parquetBuffer: Buffer,
): Promise<void> {
  await blockBlobClient.upload(parquetBuffer, parquetBuffer.length, {
    blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
    tier: 'Archive',
  });
}
