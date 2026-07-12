/**
 * Azure SDK クライアント生成 (§21 認証: UAMI + Azure RBAC)
 *
 * すべてのAzureサービスへのアクセスは User-assigned Managed Identity を使用する。
 * Connection String / Shared Key / SAS は禁止 (§25)。
 * コールドスタート高速化のためシングルトンキャッシュする。
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { QueueServiceClient } from '@azure/storage-queue';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/identity';
import { loadConfig } from './config.js';

let cachedCredential: TokenCredential | null = null;
let cachedBlobServiceClient: BlobServiceClient | null = null;
let cachedQueueServiceClient: QueueServiceClient | null = null;

/**
 * UAMI の TokenCredential を取得する。
 * AZURE_CLIENT_ID が設定されている場合は ManagedIdentityCredential を使用し、
 * 未設定の場合は DefaultAzureCredential（ローカル開発用）にフォールバックする。
 */
export function getCredential(): TokenCredential {
  if (cachedCredential) {
    return cachedCredential;
  }

  const config = loadConfig();

  if (config.azureClientId) {
    cachedCredential = new ManagedIdentityCredential(config.azureClientId);
  } else {
    cachedCredential = new DefaultAzureCredential();
  }

  return cachedCredential;
}

/**
 * BlobServiceClient を取得する。
 */
export function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const config = loadConfig();

  if (!config.storageAccountUrl) {
    throw new Error('STORAGE_ACCOUNT_URL environment variable is missing.');
  }

  cachedBlobServiceClient = new BlobServiceClient(
    config.storageAccountUrl,
    getCredential(),
  );

  return cachedBlobServiceClient;
}

/**
 * QueueServiceClient を取得する。
 *
 * Storage Queue URL は Blob URL からドメインを変換して生成する。
 * 例: https://xxx.blob.core.windows.net → https://xxx.queue.core.windows.net
 */
export function getQueueServiceClient(): QueueServiceClient {
  if (cachedQueueServiceClient) {
    return cachedQueueServiceClient;
  }

  const config = loadConfig();

  if (!config.storageAccountUrl) {
    throw new Error('STORAGE_ACCOUNT_URL environment variable is missing.');
  }

  // Blob URL → Queue URL 変換
  const queueUrl = config.storageAccountUrl.replace('.blob.', '.queue.');

  cachedQueueServiceClient = new QueueServiceClient(
    queueUrl,
    getCredential(),
  );

  return cachedQueueServiceClient;
}

/**
 * テスト用: キャッシュをリセットする
 */
export function resetClients(): void {
  cachedCredential = null;
  cachedBlobServiceClient = null;
  cachedQueueServiceClient = null;
}
