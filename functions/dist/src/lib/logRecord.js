"use strict";
/**
 * LogRecord 型定義 (§10)
 *
 * schemaVersion を必須フィールドとし、Analytics JSON / Archive Parquet /
 * Poison Blob の rawMessage にも一貫して含める (§10 Schema Versioning方針)。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_SCHEMA_VERSION = void 0;
exports.toLogAnalyticsRecord = toLogAnalyticsRecord;
/** 現在のスキーマバージョン */
exports.CURRENT_SCHEMA_VERSION = '1.0';
/**
 * LogRecord → Log Analytics Custom Table レコードへの変換
 */
function toLogAnalyticsRecord(record) {
    return {
        TimeGenerated: record.eventTime,
        SchemaVersion: record.schemaVersion,
        ShareId: record.shareId,
        SubjectId: record.identity.subjectId,
        TenantId: record.identity.tenantId,
        UserPrincipalName: record.identity.userPrincipalName,
        AppId: record.identity.appId,
        ApiName: record.apiName,
        OperationName: record.operationName,
        Method: record.httpMethod,
        Route: record.routePath,
        StatusCode: record.statusCode,
        LatencyMs: record.latencyMs,
        ClientIp: record.clientIp,
        Source: record.source,
        CreatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=logRecord.js.map