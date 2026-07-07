# ADR-006: HTTP Trigger に API Key 認証を追加

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

Azure Functions の HTTP Trigger は `authLevel: 'anonymous'` で公開されるため、APIM 以外からの直接アクセスを防ぐ必要があった。

## 決定

`x-api-key` ヘッダーで共有キー認証を行う。

## 実装状況

- [log-http/src/functions/httpTrigger.ts](../../log-http/src/functions/httpTrigger.ts): `x-api-key` を `AUDIT_API_KEY` と比較
- [infra/module/functions.bicep](../../infra/module/functions.bicep): Function App に `AUDIT_API_KEY` を設定
- [infra/policies/apim-policy.xml](../../infra/policies/apim-policy.xml): APIM から送信時に `x-api-key` を付与

## 実装との差分

| 項目 | 実装 |
|------|------|
| 認証方式 | `x-api-key` ヘッダー |
| 採用理由 | Functions の匿名公開を抑止 |
| 管理方法 | App Settings で保持 |

## 影響

- APIM からの送信のみが有効になる。
- 直接アクセスは 401 で拒否される。
