# ADR-002: 監査ログに upn・tenantId フィールドを追加

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

実装コードでは、HTTP Trigger が受信した監査ログに `upn` と `tenantId` を追加して保存している。これらは必須ではなく、未送信時も空文字として扱う。

## 決定

既存の 12 項目に加え、`upn` と `tenantId` を任意フィールドとして保持する。

## 実装状況

- [log-http/src/types/auditLog.ts](../../log-http/src/types/auditLog.ts): `AuditLogRecord` に `upn`, `tenantId` を定義
- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): リクエストボディから `upn` / `tenantId` を取り出して保持
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): JWT の `upn` / `tid` を監査データに反映

## 実装との差分

| 項目 | 実装 |
|------|------|
| upn | 追加済み（任意） |
| tenantId | 追加済み（任意） |
| Parquet への保存 | 現在は未反映（ADR-009 参照） |

## 影響

- Raw JSON には `upn` / `tenantId` が保持される。
- アーカイブ済み Parquet には現在未反映で、データ欠落がある。
