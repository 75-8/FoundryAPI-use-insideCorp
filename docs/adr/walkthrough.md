# Walkthrough — APIM - Azure AI Foundry 通信ログ収集パイプライン

仕様書 `spec_function.md` v2.3 の設計方針に基づき、Azure Functions 実装の全面的な再構築を完了しました。

## 実施した変更内容

新しい単一の Function App を [functions/](functions) ディレクトリに構築し、仕様に準拠する形で以下のコンポーネントを実装しました。

### 1. プロジェクト基盤の構築
- **[package.json](functions/package.json)**: Node.js 20.x を強制し、必要な Azure SDK および Parquet ライブラリ (`@dsnp/parquetjs`) とテストツール (`jest`, `ts-jest`) を導入しました。
- **[host.json](functions/host.json)**: §24 に準拠し、`queues` 設定 (`batchSize: 16`, `visibilityTimeout: "00:00:30"`, `maxDequeueCount: 3`) を定義しました。Timer トリガーと Queue トリガーの再試行干渉を避けるため、グローバル `retry` 設定は排除しています。
- **[local.settings.json](functions/local.settings.json)**: §25 のすべてのアプリケーション設定を含めました。
- **[tsconfig.json](functions/tsconfig.json)**, **[jest.config.js](functions/jest.config.js)**: Azure Functions v4 および ESM モジュール解決用のコンパイラとテスト環境を設定しました。

### 2. 共通ライブラリの実装 ([src/lib/](functions/src/lib))
- **[config.ts](functions/src/lib/config.ts)**: §25 のアプリケーション設定を型安全に読み込みます。
- **[logRecord.ts](functions/src/lib/logRecord.ts)**: §10 に準拠した `LogRecord` スキーマ (必須 `schemaVersion` 含む) や、Poison Blob / Log Analytics 用レコードの型定義を提供します。
- **[blobClients.ts](functions/src/lib/blobClients.ts)**: §21 に従い、User-assigned Managed Identity (UAMI) を用いた SDK クライアントをキャッシュ管理します。
- **[jwtDecoder.ts](functions/src/lib/jwtDecoder.ts)**: JWT ペイロードのデコード（署名検証なし）と、§9 に基づく `oid`/`sub`/`tid`/`upn`/`appid` などの識別情報のマッピングを行います。
- **[cursorManager.ts](functions/src/lib/cursorManager.ts)**: §11 に従い、Diagnostic Append Blob の追記を差分検知するための Byte Offset カーソル状態を管理します。
- **[diagnosticParser.ts](functions/src/lib/diagnosticParser.ts)**: JSON Lines ログを 1 行ずつパースします。末尾が改行で終わっていない未完成の行は次回に持ち越す処理境界制御を行います。
- **[logAnalyticsClient.ts](functions/src/lib/logAnalyticsClient.ts)**: `@azure/monitor-ingestion` を使用して Logs Ingestion API 経由でデータを送信します。
- **[poisonBlobWriter.ts](functions/src/lib/poisonBlobWriter.ts)**: 障害解析用の Poison Blob を構造化 JSON 形式で書き込みます。
- **[parquetWriter.ts](functions/src/lib/parquetWriter.ts)**: 列指向 Parquet ファイルへの変換と、低レベル `upload` API を用いた Archive Tier への直接アップロードを行います。

### 3. Function の実装 ([src/functions/](functions/src/functions))
- **[ingestLog.ts](functions/src/functions/ingestLog.ts)**: Timer トリガー (5分間隔)。Range Download による差分取得、48KB メッセージサイズ制限チェック、Storage Queue (`buffer`) への送信、送信成功後のカーソル更新を保証します。個別リトライを設定しています。
- **[processQueue.ts](functions/src/functions/processQueue.ts)**: Storage Queue トリガー。Analytics JSON 書き込み（決定論的パスによる冪等性）を**先行**させ、成功後に Log Analytics 送信を行う「障害分離」設計を採用しています。失敗時は Functions 組み込み再試行に委ねます。
- **[poisonHandler.ts](functions/src/functions/poisonHandler.ts)**: `buffer-poison` キューのトリガー。3回リトライ失敗したメッセージを Poison Blob へ退避し、アラート連携用の構造化エラーログを Application Insights に出力します。無限ループを防止するため、本機能内での例外はログに抑えます。
- **[archiveDaily.ts](functions/src/functions/archiveDaily.ts)**: Timer トリガー (日次)。前日の Analytics JSON を Parquet に日次集約し、低レベル API で Archive Tier へアップロードします。失敗時は翌日の実行をブロックせず Poison Blob へ記録します。

---

## 検証結果

### 1. TypeScript ビルド検証
```bash
npm run build
```
- コンパイルエラーなしで正常ビルド可能。

### 2. 単体・結合テスト検証
Jest を用いて、仕様書 §28 に列挙された全項目（JWT デコード、カーソル制御、Range Download、サイズ制限、障害分離、冪等パス、Poison 処理、Parquet 集約等）をシミュレートする 62 のテストケースを実行し、すべて正常にパスすることを確認しました。

```
Test Suites: 8 passed, 8 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        3.489 s
Ran all test suites.
```

> [!NOTE]
> 既存の `log-http/` および `log-batch/` ディレクトリはユーザーの指示に基づき削除せず残してあります。
