# ADR-010: Private Endpoint は初期実装に含めない

## ステータス

Implemented (partial)

## 日付

2026-07-08

## コンテキスト

インフラ定義には VNet / Private Endpoint / Private DNS Zone が含まれておらず、初期実装では Public リクエスト経路を前提にしている。

## 決定

Private Endpoint は未実装のまま、初期段階では API Key と APIM ポリシーでアクセス制御する。

## 実装状況

- [infra/module/storage.bicep](../../infra/module/storage.bicep): `allowBlobPublicAccess: false` で公開アクセスを無効化
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): IP 制限を実装
- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): API Key 認証を実装

## 実装との差分

| 項目 | 実装 |
|------|------|
| Private Endpoint | 未実装 |
| 代替セキュリティ | API Key / IP 制限 |

## 影響

- 初期構成では Public エンドポイント経由の運用になる。
- 将来的に Private Endpoint を追加する余地がある。
