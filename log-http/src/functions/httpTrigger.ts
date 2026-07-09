import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import * as appInsights from 'applicationinsights';
import {
  AuditLogRecord,
  AuditLogPayload,
  AuditSuccessResponse,
  AuditErrorResponse,
  FunctionConfig,
  REQUIRED_AUDIT_FIELDS,
} from '../types/auditLog';
import { buildBlobName } from './auditLogUtils';

// ---------------------------------------------------------------------------
// 環境変数の一元管理 (シークレット候補は FunctionConfig に定義済み)
// ---------------------------------------------------------------------------

/** process.env から設定値を読み込む */
function loadConfig(): FunctionConfig {
  return {
    /** [シークレット] x-api-key ヘッダーの期待値。Key Vault / App Settings で管理する。 */
    auditApiKey: process.env.AUDIT_API_KEY,
    /** Blob Storage エンドポイント URL */
    blobEndpoint: process.env.AZURE_STORAGE_BLOB_ENDPOINT,
    /** ローカル開発用ストレージエミュレータ接続文字列 */
    azureWebJobsStorage: process.env.AzureWebJobsStorage,
    /** [シークレット] Application Insights 接続文字列。Key Vault / App Settings で管理する。 */
    appInsightsConnStr: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  };
}

const config = loadConfig();

// Initialize Application Insights SDK
if (config.appInsightsConnStr) {
  appInsights.setup().start();
}

// ---------------------------------------------------------------------------
// Blob Service Client (コールドスタート高速化のためキャッシュ)
// ---------------------------------------------------------------------------

let cachedBlobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const { blobEndpoint, azureWebJobsStorage } = config;

  if (!blobEndpoint) {
    throw new Error('AZURE_STORAGE_BLOB_ENDPOINT environment variable is missing.');
  }

  // Handle local development storage emulator
  if (blobEndpoint.startsWith('http://127.0.0.1') || blobEndpoint.includes('localhost')) {
    const connStr = azureWebJobsStorage ?? 'UseDevelopmentStorage=true';
    cachedBlobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  } else {
    // Managed Identity auth for production (SEC-001, FR-004)
    cachedBlobServiceClient = new BlobServiceClient(blobEndpoint, new DefaultAzureCredential());
  }

  return cachedBlobServiceClient;
}

// ---------------------------------------------------------------------------
// HTTP トリガーハンドラー
// ---------------------------------------------------------------------------

export async function auditLogHttp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Audit log HTTP trigger received a request.`);

  // 1. Authenticate Request
  const apiKey = request.headers.get('x-api-key');
  const { auditApiKey } = config;

  if (auditApiKey && apiKey !== auditApiKey) {
    context.warn(`Unauthorized access attempt. Invalid x-api-key.`);
    const errBody: AuditErrorResponse = { error: 'Unauthorized: Invalid API key.' };
    return { status: 401, body: JSON.stringify(errBody) };
  }

  // 2. Parse and Validate Body
  let body: AuditLogPayload;
  try {
    body = (await request.json()) as AuditLogPayload;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    context.error(`Failed to parse body JSON: ${message}`);
    const errBody: AuditErrorResponse = { error: 'Invalid JSON payload.' };
    return { status: 400, body: JSON.stringify(errBody) };
  }

  // 必須フィールドの一括バリデーション (REQUIRED_AUDIT_FIELDS を使用)
  const missingFields = REQUIRED_AUDIT_FIELDS.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === '',
  );

  if (missingFields.length > 0) {
    context.warn(`Validation failed. Missing required fields: ${missingFields.join(', ')}`);
    const errBody: AuditErrorResponse = {
      error: `Missing required audit fields: ${missingFields.join(', ')}.`,
    };
    return { status: 400, body: JSON.stringify(errBody) };
  }

  // 型が確定しているため as キャストでレコードを構築
  const logRecord: AuditLogRecord = {
    timestamp: String(body.timestamp),
    requestId: String(body.requestId),
    oid: String(body.oid),
    // AU-002: upn, tenantId は可能な限り取得する (任意)
    upn: String(body.upn ?? ''),
    tenantId: String(body.tenantId ?? ''),
    applicationId: String(body.applicationId ?? ''),
    subscriptionId: String(body.subscriptionId ?? ''),
    deployment: String(body.deployment ?? ''),
    model: String(body.model ?? ''),
    promptTokens: Number(body.promptTokens),
    completionTokens: Number(body.completionTokens),
    totalTokens: Number(body.totalTokens),
    responseTimeMs: Number(body.responseTimeMs),
    statusCode: Number(body.statusCode),
  };

  // 3. Forward to Log Analytics / App Insights (AU-001)
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackTrace({
      message: JSON.stringify(logRecord),
      severity: appInsights.Contracts.SeverityLevel.Information,
    });
  } else {
    // Fallback: default workspace diagnostic logging が拾う (AU-001)
    context.log(JSON.stringify(logRecord));
  }

  // 4. Save to Blob Storage - Raw Container (AU-001)
  try {
    const blobName = buildBlobName(logRecord.timestamp, logRecord.requestId);
    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient('raw-log');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const dataStr = JSON.stringify(logRecord);
    await blockBlobClient.upload(dataStr, dataStr.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    context.log(`Successfully uploaded audit log raw JSON to blob: ${blobName}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    context.error(`Failed to upload raw log to blob storage: ${message}`);
    // Non-blocking failure — 監査ログはベストエフォートで配信する
  }

  const successBody: AuditSuccessResponse = { status: 'Success', requestId: logRecord.requestId };
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(successBody),
  };
}

app.http('audit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: auditLogHttp,
});
