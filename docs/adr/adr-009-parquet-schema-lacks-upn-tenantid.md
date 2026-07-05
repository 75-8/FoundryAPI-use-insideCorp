# ADR-009: Parquet スキーマに upn・tenantId が未定義

## ステータス

Accepted (不整合を認識)

## 日付

2026-07-05

## コンテキスト

ADR-002 で記録した通り、HTTP Trigger は `upn` と `tenantId` を含む JSON を Blob Storage に保存する。

しかし、Timer Trigger の Parquet スキーマおよび `AuditLogRecord` インターフェースにはこれらのフィールドが含まれていない。

## 決定

現時点では Parquet スキーマに `upn` / `tenantId` を **含めない** 実装となっている。

### 実装箇所

- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L15-L28): `AuditLogRecord` に `upn`, `tenantId` なし
- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L127-L140): Parquet スキーマに `upn`, `tenantId` なし

### データフロー上の影響

```
JSON (raw-log) → upn, tenantId あり
    ↓ Timer Trigger
Parquet (archive-log) → upn, tenantId なし ← データ欠落
```

## 内部不整合

| コンポーネント | upn | tenantId |
|---------------|-----|----------|
| APIM trace | ✅ | ✅ |
| HTTP Trigger (JSON保存) | ✅ | ✅ |
| Timer Trigger (Parquet) | ❌ | ❌ |

## 推奨アクション

Timer Trigger の `AuditLogRecord` と Parquet スキーマに `upn` (UTF8) と `tenantId` (UTF8) を追加し、アーカイブデータの完全性を確保すべき。

## Spec 更新の必要性

ADR-002 で `upn` / `tenantId` を Spec に追加する場合、Parquet スキーマの仕様も同時に定義すべき。
