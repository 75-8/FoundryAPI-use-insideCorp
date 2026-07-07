# ADR-001: Log Analytics 直接書き込みを Application Insights へ置き換え

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

実装コードでは、HTTP Trigger が受信した監査ログを Blob 保存と併せて Application Insights の trace として送信する構成になっている。Log Analytics への直接送信は現在の実装には含まれていない。

## 決定

HTTP Trigger は Application Insights SDK の `trackTrace` を使って `AppTraces` にログを記録し、Log Analytics Workspace との連携は Application Insights 側に委譲する。

## 実装状況

- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): `appInsights.defaultClient.trackTrace()` で JSON を送信
- [infra/module/monitoring.bicep](../../infra/module/monitoring.bicep): Application Insights を Log Analytics Workspace に接続
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): APIM outbound の `<trace>` でも同一データを記録する

## 実装との差分

| 項目 | 実装 |
|------|------|
| 書き込み先 | Application Insights (AppTraces) |
| API | `applicationinsights` SDK の `trackTrace` |
| テーブル | AppTraces (組み込み) |
| 追加インフラ | DCR/DCE なしで構成可能 |

## 影響

- Workbook の KQL は `AppTraces` を前提にする。
- 監査ログの検索性は Application Insights / Log Analytics 連携経由で確保される。
