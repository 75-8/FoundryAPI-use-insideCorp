"use strict";
/**
 * Function2: processQueue (§11)
 *
 * Storage Queue Trigger (buffer) で受信した LogRecord を処理する。
 *
 * 処理 (§11):
 *   1. 必須項目確認
 *   2. Analytics JSON 生成（Hot Tier, analytics/yyyy/MM/dd/{shareId}.json）を先に完了
 *   3. Analytics 書込み成功後、Log Analytics 送信
 *
 * 障害分離の方針 (§11):
 *   Analytics 書込みを常に先行させることで、Log Analytics 側の障害が
 *   Analytics（Workbook 等の可視化の主経路）に影響しない設計。
 *   Log Analytics 送信が失敗した場合のみ例外をスローし、メッセージ全体を再試行。
 *   Analytics 書込みは冪等な上書きのため再試行しても問題ない。
 *
 * 処理が失敗した場合は例外をスローし、Azure Functions の組み込み Queue Trigger
 * 再試行機構に委ねる（host.json の maxDequeueCount 回まで自動リトライ後、
 * buffer-poison キューへ自動移動。§12, §14, §15）。
 * processQueue 自身が Poison Blob への書込みを行うことはない。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processQueueHandler = processQueueHandler;
const functions_1 = require("@azure/functions");
const config_js_1 = require("../lib/config.js");
const blobClients_js_1 = require("../lib/blobClients.js");
const logAnalyticsClient_js_1 = require("../lib/logAnalyticsClient.js");
const logRecord_js_1 = require("../lib/logRecord.js");
/**
 * processQueue のメインハンドラー
 */
async function processQueueHandler(queueItem, context) {
    context.log('processQueue: Queue trigger started.');
    // Queue メッセージのデシリアライズ
    let record;
    try {
        if (typeof queueItem === 'string') {
            record = JSON.parse(queueItem);
        }
        else {
            record = queueItem;
        }
    }
    catch (err) {
        throw new Error(`processQueue: Failed to parse queue message: ${err instanceof Error ? err.message : String(err)}`);
    }
    // ステップ1: 必須項目確認 (§14)
    if (!record.shareId) {
        throw new Error('processQueue: shareId is missing from the record.');
    }
    if (!record.eventTime) {
        throw new Error('processQueue: eventTime is missing from the record.');
    }
    const config = (0, config_js_1.loadConfig)();
    const blobServiceClient = (0, blobClients_js_1.getBlobServiceClient)();
    const analyticsContainer = blobServiceClient.getContainerClient(config.analyticsContainer);
    // ステップ2: Analytics JSON 生成 — 先に完了させる (§11, §16)
    // パス: analytics/yyyy/MM/dd/{shareId}.json
    // 決定論的ファイル名のため重複処理は冪等な上書きとなる (§10)
    const eventDate = new Date(record.eventTime);
    const year = eventDate.getUTCFullYear();
    const month = String(eventDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getUTCDate()).padStart(2, '0');
    const analyticsBlobPath = `${year}/${month}/${day}/${record.shareId}.json`;
    const analyticsContent = JSON.stringify(record, null, 2);
    const blockBlobClient = analyticsContainer.getBlockBlobClient(analyticsBlobPath);
    try {
        await blockBlobClient.upload(analyticsContent, Buffer.byteLength(analyticsContent, 'utf-8'), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
        });
        context.log(`processQueue: Analytics JSON written to ${analyticsBlobPath}`);
    }
    catch (err) {
        // Analytics 書込み失敗は致命的 → 例外をスローしてリトライ
        throw new Error(`processQueue: Failed to write Analytics JSON for shareId=${record.shareId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    // ステップ3: Log Analytics 送信 (§18)
    // Analytics 書込み成功後に実行。Log Analytics 送信失敗時のみ例外スロー。
    try {
        const laRecord = (0, logRecord_js_1.toLogAnalyticsRecord)(record);
        await (0, logAnalyticsClient_js_1.sendToLogAnalytics)([laRecord]);
        context.log(`processQueue: Log Analytics record sent for shareId=${record.shareId}`);
    }
    catch (err) {
        // Log Analytics 送信失敗 → 例外をスローしてリトライ
        // Analytics は既に書込み済みのため、再試行時の上書きは冪等 (§11)
        throw new Error(`processQueue: Failed to send to Log Analytics for shareId=${record.shareId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    context.log('processQueue: Queue trigger completed.');
}
/**
 * Queue Trigger 登録 (§11)
 *
 * processQueue 自身でリトライ回数を管理するロジックは実装しない。
 * Azure Functions ランタイムの組み込み Queue Trigger 再試行・Poison Queue 機構に委ねる (§14)。
 */
functions_1.app.storageQueue('processQueue', {
    queueName: '%QUEUE_NAME%',
    connection: '',
    handler: processQueueHandler,
});
//# sourceMappingURL=processQueue.js.map