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
const auditLog_1 = require("../types/auditLog");
const auditLogUtils_1 = require("./auditLogUtils");
// ---------------------------------------------------------------------------
// 環境変数の一元管理 (シークレット候補は FunctionConfig に定義済み)
// ---------------------------------------------------------------------------
/** process.env から設定値を読み込む */
function loadConfig() {
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
let cachedBlobServiceClient = null;
function getBlobServiceClient() {
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
        cachedBlobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connStr);
    }
    else {
        // Managed Identity auth for production (SEC-001, FR-004)
        cachedBlobServiceClient = new storage_blob_1.BlobServiceClient(blobEndpoint, new identity_1.DefaultAzureCredential());
    }
    return cachedBlobServiceClient;
}
// ---------------------------------------------------------------------------
// HTTP トリガーハンドラー
// ---------------------------------------------------------------------------
async function auditLogHttp(request, context) {
    context.log(`Audit log HTTP trigger received a request.`);
    // 1. Authenticate Request
    const apiKey = request.headers.get('x-api-key');
    const { auditApiKey } = config;
    if (auditApiKey && apiKey !== auditApiKey) {
        context.warn(`Unauthorized access attempt. Invalid x-api-key.`);
        const errBody = { error: 'Unauthorized: Invalid API key.' };
        return { status: 401, body: JSON.stringify(errBody) };
    }
    // 2. Parse and Validate Body
    let body;
    try {
        body = (await request.json());
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        context.error(`Failed to parse body JSON: ${message}`);
        const errBody = { error: 'Invalid JSON payload.' };
        return { status: 400, body: JSON.stringify(errBody) };
    }
    // 必須フィールドの一括バリデーション (REQUIRED_AUDIT_FIELDS を使用)
    const missingFields = auditLog_1.REQUIRED_AUDIT_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
    if (missingFields.length > 0) {
        context.warn(`Validation failed. Missing required fields: ${missingFields.join(', ')}`);
        const errBody = {
            error: `Missing required audit fields: ${missingFields.join(', ')}.`,
        };
        return { status: 400, body: JSON.stringify(errBody) };
    }
    // 型が確定しているため as キャストでレコードを構築
    const logRecord = {
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
    }
    else {
        // Fallback: default workspace diagnostic logging が拾う (AU-001)
        context.log(JSON.stringify(logRecord));
    }
    // 4. Save to Blob Storage - Raw Container (AU-001)
    try {
        const blobName = (0, auditLogUtils_1.buildBlobName)(logRecord.timestamp, logRecord.requestId);
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
        const message = err instanceof Error ? err.message : String(err);
        context.error(`Failed to upload raw log to blob storage: ${message}`);
        // Non-blocking failure — 監査ログはベストエフォートで配信する
    }
    const successBody = { status: 'Success', requestId: logRecord.requestId };
    return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successBody),
    };
}
functions_1.app.http('audit', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: auditLogHttp,
});
//# sourceMappingURL=httpTrigger.js.map