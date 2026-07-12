"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToLogAnalytics = sendToLogAnalytics;
exports.resetLogAnalyticsClient = resetLogAnalyticsClient;
const monitor_ingestion_1 = require("@azure/monitor-ingestion");
const blobClients_js_1 = require("./blobClients.js");
const config_js_1 = require("./config.js");
let cachedClient = null;
/**
 * LogsIngestionClient を取得する。
 */
function getLogsIngestionClient() {
    if (cachedClient) {
        return cachedClient;
    }
    const config = (0, config_js_1.loadConfig)();
    if (!config.logAnalyticsDceEndpoint) {
        throw new Error('LOG_ANALYTICS_DCE_ENDPOINT environment variable is missing.');
    }
    cachedClient = new monitor_ingestion_1.LogsIngestionClient(config.logAnalyticsDceEndpoint, (0, blobClients_js_1.getCredential)());
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
async function sendToLogAnalytics(records) {
    const config = (0, config_js_1.loadConfig)();
    const client = getLogsIngestionClient();
    await client.upload(config.logAnalyticsDcrId, config.logAnalyticsStreamName, records);
}
/**
 * テスト用: キャッシュをリセットする
 */
function resetLogAnalyticsClient() {
    cachedClient = null;
}
//# sourceMappingURL=logAnalyticsClient.js.map