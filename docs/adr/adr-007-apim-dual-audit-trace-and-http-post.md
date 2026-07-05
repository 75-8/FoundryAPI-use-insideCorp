# ADR-007: APIM ポリシーでの二重監査ログ出力

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §4.1) では、APIM の責務は以下の通り:

1. APIM Policy で監査情報生成
2. Azure Functions HTTP Trigger へ POST

つまり、APIM は監査データを **HTTP Trigger に POST する** のみと定義されている。

## 決定

実装では、APIM outbound ポリシーで **2 つの経路** で監査データを出力する:

1. **`<trace>` ディレクティブ** → Application Insights に直接記録
2. **`<send-one-way-request>`** → HTTP Trigger へ POST

### 実装箇所

- [apim-policy.xml](infra/policies/apim-policy.xml#L231-L249): `<trace source="ai-agent-audit">` で Application Insights に直接出力
- [apim-policy.xml](infra/policies/apim-policy.xml#L254-L279): `<send-one-way-request>` で HTTP Trigger に POST
- [apim-policy.xml](infra/policies/apim-policy.xml#L289-L345): on-error セクションでもエラーログを trace + HTTP POST

### trace に含まれる追加フィールド

APIM trace 出力には HTTP POST にはないフィールドが含まれる:

| フィールド | trace | HTTP POST |
|-----------|-------|-----------|
| event | ✅ (`"llm-api-call"`) | ❌ |
| upn | ✅ | ❌ (HTTP Trigger 側で受け取らない) |
| tenantId | ✅ | ❌ (HTTP Trigger 側で受け取らない) |
| httpStatus | ✅ | statusCode として ✅ |
| durationMs | ✅ | responseTimeMs として ✅ |

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| APIM → App Insights 直接記録 | なし | `<trace>` で直接記録 |
| APIM → HTTP Trigger POST | あり | ✅ `<send-one-way-request>` |
| on-error 時のログ出力 | なし | trace + HTTP POST |

## 理由

- HTTP Trigger が障害の場合でも、APIM trace 経由で最低限の監査証跡を確保
- 可観測性の向上（APIM 側でのリアルタイム監視が可能）
- ベストエフォートの監査ログ方針 (§11) に合致

## Spec 更新の必要性

§4.1 に「APIM は Application Insights にも trace を出力し、二重記録による耐障害性を確保する」旨を追記すべき。
