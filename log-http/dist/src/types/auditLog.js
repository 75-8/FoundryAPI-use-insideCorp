"use strict";
/**
 * 型宣言ファイル: 監査ログ HTTP トリガー
 *
 * 仕様書 spec.md に基づき以下の要件を満たす型を定義する。
 *   AU-002: 利用者識別 (oid, upn, tenantId, requestId, timestamp)
 *   AU-003: LLM利用量 (promptTokens, completionTokens, totalTokens, model, deployment)
 *   可観測性: requestId, oid, model, token, responseTimeMs, statusCode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_AUDIT_FIELDS = void 0;
// ---------------------------------------------------------------------------
// 必須フィールド定義 (バリデーションに使用)
// ---------------------------------------------------------------------------
/** バリデーション必須フィールドの一覧 */
exports.REQUIRED_AUDIT_FIELDS = [
    'timestamp',
    'requestId',
    'oid',
    'promptTokens',
    'completionTokens',
    'totalTokens',
    'responseTimeMs',
    'statusCode',
];
//# sourceMappingURL=auditLog.js.map