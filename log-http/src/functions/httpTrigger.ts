import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import * as appInsights from 'applicationinsights';

// Initialize Application Insights SDK
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup().start();
}

// Interface of incoming audit log record
interface AuditLogRecord {
  timestamp: string;
  requestId: string;
  oid: string;
  applicationId: string;
  subscriptionId: string;
  deployment: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  statusCode: number;
}

// Client lazily initialized to speed up cold starts
let cachedBlobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) {
    throw new Error('AZURE_STORAGE_BLOB_ENDPOINT environment variable is missing.');
  }

  // Handle local development storage emulator
  if (endpoint.startsWith('http://127.0.0.1') || endpoint.includes('localhost')) {
    const connStr = process.env.AzureWebJobsStorage || 'UseDevelopmentStorage=true';
    cachedBlobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  } else {
    // Managed Identity auth for production
    cachedBlobServiceClient = new BlobServiceClient(endpoint, new DefaultAzureCredential());
  }

  return cachedBlobServiceClient;
}

export async function auditLogHttp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Audit log HTTP trigger received a request.`);

  // 1. Authenticate Request
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.AUDIT_API_KEY;

  if (expectedApiKey && apiKey !== expectedApiKey) {
    context.warn(`Unauthorized access attempt. Invalid x-api-key.`);
    return { status: 401, body: JSON.stringify({ error: 'Unauthorized: Invalid API key.' }) };
  }

  // 2. Parse and Validate Body
  let body: Partial<AuditLogRecord>;
  try {
    body = (await request.json()) as Partial<AuditLogRecord>;
  } catch (err: any) {
    context.error(`Failed to parse body JSON: ${err.message}`);
    return { status: 400, body: JSON.stringify({ error: 'Invalid JSON payload.' }) };
  }

  if (
    !body.timestamp ||
    !body.requestId ||
    body.oid === undefined ||
    body.promptTokens === undefined ||
    body.completionTokens === undefined ||
    body.totalTokens === undefined ||
    body.responseTimeMs === undefined ||
    body.statusCode === undefined
  ) {
    context.warn(`Validation failed. Missing required fields in audit payload.`);
    return {
      status: 400,
      body: JSON.stringify({
        error: 'Missing required audit fields. Verify timestamp, requestId, oid, promptTokens, completionTokens, totalTokens, responseTimeMs, and statusCode.',
      }),
    };
  }

  const logRecord: AuditLogRecord = {
    timestamp: String(body.timestamp),
    requestId: String(body.requestId),
    oid: String(body.oid),
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

  // 3. Forward to Log Analytics / App Insights
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackTrace({
      message: JSON.stringify(logRecord),
      severity: appInsights.Contracts.SeverityLevel.Information,
    });
  } else {
    // Fallback console log which gets captured by default workspace diagnostic logging
    context.log(JSON.stringify(logRecord));
  }

  // 4. Save to Blob Storage (Raw Container)
  try {
    const date = new Date(logRecord.timestamp);
    const isValidDate = !isNaN(date.getTime());
    const year = isValidDate ? date.getUTCFullYear() : new Date().getUTCFullYear();
    const month = String((isValidDate ? date.getUTCMonth() : new Date().getUTCMonth()) + 1).padStart(2, '0');
    const day = String(isValidDate ? date.getUTCDate() : new Date().getUTCDate()).padStart(2, '0');

    const blobName = `raw-log/${year}/${month}/${day}/${logRecord.requestId}.json`;
    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient('raw-log');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const dataStr = JSON.stringify(logRecord);
    await blockBlobClient.upload(dataStr, dataStr.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    context.log(`Successfully uploaded audit log raw JSON to blob: ${blobName}`);
  } catch (err: any) {
    context.error(`Failed to upload raw log to blob storage: ${err.message}`);
    // Non-blocking failure, return 200 as audit log is best effort at destination
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Success', requestId: logRecord.requestId }),
  };
}

app.http('audit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: auditLogHttp,
});
