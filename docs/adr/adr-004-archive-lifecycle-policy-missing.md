# ADR-004: Archive コンテナの保持ポリシーは未実装

## ステータス

Implemented (partial)

## 日付

2026-07-08

## コンテキスト

実装コードでは `raw-log` に対してのみ 7 日の Lifecycle Management ルールが設定されている。`archive-log` には保持期間ルールが追加されていない。

## 決定

`archive-log` の自動削除ルールは現時点では実装しない。`raw-log` だけを 7 日で削除する。

## 実装状況

- [infra/module/storage.bicep](../../infra/module/storage.bicep): `raw-log/` に対する 7 日削除ルールを定義

## 実装との差分

| 項目 | 実装 |
|------|------|
| `raw-log` 保持期間 | 7 日で削除 |
| `archive-log` 保持期間 | 未設定 |

## 影響

- 監査証跡の誤削除リスクを避けるため、`archive-log` は現状無期限保持になる。
- 2 年間の自動削除は今後の追加実装対象である。
