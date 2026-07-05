# ADR-001: Log Analytics 直接書き込みを Application Insights に変更

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §4.2) では、HTTP Trigger が受信した JSON を **Blob Storage (Raw)** と **Log Analytics** へ同時書き込みすると定義している。

しかし、Log Analytics への直接書き込み（Data Collector API / Logs Ingestion API）は以下の課題がある:

- Data Collector API（旧）は廃止予定
- Logs Ingestion API は Data Collection Rule (DCR) + Data Collection Endpoint (DCE) の追加インフラが必要
- カスタムテーブル管理の運用負荷

## 決定

Log Analytics への直接書き込みを行わず、**Application Insights SDK (`applicationinsights`)** の `trackTrace` を利用して **AppTraces テーブル** にログを記録する。

### 実装箇所

- [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L129-L137): `appInsights.defaultClient.trackTrace()` で JSON を送信
- [monitoring.bicep](infra/module/monitoring.bicep): Application Insights を Log Analytics Workspace に接続
- [workbook.bicep](infra/module/workbook.bicep): KQL で `AppTraces | extend msg = parse_json(message)` を使用

### APIM ポリシー側の二重記録

- [apim-policy.xml](infra/policies/apim-policy.xml#L231-L249): APIM outbound の `<trace>` ディレクティブでも同一データを Application Insights に記録（仕様書にない追加の可観測性強化）

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| 書き込み先 | Log Analytics (直接) | Application Insights (AppTraces) |
| API | 未指定 | `applicationinsights` npm SDK `trackTrace` |
| テーブル | カスタムテーブル (想定) | AppTraces (組み込み) |
| インフラ | DCR/DCE が必要 (暗黙) | App Insights のみ |

## 影響

- Workbook の KQL クエリは `AppTraces` テーブルを前提とした実装となっている
- Log Analytics Workspace へのデータ連携は Application Insights 経由で自動的に行われるため、仕様書の意図（検索・可視化・監査対応）は満たされる

## Spec 更新の必要性

§4.2 および §8 の記述を Application Insights 経由に修正すべき。
