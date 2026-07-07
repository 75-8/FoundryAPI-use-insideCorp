# ADR-005: Blob パス構造は実装ベースで固定

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

実装コードでは Raw JSON は `raw-log/YYYY/MM/DD/{requestId}.json` という形式で保存される。Archive は Hive パーティション形式の `year=.../month=.../day=.../audit.parquet` で保存される。

## 決定

- Raw ログの Blob 名は `raw-log/YYYY/MM/DD/{requestId}.json` とする。
- Archive ログは `year=YYYY/month=MM/day=DD/audit.parquet` とする。

## 実装状況

- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): Raw Blob 名を組み立てる
- [log-batch/src/functions/timerTrigger.ts](../../log-batch/src/functions/timerTrigger.ts): Archive パスを作る

## 実装との差分

| 項目 | 実装 |
|------|------|
| Raw パス | `raw-log/YYYY/MM/DD/{requestId}.json` |
| Archive パス | `year=YYYY/month=MM/day=DD/audit.parquet` |
| ファイル名 | `{requestId}.json` |

## 影響

- Raw 側はコンテナ名とパスの接頭辞が重なっているが、実装上は問題なく動作する。
- Batch 側はパスから日付を抽出してグルーピングしている。
