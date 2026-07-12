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
import type { BlockBlobClient } from '@azure/storage-blob';
import type { LogRecord } from './logRecord.js';
/**
 * LogRecord 配列を Parquet ファイルに変換し、そのバッファを返す。
 *
 * @param records 変換対象の LogRecord 配列
 * @returns Parquet ファイルの Buffer
 */
export declare function convertToParquetBuffer(records: LogRecord[]): Promise<Buffer>;
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
export declare function uploadParquetToArchive(blockBlobClient: BlockBlobClient, parquetBuffer: Buffer): Promise<void>;
