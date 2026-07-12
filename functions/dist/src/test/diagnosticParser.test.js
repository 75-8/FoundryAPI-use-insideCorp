"use strict";
/**
 * Diagnostic パーサーのテスト (§28)
 *
 * テスト項目:
 * - JSON Lines 解析
 * - 不完全な末尾行の処理（次回持ち越し）
 * - JSON解析失敗時のスキップ
 * - ShareId 取得
 * - null 補完
 */
Object.defineProperty(exports, "__esModule", { value: true });
const diagnosticParser_js_1 = require("../lib/diagnosticParser.js");
// Mock InvocationContext
function createMockContext() {
    return {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    };
}
function createDiagnosticLine(overrides) {
    const entry = {
        time: '2026-07-12T12:00:00Z',
        operationId: 'op-123',
        properties: {
            method: 'POST',
            url: 'https://apim.example.com/openai/deployments/gpt-4/chat/completions',
            apiId: 'azure-openai-api',
            operationId: 'ChatCompletions_Create',
            responseCode: 200,
            elapsed: 1500,
            clientIp: '10.0.0.1',
            'request-headers': JSON.stringify({ 'x-ms-share-id': 'share-uuid-123' }),
            jwtToken: createMinimalJwt(),
            ...overrides,
        },
    };
    return JSON.stringify(entry);
}
function createMinimalJwt() {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        oid: 'user-oid',
        tid: 'tenant-id',
        upn: 'user@example.com',
        appid: 'app-id',
    })).toString('base64url');
    return `${header}.${payload}.signature`;
}
describe('diagnosticParser', () => {
    describe('parseDiagnosticData', () => {
        it('should parse a single complete line', () => {
            const line = createDiagnosticLine();
            const data = Buffer.from(line + '\n');
            const context = createMockContext();
            const { records, processedBytes } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(1);
            expect(records[0].shareId).toBe('share-uuid-123');
            expect(records[0].httpMethod).toBe('POST');
            expect(records[0].statusCode).toBe(200);
            expect(records[0].latencyMs).toBe(1500);
            expect(records[0].schemaVersion).toBe('1.0');
            expect(records[0].source).toBe('apim');
            expect(processedBytes).toBe(data.length);
        });
        it('should parse multiple lines', () => {
            const lines = [
                createDiagnosticLine(),
                createDiagnosticLine({ responseCode: 404 }),
                createDiagnosticLine({ responseCode: 500 }),
            ];
            const data = Buffer.from(lines.join('\n') + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(3);
            expect(records[0].statusCode).toBe(200);
            expect(records[1].statusCode).toBe(404);
            expect(records[2].statusCode).toBe(500);
        });
        it('should not process incomplete last line (§11)', () => {
            const completeLine = createDiagnosticLine();
            const incompleteLine = '{"incomplete": true';
            const data = Buffer.from(completeLine + '\n' + incompleteLine);
            const context = createMockContext();
            const { records, processedBytes } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            // 完全な行のみ処理される
            expect(records).toHaveLength(1);
            // processedBytes は改行までのバイト数
            expect(processedBytes).toBe(Buffer.byteLength(completeLine + '\n'));
        });
        it('should return 0 processedBytes when no newline exists', () => {
            const data = Buffer.from('{"no": "newline"}');
            const context = createMockContext();
            const { records, processedBytes } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(0);
            expect(processedBytes).toBe(0);
        });
        it('should skip malformed JSON lines and continue (§14)', () => {
            const lines = [
                createDiagnosticLine(),
                'THIS IS NOT JSON',
                createDiagnosticLine({ responseCode: 201 }),
            ];
            const data = Buffer.from(lines.join('\n') + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(2);
            expect(records[0].statusCode).toBe(200);
            expect(records[1].statusCode).toBe(201);
            expect(context.warn).toHaveBeenCalled();
        });
        it('should skip lines without shareId (§14)', () => {
            const lineWithoutShareId = JSON.stringify({
                time: '2026-07-12T12:00:00Z',
                properties: {
                    method: 'GET',
                    responseCode: 200,
                    // no request-headers with x-ms-share-id
                },
            });
            const data = Buffer.from(lineWithoutShareId + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(0);
        });
        it('should handle empty data', () => {
            const data = Buffer.from('');
            const context = createMockContext();
            const { records, processedBytes } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(0);
            expect(processedBytes).toBe(0);
        });
        it('should extract identity from JWT (§9)', () => {
            const line = createDiagnosticLine();
            const data = Buffer.from(line + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records[0].identity.subjectId).toBe('user-oid');
            expect(records[0].identity.tenantId).toBe('tenant-id');
            expect(records[0].identity.userPrincipalName).toBe('user@example.com');
            expect(records[0].identity.appId).toBe('app-id');
        });
        it('should handle null responseCode (§13)', () => {
            const entry = {
                time: '2026-07-12T12:00:00Z',
                properties: {
                    method: 'POST',
                    url: 'https://example.com/api',
                    'request-headers': JSON.stringify({ 'x-ms-share-id': 'share-123' }),
                    // responseCode is missing
                },
            };
            const data = Buffer.from(JSON.stringify(entry) + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(1);
            expect(records[0].statusCode).toBeNull();
            expect(records[0].latencyMs).toBeNull();
        });
        it('should extract shareId from semicolon-delimited headers', () => {
            const entry = {
                time: '2026-07-12T12:00:00Z',
                properties: {
                    method: 'POST',
                    url: 'https://example.com/api',
                    'request-headers': 'content-type: application/json; x-ms-share-id: share-456; accept: */*',
                },
            };
            const data = Buffer.from(JSON.stringify(entry) + '\n');
            const context = createMockContext();
            const { records } = (0, diagnosticParser_js_1.parseDiagnosticData)(data, context);
            expect(records).toHaveLength(1);
            expect(records[0].shareId).toBe('share-456');
        });
    });
});
//# sourceMappingURL=diagnosticParser.test.js.map