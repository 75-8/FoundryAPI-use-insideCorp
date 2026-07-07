# ADR-008: Timer Trigger は未処理の全日付をまとめて処理する

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

バッチ処理は毎日 00:00 に実行されるが、実装では `raw-log` 配下の全 `.json` を列挙して日付ごとにまとめて処理する。

## 決定

Timer Trigger は前日だけに限定せず、未処理の全日付を対象にして Parquet 変換・アーカイブ・削除を行う。

## 実装状況

- [log-batch/src/functions/timerTrigger.ts](../../log-batch/src/functions/timerTrigger.ts): `listBlobsFlat()` で全 blob を列挙
- [log-batch/src/functions/timerTrigger.ts](../../log-batch/src/functions/timerTrigger.ts): パスから日付を抽出してグルーピング

## 実装との差分

| 項目 | 実装 |
|------|------|
| 処理対象 | `raw-log` 内の全日付 |
| 障害時の挙動 | 未処理データを再処理可能 |
| 削除タイミング | アーカイブ成功後に Raw を削除 |

## 影響

- 障害復旧性が高い。
- 同じ日付が複数回処理されると、既存 Parquet が上書きされる可能性がある。
