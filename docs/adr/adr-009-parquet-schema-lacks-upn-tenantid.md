# ADR-009: Parquet スキーマに upn・tenantId は未反映

## ステータス

Implemented (partial)

## 日付

2026-07-08

## コンテキスト

HTTP Trigger では `upn` と `tenantId` を JSON に保存しているが、Batch 側の Parquet スキーマにはまだ反映されていない。

## 決定

現時点では Parquet 変換時に `upn` / `tenantId` を出力しない。Raw JSON と Archive のスキーマに差がある。

## 実装状況

- [log-batch/src/functions/timerTrigger.ts](../../log-batch/src/functions/timerTrigger.ts): Parquet スキーマに `upn` / `tenantId` を含めていない

## 実装との差分

| 項目 | 実装 |
|------|------|
| Raw JSON | `upn` / `tenantId` を保持 |
| Parquet | `upn` / `tenantId` を未出力 |

## 影響

- Archive では利用者情報が欠落する。
- 仕様上は `upn` / `tenantId` を残したい場合、Parquet スキーマの拡張が必要。
