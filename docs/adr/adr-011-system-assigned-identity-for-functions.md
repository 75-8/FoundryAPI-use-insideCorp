# ADR-011: Functions に System-Assigned Managed Identity を採用

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §11) では以下を記述:

> Managed Identity 利用
> Storage Key は利用しない

Managed Identity の種別（System-Assigned / User-Assigned）は指定されていない。

## 決定

- **Azure Functions**: System-Assigned Managed Identity
- **APIM**: User-Assigned Managed Identity

### 実装箇所

- [functions.bicep](infra/module/functions.bicep#L29): `identity: { type: 'SystemAssigned' }` (HTTP)
- [functions.bicep](infra/module/functions.bicep#L70): `identity: { type: 'SystemAssigned' }` (Batch)
- [identity.bicep](infra/module/identity.bicep): APIM 用 User-Assigned Identity
- [rbac.bicep](infra/module/rbac.bicep): Functions の principalId に Storage Blob Data Owner / Queue / Table ロールを付与
- [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L62): `DefaultAzureCredential` で Managed Identity を利用

### Storage アクセス方式

`AzureWebJobsStorage__accountName` を使用し、接続文字列ではなく Managed Identity 経由でアクセスする構成。

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| Identity 種別 | 未指定 | Functions: System-Assigned, APIM: User-Assigned |
| Storage Key 不使用 | ✅ | ✅ `AzureWebJobsStorage__accountName` 方式 |
| RBAC ロール | 未指定 | Blob Data Owner, Queue Data Contributor, Table Data Contributor |

## 理由

- Functions は個別のアプリごとに自動管理される System-Assigned が適切
- APIM は Foundry への認証で `client-id` 指定が必要なため User-Assigned を採用
- Storage Blob Data Owner は Blob の読み書き削除を網羅するため採用

## Spec 更新の必要性

§11 に Identity 種別の使い分けと RBAC ロール割り当てを明記すべき。
