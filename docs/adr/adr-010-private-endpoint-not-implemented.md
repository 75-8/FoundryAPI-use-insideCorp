# ADR-010: Private Endpoint が未実装

## ステータス

Accepted (未実装を認識)

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §11 セキュリティ) では以下を記述:

> 通信は Private Endpoint を推奨

しかし、現在のインフラ定義には VNet、Private Endpoint、Private DNS Zone のいずれも含まれていない。

## 決定

初期デプロイでは Private Endpoint を **未実装** とする。

### 実装箇所

- [main.bicep](infra/main.bicep): VNet / Private Endpoint 関連リソースなし
- [storage.bicep](infra/module/storage.bicep): Public アクセス制御のみ (`allowBlobPublicAccess: false`)
- [functions.bicep](infra/module/functions.bicep): VNet 統合なし
- [apim.bicep](infra/module/apim.bicep): APIM Consumption SKU (VNet 統合の制限あり)

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| Private Endpoint | 推奨 | 未実装 |
| VNet 統合 | 暗黙的に推奨 | なし |

## 理由

- APIM Consumption SKU は VNet 統合に制限がある
- Functions Consumption Plan の VNet 統合は追加コストが発生
- 初期デプロイではパブリックアクセス + API Key 認証で運用開始
- IP フィルタリングは APIM ポリシーで実装済み

## 代替措置

- APIM ポリシーで IP CIDR フィルタリングを実装 ([apim-policy.xml](infra/policies/apim-policy.xml#L30-L71))
- HTTP Trigger への API Key 認証 (ADR-006)
- Storage Account は `allowBlobPublicAccess: false` で公開アクセスを無効化

## Spec 更新の必要性

§11 に「初期デプロイでは IP フィルタリング + API Key 認証で代替。Private Endpoint は本番環境移行時に導入」と段階的なセキュリティ強化方針を明記すべき。
