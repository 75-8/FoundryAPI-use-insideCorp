"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToParquetBuffer = convertToParquetBuffer;
exports.uploadParquetToArchive = uploadParquetToArchive;
const parquet = __importStar(require("@dsnp/parquetjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
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
async function convertToParquetBuffer(records) {
    // 一時ファイルに書き出してからバッファとして読み込む
    // （@dsnp/parquetjs はストリームベースの API を提供するが、
    //   メモリ内完結の API がないため一時ファイルを経由する）
    const tempFilePath = path.join(os.tmpdir(), `archive-${Date.now()}-${Math.random().toString(36).substring(2)}.parquet`);
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
    }
    finally {
        // 一時ファイルのクリーンアップ
        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            }
            catch {
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
async function uploadParquetToArchive(blockBlobClient, parquetBuffer) {
    await blockBlobClient.upload(parquetBuffer, parquetBuffer.length, {
        blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
        tier: 'Archive',
    });
}
//# sourceMappingURL=parquetWriter.js.map