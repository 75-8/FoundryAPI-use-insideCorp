/**
 * Azure SDK クライアント生成 (§21 認証: UAMI + Azure RBAC)
 *
 * すべてのAzureサービスへのアクセスは User-assigned Managed Identity を使用する。
 * Connection String / Shared Key / SAS は禁止 (§25)。
 * コールドスタート高速化のためシングルトンキャッシュする。
 */
import { BlobServiceClient } from '@azure/storage-blob';
import { QueueServiceClient } from '@azure/storage-queue';
import type { TokenCredential } from '@azure/identity';
/**
 * UAMI の TokenCredential を取得する。
 * AZURE_CLIENT_ID が設定されている場合は ManagedIdentityCredential を使用し、
 * 未設定の場合は DefaultAzureCredential（ローカル開発用）にフォールバックする。
 */
export declare function getCredential(): TokenCredential;
/**
 * BlobServiceClient を取得する。
 */
export declare function getBlobServiceClient(): BlobServiceClient;
/**
 * QueueServiceClient を取得する。
 *
 * Storage Queue URL は Blob URL からドメインを変換して生成する。
 * 例: https://xxx.blob.core.windows.net → https://xxx.queue.core.windows.net
 */
export declare function getQueueServiceClient(): QueueServiceClient;
/**
 * テスト用: キャッシュをリセットする
 */
export declare function resetClients(): void;
