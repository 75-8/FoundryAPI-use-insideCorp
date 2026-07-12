/**
 * 環境変数の一元管理 (§25 アプリケーション設定)
 *
 * Connection String は禁止 (§25)。
 * すべてのAzureサービスへのアクセスは User-assigned Managed Identity + Azure RBAC (§21)。
 */

export interface AppConfig {
  /** Blob / Queue Storage のアカウント URL */
  storageAccountUrl: string;
  /** Storage Queue 名 (既定: "buffer") */
  queueName: string;
  /** Analytics Blob コンテナ名 (既定: "analytics") */
  analyticsContainer: string;
  /** Archive Blob コンテナ名 (既定: "archive") */
  archiveContainer: string;
  /** Poison Blob コンテナ名 (既定: "poison") */
  poisonContainer: string;
  /** カーソル状態保存用コンテナ名 (既定: "cursor") */
  cursorContainer: string;
  /** APIM Diagnostic Settings 出力先コンテナ名 */
  diagnosticLogContainer: string;
  /** ingestLog の Timer Trigger 実行間隔 (CRON形式) */
  ingestTimerSchedule: string;
  /** archiveDaily の Timer Trigger 実行時刻 (CRON形式) */
  archiveTimerSchedule: string;
  /** Queue メッセージサイズ閾値 (バイト。既定: 48000) */
  queueMessageMaxBytes: number;
  /** Log Analytics DCE エンドポイント */
  logAnalyticsDceEndpoint: string;
  /** Log Analytics DCR ID */
  logAnalyticsDcrId: string;
  /** Log Analytics Stream 名 */
  logAnalyticsStreamName: string;
  /** User-assigned Managed Identity の Client ID */
  azureClientId: string;
}

/**
 * process.env から設定値を読み込む。
 * 必須項目が未設定の場合は空文字を返し、呼び出し側で適宜ハンドリングする。
 */
export function loadConfig(): AppConfig {
  return {
    storageAccountUrl: process.env.STORAGE_ACCOUNT_URL ?? '',
    queueName: process.env.QUEUE_NAME ?? 'buffer',
    analyticsContainer: process.env.ANALYTICS_CONTAINER ?? 'analytics',
    archiveContainer: process.env.ARCHIVE_CONTAINER ?? 'archive',
    poisonContainer: process.env.POISON_CONTAINER ?? 'poison',
    cursorContainer: process.env.CURSOR_CONTAINER ?? 'cursor',
    diagnosticLogContainer: process.env.DIAGNOSTIC_LOG_CONTAINER ?? 'insights-logs-gatewaylogs',
    ingestTimerSchedule: process.env.INGEST_TIMER_SCHEDULE ?? '0 */5 * * * *',
    archiveTimerSchedule: process.env.ARCHIVE_TIMER_SCHEDULE ?? '0 0 3 * * *',
    queueMessageMaxBytes: parseInt(process.env.QUEUE_MESSAGE_MAX_BYTES ?? '48000', 10),
    logAnalyticsDceEndpoint: process.env.LOG_ANALYTICS_DCE_ENDPOINT ?? '',
    logAnalyticsDcrId: process.env.LOG_ANALYTICS_DCR_ID ?? '',
    logAnalyticsStreamName: process.env.LOG_ANALYTICS_STREAM_NAME ?? '',
    azureClientId: process.env.AZURE_CLIENT_ID ?? '',
  };
}
