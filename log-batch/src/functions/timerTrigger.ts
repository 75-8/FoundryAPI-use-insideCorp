import { app, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import * as appInsights from 'applicationinsights';
import * as parquet from '@dsnp/parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { groupBlobNamesByDate } from './auditLogBatchUtils';

// Initialize Application Insights SDK
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup().start();
}

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

let cachedBlobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
  if (!endpoint) {
    throw new Error('AZURE_STORAGE_BLOB_ENDPOINT environment variable is missing.');
  }

  if (endpoint.startsWith('http://127.0.0.1') || endpoint.includes('localhost')) {
    const connStr = process.env.AzureWebJobsStorage || 'UseDevelopmentStorage=true';
    cachedBlobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  } else {
    cachedBlobServiceClient = new BlobServiceClient(endpoint, new DefaultAzureCredential());
  }

  return cachedBlobServiceClient;
}

// Helper to download stream as string
async function streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

export async function auditLogBatch(myTimer: any, context: InvocationContext): Promise<void> {
  context.log(`Timer trigger function started.`);

  const blobServiceClient = getBlobServiceClient();
  const rawContainerClient = blobServiceClient.getContainerClient('raw-log');
  const archiveContainerClient = blobServiceClient.getContainerClient('archive-log');

  // Verify containers exist (optional helper but good for safety)
  if (!(await rawContainerClient.exists())) {
    context.warn(`Container 'raw-log' does not exist.`);
    return;
  }

  // 1. List all blobs in raw-log
  const blobs: string[] = [];
  for await (const blob of rawContainerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.json')) {
      blobs.push(blob.name);
    }
  }

  if (blobs.length === 0) {
    context.log(`No raw audit log JSON blobs found to process.`);
    return;
  }

  context.log(`Found ${blobs.length} raw JSON blobs. Grouping by date...`);

  const groups = groupBlobNamesByDate(blobs);

  // 3. Define Parquet Schema matching audit log structure
  const parquetSchema = new parquet.ParquetSchema({
    timestamp: { type: 'UTF8' },
    requestId: { type: 'UTF8' },
    oid: { type: 'UTF8' },
    applicationId: { type: 'UTF8' },
    subscriptionId: { type: 'UTF8' },
    deployment: { type: 'UTF8' },
    model: { type: 'UTF8' },
    promptTokens: { type: 'INT64' },
    completionTokens: { type: 'INT64' },
    totalTokens: { type: 'INT64' },
    responseTimeMs: { type: 'INT64' },
    statusCode: { type: 'INT64' },
  });

  // 4. Process each date group
  for (const dateKey of Object.keys(groups)) {
    context.log(`Processing group for date: ${dateKey} with ${groups[dateKey].length} records.`);
    const records: AuditLogRecord[] = [];

    // Download and parse all JSON files in the group
    for (const blobName of groups[dateKey]) {
      try {
        const blobClient = rawContainerClient.getBlobClient(blobName);
        const downloadResponse = await blobClient.download();
        if (downloadResponse.readableStreamBody) {
          const bodyStr = await streamToString(downloadResponse.readableStreamBody);
          const record = JSON.parse(bodyStr) as AuditLogRecord;
          records.push(record);
        }
      } catch (err: any) {
        context.error(`Failed to read/parse raw blob ${blobName}: ${err.message}`);
      }
    }

    if (records.length === 0) {
      context.log(`No valid records retrieved for date: ${dateKey}. Skipping.`);
      continue;
    }

    // Convert and write to temporary Parquet file
    const tempFilePath = path.join(os.tmpdir(), `audit-${dateKey}-${Date.now()}.parquet`);
    try {
      const writer = await parquet.ParquetWriter.openFile(parquetSchema, tempFilePath);
      for (const record of records) {
        await writer.appendRow({
          timestamp: record.timestamp,
          requestId: record.requestId,
          oid: record.oid,
          applicationId: record.applicationId,
          subscriptionId: record.subscriptionId,
          deployment: record.deployment,
          model: record.model,
          promptTokens: record.promptTokens,
          completionTokens: record.completionTokens,
          totalTokens: record.totalTokens,
          responseTimeMs: record.responseTimeMs,
          statusCode: record.statusCode,
        });
      }
      await writer.close();

      // Upload Parquet to archive-log container
      const [year, month, day] = dateKey.split('-');
      const archiveBlobName = `year=${year}/month=${month}/day=${day}/audit.parquet`;
      const archiveBlobClient = archiveContainerClient.getBlockBlobClient(archiveBlobName);

      const fileBuffer = fs.readFileSync(tempFilePath);
      await archiveBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
      });
      context.log(`Archived parquet uploaded to: ${archiveBlobName}`);

      // Delete raw JSON blobs after successful archive
      for (const blobName of groups[dateKey]) {
        try {
          const blobClient = rawContainerClient.getBlobClient(blobName);
          await blobClient.delete();
        } catch (err: any) {
          context.error(`Failed to delete raw blob ${blobName}: ${err.message}`);
        }
      }
      context.log(`Successfully processed and deleted raw logs for ${dateKey}`);
    } catch (err: any) {
      context.error(`Error processing batch for ${dateKey}: ${err.message}`);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  context.log(`Timer trigger function completed.`);
}

app.timer('auditBatch', {
  schedule: '0 0 0 * * *',
  handler: auditLogBatch,
});
