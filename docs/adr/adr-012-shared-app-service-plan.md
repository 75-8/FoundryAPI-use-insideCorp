# ADR-012: HTTP / Batch Function App が App Service Plan を共有

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §11 保守性) では以下を記述:

> Functions は以下 2 プロジェクトへ分離する。
> ```
> log-http/
> log-batch/
> ```
> 責務分離を徹底する。

プロジェクト（コードベース）の分離は明記されているが、App Service Plan の共有/分離については言及がない。

## 決定

2 つの Function App（`func-http-*` / `func-batch-*`）は **単一の Consumption App Service Plan** を共有する。

### 実装箇所

- [functions.bicep](infra/module/functions.bicep#L11-L21): `asp-${basename}` (Y1 Dynamic) を 1 つ定義
- [functions.bicep](infra/module/functions.bicep#L32): HTTP: `serverFarmId: asp.id`
- [functions.bicep](infra/module/functions.bicep#L73): Batch: `serverFarmId: asp.id`

### コードベースの分離

| 項目 | 実装 |
|------|------|
| `log-http/` | ✅ 独立プロジェクト |
| `log-batch/` | ✅ 独立プロジェクト |
| App Service Plan | 共有 |

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| プロジェクト分離 | ✅ | ✅ |
| App Service Plan | 未指定 | 共有 (1 つの Y1 Plan) |

## 理由

- Consumption Plan (Y1) はリソース共有がなく課金単位が実行ベースのため、Plan 共有によるパフォーマンス干渉はない
- 管理リソース数を削減
- コスト最適化 (§12) の方針に合致

## Spec 更新の必要性

軽微。§11 保守性に「App Service Plan は共有とする」旨を追記してもよい。
