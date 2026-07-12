/**
 * archiveDaily のテスト (§28)
 *
 * テスト項目:
 * - 前日分 Analytics JSON の列挙・集約
 * - Parquet 変換・Archive Tier アップロード
 * - 処理失敗時の Poison Blob 記録
 * - 翌日スケジュールがブロックされないこと
 */

jest.mock('../lib/blobClients.js', () => ({
  getBlobServiceClient: jest.fn(),
}));

jest.mock('../lib/config.js', () => ({
  loadConfig: jest.fn().mockReturnValue({
    storageAccountUrl: 'https://test.blob.core.windows.net',
    analyticsContainer: 'analytics',
    archiveContainer: 'archive',
    poisonContainer: 'poison',
  }),
}));

jest.mock('../lib/parquetWriter.js', () => ({
  convertToParquetBuffer: jest.fn(),
  uploadParquetToArchive: jest.fn(),
}));

jest.mock('../lib/poisonBlobWriter.js', () => ({
  writePoisonBlob: jest.fn(),
}));

import { archiveDailyHandler } from '../functions/archiveDaily.js';
import { getBlobServiceClient } from '../lib/blobClients.js';
import { convertToParquetBuffer, uploadParquetToArchive } from '../lib/parquetWriter.js';
import { writePoisonBlob } from '../lib/poisonBlobWriter.js';

// Helper to create async iterator from array
function createAsyncIterator<T>(items: T[]) {
  let index = 0;
  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (index < items.length) {
          return { value: items[index++], done: false };
        }
        return { value: undefined, done: true };
      },
    }),
  };
}

function createReadableStream(content: string): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(Buffer.from(content));
  stream.push(null);
  return stream;
}

