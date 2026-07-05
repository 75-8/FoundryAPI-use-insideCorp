# ADR-002: 監査ログに upn・tenantId フィールドを追加

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §5, §6) では、APIM 取得項目および JSON フォーマットに以下の 12 フィールドを定義している:

```
timestamp, requestId, oid, applicationId, subscriptionId,
deployment, model, promptTokens, completionTokens, totalTokens,
responseTimeMs, statusCode
```

監査ログとして利用者を特定する際、OID だけでは人物の判別が困難であり、テナント横断のシナリオでは tenantId も必要になる。

## 決定

仕様の 12 フィールドに加え、**upn** (User Principal Name) と **tenantId** を任意フィールドとして追加する。

### 実装箇所

- [auditLog.ts](log-http/src/types/auditLog.ts#L26-L29): `AuditLogRecord` に `upn`, `tenantId` を定義
- [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L115-L116): 受信時に `body.upn ?? ''`, `body.tenantId ?? ''` で取得
- [apim-policy.xml](infra/policies/apim-policy.xml#L101-L117): JWT から `upn` (fallback: `preferred_username`) および `tid` を取得

### バリデーション

`REQUIRED_AUDIT_FIELDS` には含めず、任意フィールドとして扱う（未送信でも 400 エラーにならない）。

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| upn | なし | 任意フィールドとして追加 |
| tenantId | なし | 任意フィールドとして追加 |

## 理由

- 監査対応時に OID だけでは利用者の特定が困難
- `upn` があれば人間が読める形で利用者を識別可能
- マルチテナント環境を想定し `tenantId` も取得

## Spec 更新の必要性

§5 の APIM 取得項目表および §6 の JSON フォーマットに `upn` (任意) と `tenantId` (任意) を追記すべき。
