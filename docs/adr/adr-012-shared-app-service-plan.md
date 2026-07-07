# ADR-012: HTTP / Batch Function App は App Service Plan を共有

## ステータス

Implemented

## 日付

2026-07-08

## コンテキスト

コードベースは `log-http/` と `log-batch/` に分かれているが、実装では両方の Function App が同じ Consumption Plan を使う構成になっている。

## 決定

`func-http-*` と `func-batch-*` は単一の Consumption App Service Plan を共有する。

## 実装状況

- [infra/module/functions.bicep](../../infra/module/functions.bicep): `asp-${basename}` を 1 つ定義
- [infra/module/functions.bicep](../../infra/module/functions.bicep): 両 Function App が同じ `serverFarmId` を参照

## 実装との差分

| 項目 | 実装 |
|------|------|
| コードベース分離 | 維持 |
| App Service Plan | 共有 |

## 影響

- 管理対象リソース数を減らせる。
- 実行単位ベースの課金に合わせた構成になっている。
