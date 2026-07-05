# ADR-006: HTTP Trigger に API Key 認証を追加

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §4.1, §10) では、HTTP Trigger の責務として「JSON バリデーション・Blob 保存・Log Analytics 送信・エラーログ」を挙げているが、HTTP Trigger エンドポイント自体の認証メカニズムについては言及していない。

Azure Functions の `authLevel: 'anonymous'` では、エンドポイント URL を知る任意のクライアントからアクセス可能となるため、APIM 以外からの不正リクエストを排除する仕組みが必要。

## 決定

`x-api-key` ヘッダーによる共有キー認証を追加する。

### 実装箇所

- [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L76-L83): `x-api-key` ヘッダーを `AUDIT_API_KEY` 環境変数と照合
- [main.bicep](infra/main.bicep#L20): `auditApiKey` を `uniqueString` で生成
- [functions.bicep](infra/module/functions.bicep#L56-L59): Function App の `AUDIT_API_KEY` App Setting に設定
- [apim-policy.xml](infra/policies/apim-policy.xml#L260-L262): APIM から送信時に `x-api-key` ヘッダーを付与

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| HTTP Trigger 認証 | 記載なし | `x-api-key` ヘッダー認証 |
| キー管理 | 記載なし | `uniqueString` で生成、App Settings / Named Value で管理 |

## 理由

- `authLevel: 'anonymous'` のため、エンドポイント URL が漏洩した場合のリスク緩和
- APIM → Functions 間の通信を認証付きにすることで、不正な監査ログ投入を防止
- Managed Identity による認証は APIM Consumption SKU の制約で採用困難

## Spec 更新の必要性

§10 の HTTP Trigger 責務に「リクエスト認証 (API Key)」を追記し、§11 セキュリティに APIM-Functions 間認証について明記すべき。
