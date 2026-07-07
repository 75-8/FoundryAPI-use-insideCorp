# ADR-007: APIM は trace と HTTP POST の両方で監査ログを送る

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

APIM のポリシーでは、監査データを Functions へ送るだけでなく、Application Insights へも直接出力する構成になっている。これにより、HTTP Trigger の障害時でも最低限の証跡を残せる。

## 決定

APIM outbound ポリシーでは以下の 2 つを並行して行う。

1. `<trace>` で Application Insights に記録する。
2. `<send-one-way-request>` で HTTP Trigger に POST する。

## 実装状況

- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): `<trace>` で Application Insights へ出力
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): `<send-one-way-request>` で Functions へ POST
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): エラー時も trace + POST を行う

## 実装との差分

| 項目 | 実装 |
|------|------|
| APIM → App Insights | 直接記録 |
| APIM → HTTP Trigger | POST で送信 |
| on-error | trace + POST で出力 |

## 影響

- 監査トレースの可観測性が高い。
- HTTP Trigger が落ちても APIM 側のログは残る。
