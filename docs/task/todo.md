# 監査ログ基盤 設計判断・設定事項整理タスク (TODO)

本ドキュメントは、[docs/adr/](docs/adr/) 配下の各アーキテクチャ意思決定レコード（[ADR-001](docs/adr/adr-001-log-analytics-replaced-by-application-insights.md) ～ [ADR-012](docs/adr/adr-012-shared-app-service-plan.md)）に基づき、仕様との差分や今後判断・設定すべきタスクを整理したものです。

---

## 1. 判断が必要な事項 (Items requiring Decision)
以下の項目は、ビジネス要件やセキュリティポリシーに基づき、今後の方針決定が必要です。

### 1.1 `archive-log` コンテナの 2 年間保持ポリシーの適用可否
- **関連ADR**: [ADR-004](docs/adr/adr-004-archive-lifecycle-policy-missing.md)
- **概要**: 仕様書ではアーカイブコンテナ内のログは 2 年間（730日）保持と定義されていますが、現時点のインフラ定義では自動削除ポリシーが設定されていません。
- **検討事項**: 法的要件や監査ポリシーに基づき、730日経過後に自動削除を行う Lifecycle Policy を適用するか、それとも手動運用（現状維持）にするかを判断します。

### 1.2 Blob 保存時の Raw パス構造の標準化
- **関連ADR**: [ADR-005](docs/adr/adr-005-blob-path-structure-deviation.md)
- **概要**: 現状の実装では、コンテナ `raw-log` の下に `raw-log/YYYY/MM/DD/{requestId}.json` というプレフィックスで保存されるため、物理的なパスが `raw-log/raw-log/...` と二重になっています。
- **検討事項**: 仕様通りの `raw-log/YYYY/MM/DD/{requestId}.json`（コンテナ直下に日付フォルダを生成）にパス構造を修正するか、現在の二重構造を許容する（仕様書側を更新する）かを判断します。

### 1.3 ネットワークセキュリティ（Private Endpoint）の導入ロードマップ
- **関連ADR**: [ADR-010](docs/adr/adr-010-private-endpoint-not-implemented.md)
- **概要**: 仕様書では Private Endpoint の利用が推奨されていますが、コストや APIM Consumption SKU の制限により、初期構成では VNet なし（IP フィルタ + API Key 認証）となっています。
- **検討事項**: 本番環境など将来的な段階で Private Endpoint（VNet 統合）を導入する具体的なロードマップ、および APIM の SKU アップグレード（Consumption から Basic/Standard 等）の要否を判断します。

---

## 2. 設定・修正が必要な実装タスク (Configuration & Implementation Tasks)
方針決定後に、コード、インフラ定義、スキーマ、およびポリシーに対して実施すべきタスクです。

### 2.1 【重大な不整合】APIM からの HTTP POST への `upn` / `tenantId` フィールド追加
- **関連ADR**: [ADR-002](docs/adr/adr-002-additional-audit-fields-upn-tenantid.md), [ADR-007](docs/adr/adr-007-apim-dual-audit-trace-and-http-post.md)
- **概要**:
  - `httpTrigger.ts` 側では `body.upn` / `body.tenantId` を受信して処理するロジックが存在します。
  - しかし、`apim-policy.xml` の `<send-one-way-request>` （HTTP POST）の Body 定義にはこれらのフィールドが含まれておらず、常に値が欠落（空文字）します。
