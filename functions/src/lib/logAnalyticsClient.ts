/**
 * Logs Ingestion API クライアント (§18)
 *
 * Function → DCE → DCR → CodingAgentLogs_CL
 *
 * 認証: User-assigned Managed Identity (§21)
 * DCE/DCR のプロビジョニングは Bicep 側（別紙）。
 * Function 側は LOG_ANALYTICS_DCE_ENDPOINT / LOG_ANALYTICS_DCR_ID /
 * LOG_ANALYTICS_STREAM_NAME をアプリケーション設定から参照 (§18)。
 */

import { LogsIngestionClient } from '@azure/monitor-ingestion';
import { getCredential } from './blobClients.js';
import { loadConfig } from './config.js';
import type { LogAnalyticsRecord } from './logRecord.js';

let cachedClient: LogsIngestionClient | null = null;

/**
 * LogsIngestionClient を取得する。
 */
function getLogsIngestionClient(): LogsIngestionClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config = loadConfig();

  if (!config.logAnalyticsDceEndpoint) {
    throw new Error('LOG_ANALYTICS_DCE_ENDPOINT environment variable is missing.');
  }

  cachedClient = new LogsIngestionClient(
    config.logAnalyticsDceEndpoint,
    getCredential(),
  );

  return cachedClient;
}

/**
 * Log Analytics Custom Table へレコードを送信する。
 *
 * Logs Ingestion API には冪等性がないため、重複送信される可能性がある。
 * 重複はクエリ側（arg_max by ShareId）で吸収する (§19)。
 *
 * @param records 送信する LogAnalyticsRecord 配列
 */
export async function sendToLogAnalytics(
  records: LogAnalyticsRecord[],
): Promise<void> {
  const config = loadConfig();
  const client = getLogsIngestionClient();

  await client.upload(
    config.logAnalyticsDcrId,
    config.logAnalyticsStreamName,
    records as unknown as Record<string, unknown>[],
  );
}

/**
 * テスト用: キャッシュをリセットする
 */
export function resetLogAnalyticsClient(): void {
  cachedClient = null;
}