function createMockContext(): any {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

const mockUpload = jest.fn();
const mockGetBlockBlobClient = jest.fn().mockReturnValue({ upload: mockUpload });
const mockDownload = jest.fn();
const mockGetBlobClient = jest.fn().mockReturnValue({ download: mockDownload });

beforeEach(() => {
  jest.clearAllMocks();

  // Set "yesterday" for consistent testing
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-13T03:00:00Z'));

  (convertToParquetBuffer as jest.Mock).mockResolvedValue(Buffer.from('parquet-data'));
  (uploadParquetToArchive as jest.Mock).mockResolvedValue(undefined);
  (writePoisonBlob as jest.Mock).mockResolvedValue('archiveDaily/2026-07-12.json');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('archiveDaily', () => {
  it('should process previous day analytics and create Parquet (§17)', async () => {
    const record = {
      schemaVersion: '1.0',
      shareId: 'share-1',
      eventTime: '2026-07-12T12:00:00Z',
      httpMethod: 'POST',
      routePath: '/api/test',
      apiName: 'test-api',
      operationName: 'test-op',
      statusCode: 200,
      latencyMs: 100,
      clientIp: '10.0.0.1',
      identity: { subjectId: 'u', tenantId: 't', userPrincipalName: 'u@t.com', appId: 'a' },
      source: 'apim',
    };

    const analyticsContainer = {
      listBlobsFlat: jest.fn().mockReturnValue(
        createAsyncIterator([
          { name: '2026/07/12/share-1.json' },
          { name: '2026/07/12/share-2.json' },
        ]),
      ),
      getBlobClient: jest.fn().mockReturnValue({
        download: jest.fn().mockImplementation(() =>
          Promise.resolve({
            readableStreamBody: createReadableStream(JSON.stringify(record)),
          })
        ),
      }),
    };

    const archiveContainer = {
      getBlockBlobClient: mockGetBlockBlobClient,
    };

    const poisonContainer = {};

    (getBlobServiceClient as jest.Mock).mockReturnValue({
      getContainerClient: jest.fn().mockImplementation((name: string) => {
        if (name === 'analytics') return analyticsContainer;
        if (name === 'archive') return archiveContainer;
        return poisonContainer;
      }),
    });

    const context = createMockContext();
    await archiveDailyHandler({} as any, context);

    // Parquet 変換が呼ばれた
    expect(convertToParquetBuffer).toHaveBeenCalledTimes(1);
    const passedRecords = (convertToParquetBuffer as jest.Mock).mock.calls[0][0];
    expect(passedRecords).toHaveLength(2);

    // Archive Tier アップロードが呼ばれた
    expect(uploadParquetToArchive).toHaveBeenCalledTimes(1);

    // パスが正しい: archive/yyyy/MM/dd/{yyyy-MM-dd}.parquet
    expect(mockGetBlockBlobClient).toHaveBeenCalledWith('2026/07/12/2026-07-12.parquet');
  });

  it('should skip when no analytics records exist', async () => {
    const analyticsContainer = {
      listBlobsFlat: jest.fn().mockReturnValue(createAsyncIterator([])),
      getBlobClient: jest.fn(),
    };

    (getBlobServiceClient as jest.Mock).mockReturnValue({
      getContainerClient: jest.fn().mockReturnValue(analyticsContainer),
    });

    const context = createMockContext();
    await archiveDailyHandler({} as any, context);

    expect(convertToParquetBuffer).not.toHaveBeenCalled();
    expect(context.log).toHaveBeenCalledWith(
      expect.stringContaining('No analytics records found'),
    );
  });

  it('should write Poison Blob on failure and NOT block next schedule (§11)', async () => {
    const analyticsContainer = {
      listBlobsFlat: jest.fn().mockReturnValue(
        createAsyncIterator([{ name: '2026/07/12/share-1.json' }]),
      ),
      getBlobClient: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue({
          readableStreamBody: createReadableStream('{"shareId":"s"}'),
        }),
      }),
    };

    (getBlobServiceClient as jest.Mock).mockReturnValue({
      getContainerClient: jest.fn().mockImplementation((name: string) => {
        if (name === 'analytics') return analyticsContainer;
        return {};
      }),
    });

    // Parquet 変換失敗
    (convertToParquetBuffer as jest.Mock).mockRejectedValue(new Error('Parquet conversion failed'));

    const context = createMockContext();

    // 例外が再スローされない（翌日がブロックされない）
    await expect(archiveDailyHandler({} as any, context)).resolves.toBeUndefined();

    // Poison Blob に記録される
    expect(writePoisonBlob).toHaveBeenCalledTimes(1);
    expect(writePoisonBlob).toHaveBeenCalledWith(
      expect.anything(),
      'archiveDaily',
      expect.stringContaining('Parquet conversion failed'),
      expect.objectContaining({ date: '2026-07-12' }),
      expect.anything(),
    );
  });

  it('should handle individual blob read failures gracefully', async () => {
    const analyticsContainer = {
      listBlobsFlat: jest.fn().mockReturnValue(
        createAsyncIterator([
          { name: '2026/07/12/good.json' },
          { name: '2026/07/12/bad.json' },
        ]),
      ),
      getBlobClient: jest.fn().mockImplementation((name: string) => {
        if (name.includes('bad')) {
          return {
            download: jest.fn().mockRejectedValue(new Error('Read error')),
          };
        }
        return {
          download: jest.fn().mockResolvedValue({
            readableStreamBody: createReadableStream(JSON.stringify({
              schemaVersion: '1.0',
              shareId: 'good',
              eventTime: '2026-07-12T12:00:00Z',
            })),
          }),
        };
      }),
    };

    (getBlobServiceClient as jest.Mock).mockReturnValue({
      getContainerClient: jest.fn().mockImplementation((name: string) => {
        if (name === 'analytics') return analyticsContainer;
        if (name === 'archive') return { getBlockBlobClient: mockGetBlockBlobClient };
        return {};
      }),
    });

    const context = createMockContext();
    await archiveDailyHandler({} as any, context);

    // 1件は成功して Parquet 変換される
    expect(convertToParquetBuffer).toHaveBeenCalledTimes(1);
    const records = (convertToParquetBuffer as jest.Mock).mock.calls[0][0];
    expect(records).toHaveLength(1);

    // 失敗した Blob についてのログ出力
    expect(context.warn).toHaveBeenCalledWith(
      expect.stringContaining('bad.json'),
    );
  });
});
