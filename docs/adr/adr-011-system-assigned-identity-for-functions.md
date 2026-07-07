# ADR-011: Functions には System-Assigned Managed Identity を採用

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

Functions では Blob / Queue / Table へアクセスするため、接続文字列ではなく Managed Identity を用いる構成にしている。

## 決定

- Functions: System-Assigned Managed Identity
- APIM: User-Assigned Managed Identity

## 実装状況

- [infra/module/functions.bicep](../../infra/module/functions.bicep): 2 つの Function App に `SystemAssigned` を設定
- [infra/module/identity.bicep](../../infra/module/identity.bicep): APIM 用 User-Assigned Identity を定義
- [infra/module/rbac.bicep](../../infra/module/rbac.bicep): Functions の principalId に Storage RBAC を付与
- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): `DefaultAzureCredential` を使用

## 実装との差分

| 項目 | 実装 |
|------|------|
| Functions Identity | System-Assigned |
| APIM Identity | User-Assigned |
| Storage アクセス | Managed Identity + RBAC |

## 影響

- Storage へのアクセスは接続文字列不要になる。
- 監査ログ処理の運用が安全かつ管理しやすい。
