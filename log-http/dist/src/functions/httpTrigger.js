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
exports.auditLogHttp = auditLogHttp;
const functions_1 = require("@azure/functions");
const storage_blob_1 = require("@azure/storage-blob");
const identity_1 = require("@azure/identity");
const appInsights = __importStar(require("applicationinsights"));
// Initialize Application Insights SDK
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights.setup().start();
}
// Client lazily initialized to speed up cold starts
let cachedBlobServiceClient = null;
function getBlobServiceClient() {
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
        cachedBlobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connStr);
    }
    else {
        // Managed Identity auth for production
        cachedBlobServiceClient = new storage_blob_1.BlobServiceClient(endpoint, new identity_1.DefaultAzureCredential());
    }
    return cachedBlobServiceClient;
}
async function auditLogHttp(request, context) {
    context.log(`Audit log HTTP trigger received a request.`);
    // 1. Authenticate Request
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.AUDIT_API_KEY;
    if (expectedApiKey && apiKey !== expectedApiKey) {
        context.warn(`Unauthorized access attempt. Invalid x-api-key.`);
        return { status: 401, body: JSON.stringify({ error: 'Unauthorized: Invalid API key.' }) };
    }
    // 2. Parse and Validate Body
    let body;
    try {
        body = (await request.json());
    }
    catch (err) {
        context.error(`Failed to parse body JSON: ${err.message}`);
        return { status: 400, body: JSON.stringify({ error: 'Invalid JSON payload.' }) };
    }
    if (!body.timestamp ||
        !body.requestId ||
        body.oid === undefined ||
        body.promptTokens === undefined ||
        body.completionTokens === undefined ||
        body.totalTokens === undefined ||
        body.responseTimeMs === undefined ||
        body.statusCode === undefined) {
        context.warn(`Validation failed. Missing required fields in audit payload.`);
        return {
            status: 400,
            body: JSON.stringify({
                error: 'Missing required audit fields. Verify timestamp, requestId, oid, promptTokens, completionTokens, totalTokens, responseTimeMs, and statusCode.',
            }),
        };
    }
    const logRecord = {
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
    }
    else {
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
    }
    catch (err) {
        context.error(`Failed to upload raw log to blob storage: ${err.message}`);
        // Non-blocking failure, return 200 as audit log is best effort at destination
    }
    return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Success', requestId: logRecord.requestId }),
    };
}
functions_1.app.http('audit', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: auditLogHttp,
});
//# sourceMappingURL=httpTrigger.js.map