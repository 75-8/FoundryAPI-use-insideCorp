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
import type { LogAnalyticsRecord } from './logRecord.js';
/**
 * Log Analytics Custom Table へレコードを送信する。
 *
 * Logs Ingestion API には冪等性がないため、重複送信される可能性がある。
 * 重複はクエリ側（arg_max by ShareId）で吸収する (§19)。
 *
 * @param records 送信する LogAnalyticsRecord 配列
 */
export declare function sendToLogAnalytics(records: LogAnalyticsRecord[]): Promise<void>;
/**
 * テスト用: キャッシュをリセットする
 */
export declare function resetLogAnalyticsClient(): void;
