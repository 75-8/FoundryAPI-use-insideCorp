"use strict";
/**
 * LogRecord 型・変換のテスト (§28)
 *
 * テスト項目:
 * - JSON生成
 * - null補完
 * - schemaVersion の存在確認
 * - Log Analytics レコード変換
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logRecord_js_1 = require("../lib/logRecord.js");
function createTestLogRecord(overrides) {
    return {
        schemaVersion: logRecord_js_1.CURRENT_SCHEMA_VERSION,
        shareId: 'test-share-id-uuid',
        eventTime: '2026-07-12T12:00:00Z',
        httpMethod: 'POST',
        routePath: '/openai/deployments/gpt-4/chat/completions',
        apiName: 'azure-openai-api',
        operationName: 'ChatCompletions_Create',
        statusCode: 200,
        latencyMs: 1500,
        clientIp: '10.0.0.1',
        identity: {
            subjectId: 'user-oid-123',
            tenantId: 'tenant-456',
            userPrincipalName: 'user@contoso.com',
            appId: 'app-789',
        },
        source: 'apim',
        ...overrides,
    };
}
describe('logRecord', () => {
    describe('CURRENT_SCHEMA_VERSION', () => {
        it('should be "1.0"', () => {
            expect(logRecord_js_1.CURRENT_SCHEMA_VERSION).toBe('1.0');
        });
    });
    describe('LogRecord structure', () => {
        it('should include schemaVersion in JSON output', () => {
            const record = createTestLogRecord();
            const json = JSON.parse(JSON.stringify(record));
            expect(json.schemaVersion).toBe('1.0');
        });
        it('should allow null for statusCode (§13)', () => {
            const record = createTestLogRecord({ statusCode: null });
            expect(record.statusCode).toBeNull();
        });
        it('should allow null for latencyMs (§13)', () => {
            const record = createTestLogRecord({ latencyMs: null });
            expect(record.latencyMs).toBeNull();
        });
        it('should preserve all identity fields', () => {
            const record = createTestLogRecord();
            expect(record.identity.subjectId).toBe('user-oid-123');
            expect(record.identity.tenantId).toBe('tenant-456');
            expect(record.identity.userPrincipalName).toBe('user@contoso.com');
            expect(record.identity.appId).toBe('app-789');
        });
        it('should set source to "apim"', () => {
            const record = createTestLogRecord();
            expect(record.source).toBe('apim');
        });
    });
    describe('toLogAnalyticsRecord', () => {
        it('should map LogRecord to Log Analytics Custom Table format (§19)', () => {
            const record = createTestLogRecord();
            const laRecord = (0, logRecord_js_1.toLogAnalyticsRecord)(record);
            expect(laRecord.TimeGenerated).toBe('2026-07-12T12:00:00Z');
            expect(laRecord.SchemaVersion).toBe('1.0');
            expect(laRecord.ShareId).toBe('test-share-id-uuid');
            expect(laRecord.SubjectId).toBe('user-oid-123');
            expect(laRecord.TenantId).toBe('tenant-456');
            expect(laRecord.UserPrincipalName).toBe('user@contoso.com');
            expect(laRecord.AppId).toBe('app-789');
            expect(laRecord.ApiName).toBe('azure-openai-api');
            expect(laRecord.OperationName).toBe('ChatCompletions_Create');
            expect(laRecord.Method).toBe('POST');
            expect(laRecord.Route).toBe('/openai/deployments/gpt-4/chat/completions');
            expect(laRecord.StatusCode).toBe(200);
            expect(laRecord.LatencyMs).toBe(1500);
            expect(laRecord.ClientIp).toBe('10.0.0.1');
            expect(laRecord.Source).toBe('apim');
            expect(laRecord.CreatedAt).toBeDefined();
        });
        it('should handle null statusCode and latencyMs', () => {
            const record = createTestLogRecord({ statusCode: null, latencyMs: null });
            const laRecord = (0, logRecord_js_1.toLogAnalyticsRecord)(record);
            expect(laRecord.StatusCode).toBeNull();
            expect(laRecord.LatencyMs).toBeNull();
        });
    });
});
//# sourceMappingURL=logRecord.test.js.map