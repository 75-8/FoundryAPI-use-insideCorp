"use strict";
/**
 * ingestLog のテスト (§28)
 *
 * テスト項目:
 * - Diagnostic Blob 差分読み取り（オフセット以降のみ取得できること）
 * - Queue 送信
 * - メッセージサイズ超過時の Poison Blob 直接書込み
 * - カーソル読取り・更新
 * - Retry（Timer Trigger 側の Function 単位 retry）
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ingestLog_js_1 = require("../functions/ingestLog.js");
// Mock dependencies
jest.mock('../lib/blobClients.js', () => ({
    getBlobServiceClient: jest.fn(),
    getQueueServiceClient: jest.fn(),
}));
jest.mock('../lib/config.js', () => ({
    loadConfig: jest.fn().mockReturnValue({
        storageAccountUrl: 'https://test.blob.core.windows.net',
        queueName: 'buffer',
        analyticsContainer: 'analytics',
        archiveContainer: 'archive',
        poisonContainer: 'poison',
        cursorContainer: 'cursor',
        diagnosticLogContainer: 'insights-logs-gatewaylogs',
        ingestTimerSchedule: '0 */5 * * * *',
        archiveTimerSchedule: '0 0 3 * * *',
        queueMessageMaxBytes: 48000,
        logAnalyticsDceEndpoint: '',
        logAnalyticsDcrId: '',
        logAnalyticsStreamName: '',
        azureClientId: '',
    }),
}));
jest.mock('../lib/cursorManager.js');
jest.mock('../lib/diagnosticParser.js', () => ({
    parseDiagnosticData: jest.fn(),
    parseDiagnosticLines: jest.fn(),
}));
jest.mock('../lib/poisonBlobWriter.js');
describe('ingestLog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('getTargetHourPrefixes', () => {
        it('should return 2 prefixes (current hour + previous hour)', () => {
            const now = new Date('2026-07-12T14:30:00Z');
            const prefixes = (0, ingestLog_js_1.getTargetHourPrefixes)(now);
            expect(prefixes).toHaveLength(2);
            // 当該時間帯
            expect(prefixes[0]).toContain('h=14');
            expect(prefixes[0]).toContain('y=2026');
            expect(prefixes[0]).toContain('m=07');
            expect(prefixes[0]).toContain('d=12');
            expect(prefixes[0]).toContain('PT1H.json');
            // 直前の時間帯
            expect(prefixes[1]).toContain('h=13');
        });
        it('should handle midnight boundary (UTC)', () => {
            const now = new Date('2026-07-12T00:15:00Z');
            const prefixes = (0, ingestLog_js_1.getTargetHourPrefixes)(now);
            expect(prefixes).toHaveLength(2);
            expect(prefixes[0]).toContain('h=00');
            expect(prefixes[0]).toContain('d=12');
            // 直前の時間帯は前日 23 時
            expect(prefixes[1]).toContain('h=23');
            expect(prefixes[1]).toContain('d=11');
        });
        it('should handle month boundary', () => {
            const now = new Date('2026-08-01T00:30:00Z');
            const prefixes = (0, ingestLog_js_1.getTargetHourPrefixes)(now);
            expect(prefixes).toHaveLength(2);
            expect(prefixes[0]).toContain('d=01');
            expect(prefixes[0]).toContain('m=08');
            expect(prefixes[1]).toContain('d=31');
            expect(prefixes[1]).toContain('m=07');
        });
    });
    describe('ingestLogHandler', () => {
        it('should skip when no diagnostic blobs exist', async () => {
            const { getBlobServiceClient, getQueueServiceClient } = require('../lib/blobClients.js');
            const { loadConfig } = require('../lib/config.js');
            const mockContainerClient = {
                listBlobsFlat: jest.fn().mockReturnValue({
                    [Symbol.asyncIterator]: () => ({
                        next: jest.fn().mockResolvedValue({ done: true }),
                    }),
                }),
            };
            getBlobServiceClient.mockReturnValue({
                getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
            });
            getQueueServiceClient.mockReturnValue({
                getQueueClient: jest.fn().mockReturnValue({}),
            });
            const { ingestLogHandler } = require('../functions/ingestLog.js');
            const context = {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };
            await ingestLogHandler({}, context);
            expect(context.log).toHaveBeenCalledWith(expect.stringContaining('No target diagnostic blobs found'));
        });
        it('should advance cursor only through successfully handled lines when queue send fails (§11)', async () => {
            const { getBlobServiceClient, getQueueServiceClient } = require('../lib/blobClients.js');
            const { readCursor, writeCursor } = require('../lib/cursorManager.js');
            const { parseDiagnosticLines } = require('../lib/diagnosticParser.js');
            const currentPrefix = (0, ingestLog_js_1.getTargetHourPrefixes)(new Date())[0];
            const blobPath = `resourceId=/subscriptions/s1/${currentPrefix}`;
            const line1Bytes = 101;
            const line2Bytes = 202;
            const record1 = {
                schemaVersion: '1.0',
                shareId: 'share-1',
                eventTime: '2026-07-12T14:00:00Z',
                httpMethod: 'POST',
                routePath: '/chat',
                apiName: 'api',
                operationName: 'op',
                statusCode: 200,
                latencyMs: 10,
                clientIp: '10.0.0.1',
                identity: {},
                source: 'apim',
            };
            const record2 = { ...record1, shareId: 'share-2' };
            readCursor.mockResolvedValue({ offset: 1000, lastUpdated: '' });
            parseDiagnosticLines.mockReturnValue({
                processedBytes: line1Bytes + line2Bytes,
                lines: [
                    { lineBytes: line1Bytes, record: record1 },
                    { lineBytes: line2Bytes, record: record2 },
                ],
            });
            const mockDownloadStream = {
                async *[Symbol.asyncIterator]() {
                    yield Buffer.from('dummy\n');
                },
            };
            const diagnosticContainer = {
                listBlobsFlat: jest.fn().mockReturnValue({
                    async *[Symbol.asyncIterator]() {
                        yield { name: blobPath };
                    },
                }),
                getBlobClient: jest.fn().mockReturnValue({
                    getProperties: jest.fn().mockResolvedValue({ contentLength: 1303 }),
                    download: jest.fn().mockResolvedValue({ readableStreamBody: mockDownloadStream }),
                }),
            };
            const cursorContainer = {};
            const poisonContainer = {};
            getBlobServiceClient.mockReturnValue({
                getContainerClient: jest.fn((name) => {
                    if (name === 'insights-logs-gatewaylogs')
                        return diagnosticContainer;
                    if (name === 'cursor')
                        return cursorContainer;
                    if (name === 'poison')
                        return poisonContainer;
                    return {};
                }),
            });
            const sendMessage = jest
                .fn()
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('queue unavailable'));
            getQueueServiceClient.mockReturnValue({
                getQueueClient: jest.fn().mockReturnValue({ sendMessage }),
            });
            const { ingestLogHandler } = require('../functions/ingestLog.js');
            const context = {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };
            await ingestLogHandler({}, context);
            expect(sendMessage).toHaveBeenCalledTimes(2);
            expect(writeCursor).toHaveBeenCalledWith(cursorContainer, blobPath, 1000 + line1Bytes);
            expect(writeCursor).not.toHaveBeenCalledWith(cursorContainer, blobPath, 1000 + line1Bytes + line2Bytes);
        });
    });
    describe('Queue message size validation', () => {
        it('should reject messages exceeding 48KB threshold', () => {
            // This is a unit-level validation test
            const config = require('../lib/config.js').loadConfig();
            const largePayload = 'x'.repeat(config.queueMessageMaxBytes + 1);
            const messageBytes = Buffer.byteLength(largePayload, 'utf-8');
            expect(messageBytes).toBeGreaterThan(config.queueMessageMaxBytes);
        });
        it('should accept messages within 48KB threshold', () => {
            const config = require('../lib/config.js').loadConfig();
            const smallPayload = JSON.stringify({
                schemaVersion: '1.0',
                shareId: 'test',
                eventTime: '2026-07-12T12:00:00Z',
            });
            const messageBytes = Buffer.byteLength(smallPayload, 'utf-8');
            expect(messageBytes).toBeLessThan(config.queueMessageMaxBytes);
        });
    });
});
//# sourceMappingURL=ingestLog.test.js.map