# ADR-008: Timer Trigger が全日付の Raw ログを処理

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §4.3) では、日次バッチの処理フローを以下のように記述している:

> 毎日 00:00 (JST) Timer Trigger が起動 → Blob 内 JSON を取得 → Parquet へ変換 → Archive Container へ保存 → JSON 削除

「Blob 内 JSON を取得」の範囲について明確な限定はないが、日次バッチという文脈から **前日分のみ** を処理する想定が自然に読み取れる。

## 決定

Timer Trigger は `raw-log` コンテナ内の **すべての `.json` ファイル** をリストし、日付ごとにグルーピングして処理する。

### 実装箇所

- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L80-L84): `rawContainerClient.listBlobsFlat()` で全 blob を列挙
- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L95-L124): パスから日付を抽出し `dateKey` でグルーピング
- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L143-L222): 日付グループごとに Parquet 変換・アーカイブ・削除

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| 処理対象 | 前日分 (暗黙的) | raw-log 内の全日付 |
| 日付グルーピング | 記載なし | パスから YYYY/MM/DD を抽出してグループ化 |

## 理由

- 障害リカバリ: 前回のバッチが失敗した場合、未処理の過去データも自動的に処理される
- シンプルな実装: 日付フィルタリングのロジックが不要
- `raw-log` の 7 日 Lifecycle Policy により、古いデータは自動削除されるため無限蓄積の懸念なし

## トレードオフ

- 大量のファイルが蓄積した場合、`listBlobsFlat()` の実行時間が長くなる可能性
- 同日に複数回バッチが実行された場合、既にアーカイブ済みの Parquet が上書きされる

## Spec 更新の必要性

§4.3 に「未処理の全日付を対象とし、障害リカバリを自動化する」旨を明記すべき。
