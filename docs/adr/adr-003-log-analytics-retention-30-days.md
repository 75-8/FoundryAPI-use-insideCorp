# ADR-003: Log Analytics 保持期間を 365 日ではなく 30 日に設定

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §8) では、Log Analytics の保持期間を **365 日（推奨）** としている。

しかし、Log Analytics の保持期間はデータ量に比例してコストが増加する。本システムではコスト最適化を重視しており（§12）、長期保存は Blob Archive（Parquet）が担う設計である。

## 決定

Log Analytics Workspace の `retentionInDays` を **30 日** に設定する。

### 実装箇所

- [monitoring.bicep](infra/module/monitoring.bicep#L15): `retentionInDays: 30`

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| Log Analytics 保持期間 | 365 日（推奨） | 30 日 |

## 理由

- コスト最適化 (§12) の方針と整合
- 30 日を超えるデータは Blob Archive (Parquet, 2 年保持) で対応可能
- 必要に応じて `retentionInDays` パラメータを変更可能な設計

## トレードオフ

- 30 日を超えた監査ログの検索には Parquet ファイルのオンデマンド分析が必要
- KQL による即座の検索は直近 30 日に限定される

## Spec 更新の必要性

§8 の保持期間の記述を見直し、「30 日（既定）/ 要件に応じて延長可」と環境パラメータ化を明記すべき。
