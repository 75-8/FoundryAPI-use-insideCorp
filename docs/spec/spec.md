# 要件仕様書
## Azure AI Coding Agent Platform

## 1. 目的

社内利用向けのAIコーディングエージェント実行基盤をAzure上に構築する。

本システムは認証・認可、監査、コスト可視化を実現しながら、Azure AI Foundry上のLLMを安全に利用できる構成とする。

---

# 2. 前提条件

|項目|内容|
|----|----|
|Cloud|Microsoft Azure|
|対象LLM|Azure AI Foundry Model Deployment|
|Coding Agent|Codex等|
|認証|Microsoft Entra ID(Azure cliによるtoken取得)|
|IaC|Bicep|
|権限|Subscription Ownerのみ（Tenant Administrator権限なし）|
|デプロイ方法|Azure CLI + Bicep|

Tenantレベルの設定変更を必要とする構成は採用しない。

---

# 3. システム構成

`./docs/spec/diagram.md`を参照

---

# 4. 機能要件

## FR-001 API受付

APIMが全APIエンドポイントとなること。

Foundryへの直接アクセスは禁止する。

---

## FR-002 認証

APIMはMicrosoft Entra IDが払い出したBearer Tokenを受け付ける。

Bearer Tokenの検証はAPIM Policyで実施する。

---

## FR-003 認可

Bearer Tokenからoid(Object ID)を取得する。

許可されたoidのみAPI利用可能とする。

アクセス制御はAPIM Policyで実施する。

audience(aud)による制限は行わない。

---

## FR-004 Foundry接続

APIMからAzure AI Foundryへの接続はManaged Identityを利用する。
CodexはFoundry projectにあるprojectエンドポイントは利用できないため、AOAIのエンドポイントを使用する。
API Keyは利用しない。

Managed Identityには必要最小限のRBACのみ付与する。

---

## FR-005 応答

Foundryから返却されたレスポンスをAPIM経由で利用者へ返却する。

APIMはレスポンス本文を書き換えない。

---

# 5. 監査要件

## AU-001 ログ保存

APIMのDiagnostic Settingsを有効化する。

保存先は以下とする。

- Log Analytics（主）
- Application Insights（副）

---

## AU-002 利用者識別

Bearer Tokenより取得したoidをログへ記録する。

可能な限り以下も取得する。

- oid
- upn
- tenant id
- request id
- timestamp

---

## AU-003 LLM利用量

Foundry利用時の以下を記録する。

- Prompt Tokens
- Completion Tokens
- Total Tokens
- Model Name
- Deployment Name

---

## AU-004 コスト分析

ユーザー単位で以下を確認できること。

- 利用回数
- Token消費量
- 推定利用料金
- モデル別利用量

---

## AU-005 可視化

Log AnalyticsをデータソースとしてAzure WorkbookまたはDashboardを構築する。

最低限以下を表示する。

- ユーザー別Token消費量
- 日別利用量
- モデル別利用量
- 推定コスト
- エラー率
- API呼び出し数

---

# 6. セキュリティ要件

## SEC-001

Azure Foundry account は Managed Identity のみ許可する。

---

## SEC-002

APIM以外からFoundryを利用しない構成とする。

---

## SEC-003

Foundry は API Keyを利用せず無効にする。

---

## SEC-004

APIMはoidによるアクセス制御を実施する。

---

## SEC-005

認証情報をIaCへハードコードしない。

---

# 7. APIM Policy

Policyは以下ファイルで管理する。

`./infra/policies/apim-policy.xml`


Policyには最低限以下を実装する。

- JWT検証
- oid取得
- oid許可判定
- Managed IdentityによるFoundry認証
- ログ出力用変数設定
- エラーハンドリング

---

# 8. IaC要件

IaCはBicepのみ利用する。
デプロイにはPowerShellを使用する。

Portal手順に依存しない。

デプロイ対象例

- Resource Group
- API Management
- Azure AI Foundry
- Model Deployment
- Managed Identity
- Log Analytics
- Application Insights
- Workbook
- Diagnostic Settings
- RBAC

---

# 9. 品質要件

Bicepは以下を満たすこと。

```
az bicep lint
```

エラーなし

```
az bicep build
```

エラーなし

警告は原則ゼロを目標とする。

---

# 10. 運用要件

デプロイはAzure CLIから実行できること。

環境差異はParameter Fileで吸収する。

少なくとも以下環境へ対応する。

- dev
- test
- prod

---

# 11. 非機能要件

## 可用性

Azureマネージドサービスを利用する。

---

## 保守性

Bicep Moduleへ分割する。

責務を明確にする。

---

## 可観測性

すべてのAPI要求について以下が追跡可能であること。

- Request ID
- oid
- モデル
- Token利用量
- レスポンス時間
- HTTP Status

---

