# ADR-003: Log Analytics 保持期間を 30 日に設定

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

実装コードでは Log Analytics Workspace の保持期間が 30 日に設定されている。長期保存は Blob Archive の Parquet で扱う構成に合わせた値である。

## 決定

Log Analytics Workspace の `retentionInDays` を 30 日にする。

## 実装状況

- [infra/module/monitoring.bicep](../../infra/module/monitoring.bicep): `retentionInDays: 30`

## 実装との差分

| 項目 | 実装 |
|------|------|
| 保持期間 | 30 日 |
| 長期保存 | Blob Archive (Parquet) で対応 |

## 影響

- 直近 30 日のログは即時検索しやすい。
- 30 日超過データはアーカイブ側で保持する前提になる。
