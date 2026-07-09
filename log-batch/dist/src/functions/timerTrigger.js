"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogBatch = auditLogBatch;
const functions_1 = require("@azure/functions");
const storage_blob_1 = require("@azure/storage-blob");
const identity_1 = require("@azure/identity");
const appInsights = __importStar(require("applicationinsights"));
const parquet = __importStar(require("@dsnp/parquetjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const auditLogBatchUtils_1 = require("./auditLogBatchUtils");
// Initialize Application Insights SDK
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights.setup().start();
}
let cachedBlobServiceClient = null;
function getBlobServiceClient() {
    if (cachedBlobServiceClient) {
        return cachedBlobServiceClient;
    }
    const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
    if (!endpoint) {
        throw new Error('AZURE_STORAGE_BLOB_ENDPOINT environment variable is missing.');
    }
    if (endpoint.startsWith('http://127.0.0.1') || endpoint.includes('localhost')) {
        const connStr = process.env.AzureWebJobsStorage || 'UseDevelopmentStorage=true';
        cachedBlobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connStr);
    }
    else {
        cachedBlobServiceClient = new storage_blob_1.BlobServiceClient(endpoint, new identity_1.DefaultAzureCredential());
    }
    return cachedBlobServiceClient;
}
// Helper to download stream as string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data.toString());
        });
        readableStream.on('end', () => {
            resolve(chunks.join(''));
        });
        readableStream.on('error', reject);
    });
}
async function auditLogBatch(myTimer, context) {
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
    const blobs = [];
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
    const groups = (0, auditLogBatchUtils_1.groupBlobNamesByDate)(blobs);
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
        const records = [];
        // Download and parse all JSON files in the group
        for (const blobName of groups[dateKey]) {
            try {
                const blobClient = rawContainerClient.getBlobClient(blobName);
                const downloadResponse = await blobClient.download();
                if (downloadResponse.readableStreamBody) {
                    const bodyStr = await streamToString(downloadResponse.readableStreamBody);
                    const record = JSON.parse(bodyStr);
                    records.push(record);
                }
            }
            catch (err) {
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
                }
                catch (err) {
                    context.error(`Failed to delete raw blob ${blobName}: ${err.message}`);
                }
            }
            context.log(`Successfully processed and deleted raw logs for ${dateKey}`);
        }
        catch (err) {
            context.error(`Error processing batch for ${dateKey}: ${err.message}`);
        }
        finally {
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                }
                catch (e) {
                    // ignore
                }
            }
        }
    }
    context.log(`Timer trigger function completed.`);
}
functions_1.app.timer('auditBatch', {
    schedule: '0 0 0 * * *',
    handler: auditLogBatch,
});
//# sourceMappingURL=timerTrigger.js.map