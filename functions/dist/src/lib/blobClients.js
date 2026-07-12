"use strict";
/**
 * Azure SDK クライアント生成 (§21 認証: UAMI + Azure RBAC)
 *
 * すべてのAzureサービスへのアクセスは User-assigned Managed Identity を使用する。
 * Connection String / Shared Key / SAS は禁止 (§25)。
 * コールドスタート高速化のためシングルトンキャッシュする。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredential = getCredential;
exports.getBlobServiceClient = getBlobServiceClient;
exports.getQueueServiceClient = getQueueServiceClient;
exports.resetClients = resetClients;
const storage_blob_1 = require("@azure/storage-blob");
const storage_queue_1 = require("@azure/storage-queue");
const identity_1 = require("@azure/identity");
const config_js_1 = require("./config.js");
let cachedCredential = null;
let cachedBlobServiceClient = null;
let cachedQueueServiceClient = null;
/**
 * UAMI の TokenCredential を取得する。
 * AZURE_CLIENT_ID が設定されている場合は ManagedIdentityCredential を使用し、
 * 未設定の場合は DefaultAzureCredential（ローカル開発用）にフォールバックする。
 */
function getCredential() {
    if (cachedCredential) {
        return cachedCredential;
    }
    const config = (0, config_js_1.loadConfig)();
    if (config.azureClientId) {
        cachedCredential = new identity_1.ManagedIdentityCredential(config.azureClientId);
    }
    else {
        cachedCredential = new identity_1.DefaultAzureCredential();
    }
    return cachedCredential;
}
/**
 * BlobServiceClient を取得する。
 */
function getBlobServiceClient() {
    if (cachedBlobServiceClient) {
        return cachedBlobServiceClient;
    }
    const config = (0, config_js_1.loadConfig)();
    if (!config.storageAccountUrl) {
        throw new Error('STORAGE_ACCOUNT_URL environment variable is missing.');
    }
    cachedBlobServiceClient = new storage_blob_1.BlobServiceClient(config.storageAccountUrl, getCredential());
    return cachedBlobServiceClient;
}
/**
 * QueueServiceClient を取得する。
 *
 * Storage Queue URL は Blob URL からドメインを変換して生成する。
 * 例: https://xxx.blob.core.windows.net → https://xxx.queue.core.windows.net
 */
function getQueueServiceClient() {
    if (cachedQueueServiceClient) {
        return cachedQueueServiceClient;
    }
    const config = (0, config_js_1.loadConfig)();
    if (!config.storageAccountUrl) {
        throw new Error('STORAGE_ACCOUNT_URL environment variable is missing.');
    }
    // Blob URL → Queue URL 変換
    const queueUrl = config.storageAccountUrl.replace('.blob.', '.queue.');
    cachedQueueServiceClient = new storage_queue_1.QueueServiceClient(queueUrl, getCredential());
    return cachedQueueServiceClient;
}
/**
 * テスト用: キャッシュをリセットする
 */
function resetClients() {
    cachedCredential = null;
    cachedBlobServiceClient = null;
    cachedQueueServiceClient = null;
}
//# sourceMappingURL=blobClients.js.map