import { app, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

export interface AuditLogRecord {
  timestamp: string;
  oid: string;
  tid?: string;
  sub?: string;
  appid?: string;
  azp?: string;
  model?: string;
  deployment?: string;
  operation?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  httpStatus: number;
  backendStatus?: number;
  latencyMs?: number;
  backendLatencyMs?: number;
  requestId: string;
  correlationId?: string;
  traceparent?: string;
  clientIp?: string;
  userAgent?: string;
  xMsClientRequestId?: string;
  xMsRequestId?: string;
}

let cachedBlobServiceClient: BlobServiceClient | null = null;

export function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) return cachedBlobServiceClient;
  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) throw new Error('AZURE_STORAGE_BLOB_ENDPOINT environment variable is missing.');
  cachedBlobServiceClient = endpoint.includes('localhost') || endpoint.startsWith('http://127.0.0.1')
    ? BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage || 'UseDevelopmentStorage=true')
    : new BlobServiceClient(endpoint, new DefaultAzureCredential());
  return cachedBlobServiceClient;
}

function normalizeRecord(message: unknown): AuditLogRecord {
  const body = typeof message === 'string' ? JSON.parse(message) : message as Record<string, unknown>;
  const record = body as Partial<AuditLogRecord>;
  if (!record.timestamp || !record.oid || !record.requestId) {
    throw new Error('Audit message is missing timestamp, oid, or requestId.');
  }
  return {
    timestamp: String(record.timestamp),
    oid: String(record.oid),
    tid: String(record.tid ?? ''),
    sub: String(record.sub ?? ''),
    appid: String(record.appid ?? ''),
    azp: String(record.azp ?? ''),
    model: String(record.model ?? ''),
    deployment: String(record.deployment ?? ''),
    operation: String(record.operation ?? ''),
    promptTokens: Number(record.promptTokens ?? 0),
    completionTokens: Number(record.completionTokens ?? 0),
    totalTokens: Number(record.totalTokens ?? 0),
    httpStatus: Number(record.httpStatus ?? 0),
    backendStatus: Number(record.backendStatus ?? 0),
    latencyMs: Number(record.latencyMs ?? 0),
    backendLatencyMs: Number(record.backendLatencyMs ?? 0),
    requestId: String(record.requestId),
    correlationId: String(record.correlationId ?? ''),
    traceparent: String(record.traceparent ?? ''),
    clientIp: String(record.clientIp ?? ''),
    userAgent: String(record.userAgent ?? ''),
    xMsClientRequestId: String(record.xMsClientRequestId ?? ''),
    xMsRequestId: String(record.xMsRequestId ?? ''),
  };
}

function blobPath(record: AuditLogRecord): string {
  const date = new Date(record.timestamp);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getUTCFullYear();
  const month = String(safeDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getUTCDate()).padStart(2, '0');
  return `year=${year}/month=${month}/day=${day}/${record.requestId}.json`;
}

export async function auditQueueHandler(message: unknown, context: InvocationContext): Promise<void> {
  const blobServiceClient = getBlobServiceClient();
  try {
    const record = normalizeRecord(message);
    const container = blobServiceClient.getContainerClient(process.env.ANALYTICS_CONTAINER || 'analytics-log');
    const payload = JSON.stringify(record);
    await container.getBlockBlobClient(blobPath(record)).upload(payload, Buffer.byteLength(payload), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    context.log(`Stored sanitized audit JSON for requestId=${record.requestId}.`);
  } catch (error) {
    const container = blobServiceClient.getContainerClient(process.env.POISON_CONTAINER || 'poison-log');
    const id = context.invocationId;
    const payload = JSON.stringify({ timestamp: new Date().toISOString(), invocationId: id, error: error instanceof Error ? error.message : String(error), message });
    await container.getBlockBlobClient(`year=${new Date().getUTCFullYear()}/invocation-${id}.json`).upload(payload, Buffer.byteLength(payload), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    throw error;
  }
}

app.storageQueue('auditQueue', {
  queueName: process.env.AUDIT_QUEUE_NAME || 'audit-log',
  connection: 'AzureWebJobsStorage',
  handler: auditQueueHandler,
});
