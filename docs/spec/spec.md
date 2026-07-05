# Azure OpenAI 利用監査ログ基盤 仕様書

## 1. 目的

Azure API Management(APIM)経由でAzure AI FoundryのLLMを利用する際の監査ログを取得し、利用状況の可視化および長期証跡保管を実現する。

Event Hubsを利用する一般的な構成ではなく、Azure Functionsを利用することで構成を簡素化し、運用コストを削減する。

---

# 2. システム構成

`./docs/spec/diagram.md`を参照

---

# 3. コンポーネント一覧

|サービス|用途|
|---------|----|
|Azure API Management|認証・利用者識別・監査情報取得|
|Azure AI Foundry|LLM実行|
|Azure Functions (HTTP)|監査ログ受信|
|Azure Functions (Timer)|JSON→Parquet変換|
|Blob Storage|JSON一時保存・Archive保管|
|Log Analytics|検索・可視化|
|Azure Workbook|利用分析ダッシュボード|

---

# 4. データフロー

## 4.1 API実行

1. 利用者がAPIMへアクセス
2. APIMでEntra ID認証
3. oid取得
4. Foundryへ転送
5. Foundryレスポンス取得
6. APIM Policyで監査情報生成
7. Azure Functions HTTP TriggerへPOST

---

## 4.2 HTTP Trigger

受信したJSONを

- Blob Storage(Raw)
- Log Analytics

へ同時書き込みする。

レスポンスはHTTP200を返却する。

---

## 4.3 日次バッチ

毎日00:00(JST)

Timer Triggerが起動

↓

Blob内JSONを取得

↓

Parquetへ変換

↓

Archive Containerへ保存

↓

JSON削除

---

# 5. APIM取得項目

|項目|説明|
|----|----|
|Timestamp|UTC|
|RequestId|APIM Request ID|
|OID|Entra Object ID|
|ApplicationId|Client ID|
|Subscription ID|APIM Subscription|
|Model|利用モデル|
|Deployment|Foundry Deployment|
|Prompt Tokens|入力Token|
|Completion Tokens|出力Token|
|Total Tokens|総Token|
|Status Code|HTTP Status|
|Response Time|応答時間(ms)|

---

# 6. JSONフォーマット

```json
{
  "timestamp": "",
  "requestId": "",
  "oid": "",
  "applicationId": "",
  "subscriptionId": "",
  "deployment": "",
  "model": "",
  "promptTokens": 0,
  "completionTokens": 0,
  "totalTokens": 0,
  "responseTimeMs": 0,
  "statusCode": 200
}
```

---

# 7. Blob Storage設計

## Container

```
raw-log
archive-log
```

### Raw(JSON)

```
raw-log/
    2026/
        07/
            01/
                xxxx.json
```

保持期間

7日

Lifecycle Managementにより自動削除。

---

### Archive

```
archive-log/
    year=2026/
        month=07/
            day=01/
                audit.parquet
```

保持期間

2年間

オンデマンド分析時のみ利用する。

---

# 8. Log Analytics

用途

- 利用者検索
- Token集計
- ダッシュボード
- 監査対応

保持期間

365日（推奨）

それ以降はBlob Archiveを利用する。

---

# 9. Azure Workbook

可視化内容

- 日次Token利用量
- ユーザー別利用量
- モデル別利用量
- エラー率
- レスポンス時間
- Top利用者

---

# 10. Azure Functions設計

## HTTP Trigger

Runtime

- Node.js 22
- TypeScript

責務

- JSONバリデーション
- Blob保存
- Log Analytics送信
- エラーログ

ビジネスロジックは持たない。

---

## Timer Trigger

スケジュール

```
0 0 0 * * *
```

責務

- JSON取得
- JSON結合
- Parquet生成
- Archive保存
- Raw削除

---

# 11. 非機能要件

## 可用性

Azure Functions Consumption

Blob Storage LRS

監査ログはベストエフォートとする。

---

## セキュリティ

Managed Identity利用

Storage Keyは利用しない。

通信はPrivate Endpointを推奨。

---

## 保守性

Functionsは以下2プロジェクトへ分離する。

```
log-http/

log-batch/
```

責務分離を徹底する。

---

# 12. コスト最適化

Event Hubsを利用しない。

JSONを即時Parquet化しない。

日次バッチにまとめることで

- Storage Transaction
- Functions実行回数
- CPU利用時間

を最小化する。

想定ログ件数（1万件/日未満）ではConsumption Planで十分運用可能である。

---

# 13. 採用理由

## Event Hubs採用時

- Namespace管理
- Throughput Unit
- Capture
- Functions Trigger

が必要となる。

監査ログ規模ではオーバースペックである。

## 本構成

HTTP Triggerのみで受信し、

Blobをキュー代替として利用することで

十分な耐障害性と低コストを実現する。

年間運用コストを抑えつつ、監査証跡として必要な保存要件（2年間）を満たす。
