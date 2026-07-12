"use strict";
/**
 * カーソルマネージャーのテスト (§28)
 *
 * テスト項目:
 * - カーソル読取り（正常系）
 * - カーソル未存在時の初期化
 * - カーソル更新
 * - 更新失敗時の再送信範囲
 */
Object.defineProperty(exports, "__esModule", { value: true });
const cursorManager_js_1 = require("../lib/cursorManager.js");
// Mock @azure/storage-blob
const mockDownload = jest.fn();
const mockUpload = jest.fn();
const mockGetBlobClient = jest.fn();
const mockGetBlockBlobClient = jest.fn();
const mockContainerClient = {
    getBlobClient: mockGetBlobClient,
    getBlockBlobClient: mockGetBlockBlobClient,
};
// Helper to create a readable stream from a string
function createReadableStream(content) {
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(Buffer.from(content));
    stream.push(null);
    return stream;
}
beforeEach(() => {
    jest.clearAllMocks();
    mockGetBlobClient.mockReturnValue({
        download: mockDownload,
    });
    mockGetBlockBlobClient.mockReturnValue({
        upload: mockUpload,
    });
});
describe('cursorManager', () => {
    describe('buildCursorBlobName', () => {
        it('should append .json to the diagnostic blob path', () => {
            const path = 'resourceId=/sub/rg/provider/name/y=2026/m=07/d=12/h=14/m=00/PT1H.json';
            expect((0, cursorManager_js_1.buildCursorBlobName)(path)).toBe(path + '.json');
        });
    });
    describe('readCursor', () => {
        it('should read existing cursor state', async () => {
            const cursorState = { offset: 12345, lastUpdated: '2026-07-12T12:00:00Z' };
            mockDownload.mockResolvedValue({
                readableStreamBody: createReadableStream(JSON.stringify(cursorState)),
            });
            const result = await (0, cursorManager_js_1.readCursor)(mockContainerClient, 'test/PT1H.json');
            expect(result.offset).toBe(12345);
            expect(result.lastUpdated).toBe('2026-07-12T12:00:00Z');
        });
        it('should return offset=0 when cursor blob does not exist (first run)', async () => {
            mockDownload.mockRejectedValue({ statusCode: 404 });
            const result = await (0, cursorManager_js_1.readCursor)(mockContainerClient, 'test/PT1H.json');
            expect(result.offset).toBe(0);
            expect(result.lastUpdated).toBe('');
        });
        it('should return offset=0 on unexpected errors (safe fallback)', async () => {
            mockDownload.mockRejectedValue(new Error('Network error'));
            const result = await (0, cursorManager_js_1.readCursor)(mockContainerClient, 'test/PT1H.json');
            expect(result.offset).toBe(0);
        });
        it('should return offset=0 when readableStreamBody is null', async () => {
            mockDownload.mockResolvedValue({ readableStreamBody: null });
            const result = await (0, cursorManager_js_1.readCursor)(mockContainerClient, 'test/PT1H.json');
            expect(result.offset).toBe(0);
        });
    });
    describe('writeCursor', () => {
        it('should write cursor state to blob', async () => {
            mockUpload.mockResolvedValue({});
            await (0, cursorManager_js_1.writeCursor)(mockContainerClient, 'test/PT1H.json', 5000);
            expect(mockGetBlockBlobClient).toHaveBeenCalledWith('test/PT1H.json.json');
            expect(mockUpload).toHaveBeenCalledTimes(1);
            // Verify the uploaded content
            const uploadedContent = mockUpload.mock.calls[0][0];
            const parsed = JSON.parse(uploadedContent);
            expect(parsed.offset).toBe(5000);
            expect(parsed.lastUpdated).toBeDefined();
        });
        it('should throw on write failure (caller handles)', async () => {
            mockUpload.mockRejectedValue(new Error('Write failed'));
            await expect((0, cursorManager_js_1.writeCursor)(mockContainerClient, 'test/PT1H.json', 5000)).rejects.toThrow('Write failed');
        });
    });
});
//# sourceMappingURL=cursorManager.test.js.map