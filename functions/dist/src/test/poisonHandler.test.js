"use strict";
/**
 * poisonHandler のテスト (§28)
 *
 * テスト項目:
 * - buffer-poison キュー受信時の Poison Blob 生成
 * - Application Insights 構造化ログ出力
 * - 自身の失敗時にログ出力のみ（無限ループ防止）
 */
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../lib/blobClients.js', () => ({
    getBlobServiceClient: jest.fn(),
}));
jest.mock('../lib/config.js', () => ({
    loadConfig: jest.fn().mockReturnValue({
        storageAccountUrl: 'https://test.blob.core.windows.net',
        poisonContainer: 'poison',
    }),
}));
jest.mock('../lib/poisonBlobWriter.js', () => ({
    writePoisonBlob: jest.fn(),
}));
const poisonHandler_js_1 = require("../functions/poisonHandler.js");
const blobClients_js_1 = require("../lib/blobClients.js");
const poisonBlobWriter_js_1 = require("../lib/poisonBlobWriter.js");
const mockGetContainerClient = jest.fn().mockReturnValue({});
function createMockContext(overrides) {
    return {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        triggerMetadata: {
            dequeueCount: 3,
            id: 'msg-id-123',
            ...overrides,
        },
    };
}
beforeEach(() => {
    jest.clearAllMocks();
    blobClients_js_1.getBlobServiceClient.mockReturnValue({
        getContainerClient: mockGetContainerClient,
    });
    poisonBlobWriter_js_1.writePoisonBlob.mockResolvedValue('processQueue/2026-07-12_share-123.json');
});
describe('poisonHandler', () => {
    it('should create Poison Blob from poison queue message (§15)', async () => {
        const record = { shareId: 'share-123', eventTime: '2026-07-12T12:00:00Z' };
        const context = createMockContext();
        await (0, poisonHandler_js_1.poisonHandlerFunction)(JSON.stringify(record), context);
        expect(poisonBlobWriter_js_1.writePoisonBlob).toHaveBeenCalledTimes(1);
        expect(poisonBlobWriter_js_1.writePoisonBlob).toHaveBeenCalledWith(expect.anything(), // poisonContainer
        'processQueue', // functionName
        expect.any(String), // errorMessage
        record, // rawMessage (parsed)
        expect.objectContaining({
            shareId: 'share-123',
            messageId: 'msg-id-123',
            exceptionType: 'MaxDequeueCountExceeded',
            retryCount: 3,
        }));
    });
    it('should output structured error log for Alert Rule (§15)', async () => {
        const record = { shareId: 'share-456' };
        const context = createMockContext();
        await (0, poisonHandler_js_1.poisonHandlerFunction)(JSON.stringify(record), context);
        // context.error が構造化エラーログで呼ばれている
        expect(context.error).toHaveBeenCalledTimes(1);
        const logOutput = context.error.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);
        expect(parsed.event).toBe('PoisonBlobCreated');
        expect(parsed.functionName).toBe('processQueue');
        expect(parsed.errorType).toBe('MaxDequeueCountExceeded');
        expect(parsed.shareId).toBe('share-456');
        expect(parsed.poisonBlobPath).toContain('poison/');
    });
    it('should handle non-JSON string message', async () => {
        const context = createMockContext();
        await (0, poisonHandler_js_1.poisonHandlerFunction)('plain text message', context);
        expect(poisonBlobWriter_js_1.writePoisonBlob).toHaveBeenCalledTimes(1);
        // rawMessage は文字列そのまま
        const rawMessage = poisonBlobWriter_js_1.writePoisonBlob.mock.calls[0][3];
        expect(rawMessage).toBe('plain text message');
    });
    it('should handle object-type queue message', async () => {
        const record = { shareId: 'obj-share', statusCode: 500 };
        const context = createMockContext();
        await (0, poisonHandler_js_1.poisonHandlerFunction)(record, context);
        expect(poisonBlobWriter_js_1.writePoisonBlob).toHaveBeenCalledTimes(1);
    });
    it('should NOT throw on its own failure (prevent infinite loop) (§11)', async () => {
        const context = createMockContext();
        // writePoisonBlob が失敗しても例外は再スローされない
        poisonBlobWriter_js_1.writePoisonBlob.mockRejectedValue(new Error('Blob write failed'));
        // 例外が発生しないことを確認
        await expect((0, poisonHandler_js_1.poisonHandlerFunction)('test', context)).resolves.toBeUndefined();
        // エラーログは出力される
        expect(context.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL'));
    });
    it('should extract shareId from LogRecord in queue message', async () => {
        const record = { shareId: 'extracted-share-id', eventTime: '2026-07-12T12:00:00Z' };
        const context = createMockContext();
        await (0, poisonHandler_js_1.poisonHandlerFunction)(JSON.stringify(record), context);
        const options = poisonBlobWriter_js_1.writePoisonBlob.mock.calls[0][4];
        expect(options.shareId).toBe('extracted-share-id');
    });
    it('should use messageId when shareId is not available', async () => {
        const context = createMockContext();
        // shareId がないメッセージ
        await (0, poisonHandler_js_1.poisonHandlerFunction)(JSON.stringify({ data: 'no-share-id' }), context);
        const options = poisonBlobWriter_js_1.writePoisonBlob.mock.calls[0][4];
        expect(options.shareId).toBeUndefined();
        expect(options.messageId).toBe('msg-id-123');
    });
});
//# sourceMappingURL=poisonHandler.test.js.map