- **対応タスク**:
  - [apim-policy.xml](infra/policies/apim-policy.xml#L263-L278) の `<set-body>` 部分に `"upn"` と `"tenantId"` (JWT の `tid` クレーム) を追加し、HTTP POST でも送信されるようにします。

### 2.2 【重大な不整合】Parquet スキーマおよびバッチ処理レコードへの `upn` / `tenantId` 追加
- **関連ADR**: [ADR-009](docs/adr/adr-009-parquet-schema-lacks-upn-tenantid.md)
- **概要**:
  - Raw JSON ログには `upn` と `tenantId` が保存されますが、日次バッチ（`timerTrigger.ts`）の Parquet 変換処理でこれらが考慮されていないため、アーカイブ化の際にデータが欠落します。
- **対応タスク**:
  - [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L15-L28) の `AuditLogRecord` インターフェースに `upn: string` と `tenantId: string` を追加。
  - [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L127-L140) の `parquetSchema` に `upn` (UTF8) と `tenantId` (UTF8) のフィールドを定義。
  - `writer.appendRow` の実行時に対象フィールドを出力データにマッピングして書き込みます。

### 2.3 アーカイブ用 Lifecycle Management ポリシーのインフラ定義追加（判断 1.1 に依存）
- **関連ADR**: [ADR-004](docs/adr/adr-004-archive-lifecycle-policy-missing.md)
- **対応タスク**:
  - 自動削除を有効にする場合、[storage.bicep](infra/module/storage.bicep) に `archive-log/` プレフィックスに対する `daysAfterCreationGreaterThan: 730` の Lifecycle Management ルールを追加します。

### 2.4 Raw Blob パス構造の修正（判断 1.2 に依存）
- **関連ADR**: [ADR-005](docs/adr/adr-005-blob-path-structure-deviation.md)
- **対応タスク**:
  - パスを標準化する場合、以下を修正します:
    - [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L147) の `blobName` のプレフィックスから `raw-log/` を削除し、`YYYY/MM/DD/{requestId}.json` とします（コンテナ `raw-log` の下に直接日付フォルダ階層を作成）。
    - [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts) のプレフィックスパース処理で、`raw-log` コンテナ内のパス解析ロジックを調整します。

---

## 3. 仕様書 (`spec.md`) の改訂タスク
各 ADR において「Spec 更新の必要性」が示されているため、[spec.md](docs/spec/spec.md) を以下の内容に改訂する必要があります。

| 仕様書章番号 | 改訂対象項目 | 改訂内容 | 関連ADR |
| :--- | :--- | :--- | :--- |
| **§4.1 API実行** | 監査ログの出力先 | APIM ポリシーが HTTP Trigger への POST に加え、Application Insights への直接 `<trace>` 送信も行う二重記録（耐障害性向上）の記述を追加。 | [ADR-007](docs/adr/adr-007-apim-dual-audit-trace-and-http-post.md) |
| **§4.2 HTTP Trigger** | 書き込み先・テーブル | Log Analytics への直接書き込みから、Application Insights SDK (`trackTrace`) を利用した `AppTraces` テーブル経由での記録に変更された旨を明記。 | [ADR-001](docs/adr/adr-001-log-analytics-replaced-by-application-insights.md) |
| **§4.3 日次バッチ** | 処理対象範囲 | 前日分だけでなく、「未処理の全日付を対象として日付グループごとに処理する（自動復旧）」旨を追記。 | [ADR-008](docs/adr/adr-008-timer-trigger-processes-all-dates.md) |
| **§5 APIM取得項目** | 収集フィールド | 任意フィールドとして `upn` および `tenantId` を項目表に追加。 | [ADR-002](docs/adr/adr-002-additional-audit-fields-upn-tenantid.md) |
| **§6 JSONフォーマット** | スキーマ定義 | `upn` (任意) および `tenantId` (任意) をスキーマに追加。 | [ADR-002](docs/adr/adr-002-additional-audit-fields-upn-tenantid.md) |
| **§7 Blob Storage設計** | パス・ファイル名と保持期間 | Raw ログのファイル名が `{requestId}.json` となることを明記。また、アーカイブの保持ポリシー（2年）について判断 1.1 の結果を反映。 | [ADR-004](docs/adr/adr-004-archive-lifecycle-policy-missing.md), [ADR-005](docs/adr/adr-005-blob-path-structure-deviation.md) |
| **§8 Log Analytics** | データ保持期間 | コスト最適化のため、推奨 365 日から「30 日（既定）」に変更。 | [ADR-003](docs/adr/adr-003-log-analytics-retention-30-days.md) |
| **§10 Azure Functions** | 認証とセキュリティ | HTTP Trigger の責務に「API Key (`x-api-key`) 認証」を追加。 | [ADR-006](docs/adr/adr-006-api-key-authentication-added.md) |
| **§11 非機能要件** | セキュリティ・接続方式 | - Managed Identity の使い分け（Functions: System-Assigned, APIM: User-Assigned）を記載。<br>- ストレージ接続文字列を排除し、環境変数 `AzureWebJobsStorage__accountName` を利用する旨を明記。<br>- Private Endpoint は「段階的導入（初期は IP フィルタ＋API Key で代替）」に修正。 | [ADR-010](docs/adr/adr-010-private-endpoint-not-implemented.md), [ADR-011](docs/adr/adr-011-system-assigned-identity-for-functions.md), [ADR-012](docs/adr/adr-012-shared-app-service-plan.md) |

---

## 4. ADR一覧と影響コンポーネントのマッピング

| ADR ID | タイトル | 主な影響先ファイル / Bicep / XML |
| :--- | :--- | :--- |
| **[ADR-001](docs/adr/adr-001-log-analytics-replaced-by-application-insights.md)** | Log Analytics 直接書き込みを Application Insights に変更 | [httpTrigger.ts](log-http/src/functions/httpTrigger.ts), [monitoring.bicep](infra/module/monitoring.bicep), [workbook.bicep](infra/module/workbook.bicep) |
| **[ADR-002](docs/adr/adr-002-additional-audit-fields-upn-tenantid.md)** | 監査ログに upn・tenantId フィールドを追加 | [auditLog.ts](log-http/src/types/auditLog.ts), [httpTrigger.ts](log-http/src/functions/httpTrigger.ts), [apim-policy.xml](infra/policies/apim-policy.xml) |
| **[ADR-003](docs/adr/adr-003-log-analytics-retention-30-days.md)** | Log Analytics 保持期間を 365 日ではなく 30 日に設定 | [monitoring.bicep](infra/module/monitoring.bicep) |
| **[ADR-004](docs/adr/adr-004-archive-lifecycle-policy-missing.md)** | Archive コンテナの 2 年間保持ポリシーが未実装 | [storage.bicep](infra/module/storage.bicep) |
| **[ADR-005](docs/adr/adr-005-blob-path-structure-deviation.md)** | Blob パス構造の仕様差分 | [httpTrigger.ts](log-http/src/functions/httpTrigger.ts), [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts) |
| **[ADR-006](docs/adr/adr-006-api-key-authentication-added.md)** | HTTP Trigger に API Key 認証を追加 | [httpTrigger.ts](log-http/src/functions/httpTrigger.ts), [main.bicep](infra/main.bicep), [functions.bicep](infra/module/functions.bicep), [apim-policy.xml](infra/policies/apim-policy.xml) |
| **[ADR-007](docs/adr/adr-007-apim-dual-audit-trace-and-http-post.md)** | APIM ポリシーでの二重監査ログ出力 | [apim-policy.xml](infra/policies/apim-policy.xml) |
| **[ADR-008](docs/adr/adr-008-timer-trigger-processes-all-dates.md)** | Timer Trigger が全日付の Raw ログを処理 | [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts) |
| **[ADR-009](docs/adr/adr-009-parquet-schema-lacks-upn-tenantid.md)** | Parquet スキーマに upn・tenantId が未定義 | [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts) （不整合対応タスクが必要） |
| **[ADR-010](docs/adr/adr-010-private-endpoint-not-implemented.md)** | Private Endpoint が未実装 | [main.bicep](infra/main.bicep), [storage.bicep](infra/module/storage.bicep), [functions.bicep](infra/module/functions.bicep), [apim.bicep](infra/module/apim.bicep) |
| **[ADR-011](docs/adr/adr-011-system-assigned-identity-for-functions.md)** | Functions に System-Assigned Managed Identity を採用 | [functions.bicep](infra/module/functions.bicep), [identity.bicep](infra/module/identity.bicep), [rbac.bicep](infra/module/rbac.bicep), [httpTrigger.ts](log-http/src/functions/httpTrigger.ts) |
| **[ADR-012](docs/adr/adr-012-shared-app-service-plan.md)** | HTTP / Batch Function App が App Service Plan を共有 | [functions.bicep](infra/module/functions.bicep) |
