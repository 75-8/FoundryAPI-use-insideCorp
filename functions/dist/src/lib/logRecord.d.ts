/**
 * LogRecord 型定義 (§10)
 *
 * schemaVersion を必須フィールドとし、Analytics JSON / Archive Parquet /
 * Poison Blob の rawMessage にも一貫して含める (§10 Schema Versioning方針)。
 */
/** 現在のスキーマバージョン */
export declare const CURRENT_SCHEMA_VERSION = "1.0";
/** 利用者識別情報 (§9) */
export interface LogRecordIdentity {
    /** oid → sub (§9) */
    subjectId: string;
    /** tid (§9) */
    tenantId: string;
    /** upn → preferred_username (§9) */
    userPrincipalName: string;
    /** appid → azp (§9) */
    appId: string;
}
/**
 * ログレコード (§10)
 *
 * APIM Diagnostic Settings から取得した通信メタデータを正規化した構造。
 * Request Body / Response Body / Authorization Header / JWT / Cookie は保存しない (§8)。
 */
export interface LogRecord {
    schemaVersion: string;
    shareId: string;
    eventTime: string;
    httpMethod: string;
    routePath: string;
    apiName: string;
    operationName: string;
    statusCode: number | null;
    latencyMs: number | null;
    clientIp: string;
    identity: LogRecordIdentity;
    source: string;
}
/**
 * Poison Blob レコード (§15)
 */
export interface PoisonBlobRecord {
    errorTime: string;
    retryCount: number;
    functionName: string;
    exceptionType: string;
    errorMessage: string;
    stackTrace: string;
    rawMessage: unknown;
}
/**
 * カーソル状態 (§11 カーソル管理)
 */
export interface CursorState {
    /** 処理済みバイトオフセット */
    offset: number;
    /** 最終更新日時 (ISO 8601) */
    lastUpdated: string;
}
/**
 * Log Analytics Custom Table 送信用レコード (§19)
 *
 * LogRecord を Log Analytics Custom Table のスキーマにマッピングする。
 */
export interface LogAnalyticsRecord {
    TimeGenerated: string;
    SchemaVersion: string;
    ShareId: string;
    SubjectId: string;
    TenantId: string;
    UserPrincipalName: string;
    AppId: string;
    ApiName: string;
    OperationName: string;
    Method: string;
    Route: string;
    StatusCode: number | null;
    LatencyMs: number | null;
    ClientIp: string;
    Source: string;
    CreatedAt: string;
}
/**
 * LogRecord → Log Analytics Custom Table レコードへの変換
 */
export declare function toLogAnalyticsRecord(record: LogRecord): LogAnalyticsRecord;
