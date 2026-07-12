/**
 * processQueue のテスト (§28)
 *
 * テスト項目:
 * - 必須項目確認
 * - Analytics JSON 生成（決定論的ファイル名の冪等性）
 * - Log Analytics 送信
 * - 障害分離（Analytics → Log Analytics の順序）
 * - 例外スロー → 組み込み Poison Queue 機構
 */

jest.mock('../lib/blobClients.js', () => ({
  getBlobServiceClient: jest.fn(),
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
    logAnalyticsDceEndpoint: 'https://dce.test.com',
    logAnalyticsDcrId: 'dcr-test',
    logAnalyticsStreamName: 'Custom-Test_CL',
    azureClientId: '',
  }),
}));

jest.mock('../lib/logAnalyticsClient.js', () => ({
  sendToLogAnalytics: jest.fn(),
}));

import { processQueueHandler } from '../functions/processQueue.js';
import { getBlobServiceClient } from '../lib/blobClients.js';
import { sendToLogAnalytics } from '../lib/logAnalyticsClient.js';
import type { LogRecord } from '../lib/logRecord.js';

const mockUpload = jest.fn();
const mockGetBlockBlobClient = jest.fn().mockReturnValue({ upload: mockUpload });
const mockGetContainerClient = jest.fn().mockReturnValue({
  getBlockBlobClient: mockGetBlockBlobClient,
});

function createTestRecord(overrides?: Partial<LogRecord>): LogRecord {
  return {
    schemaVersion: '1.0',
    shareId: 'test-share-id',
    eventTime: '2026-07-12T12:00:00Z',
    httpMethod: 'POST',
    routePath: '/api/test',
    apiName: 'test-api',
    operationName: 'test-op',
    statusCode: 200,
    latencyMs: 100,
    clientIp: '10.0.0.1',
    identity: {
      subjectId: 'user-1',
      tenantId: 'tenant-1',
      userPrincipalName: 'user@test.com',
      appId: 'app-1',
    },
    source: 'apim',
    ...overrides,
  };
}

function createMockContext(): any {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getBlobServiceClient as jest.Mock).mockReturnValue({
    getContainerClient: mockGetContainerClient,
  });
  mockUpload.mockResolvedValue({});
  (sendToLogAnalytics as jest.Mock).mockResolvedValue(undefined);
});

describe('processQueue', () => {
  it('should throw on missing shareId (§14)', async () => {
    const record = createTestRecord({ shareId: '' });
    const context = createMockContext();

    await expect(
      processQueueHandler(JSON.stringify(record), context),
    ).rejects.toThrow('shareId is missing');
  });

  it('should throw on missing eventTime (§14)', async () => {
    const record = createTestRecord({ eventTime: '' });
    const context = createMockContext();

    await expect(
      processQueueHandler(JSON.stringify(record), context),
    ).rejects.toThrow('eventTime is missing');
  });

  it('should write Analytics JSON before Log Analytics (§11)', async () => {
    const record = createTestRecord();
    const context = createMockContext();
    const callOrder: string[] = [];

    mockUpload.mockImplementation(async () => {
      callOrder.push('analytics');
    });
    (sendToLogAnalytics as jest.Mock).mockImplementation(async () => {
      callOrder.push('logAnalytics');
    });

    await processQueueHandler(JSON.stringify(record), context);

    expect(callOrder).toEqual(['analytics', 'logAnalytics']);
  });

  it('should write Analytics JSON with deterministic path (§10, §16)', async () => {
    const record = createTestRecord({
      shareId: 'deterministic-uuid',
      eventTime: '2026-07-12T12:00:00Z',
    });
    const context = createMockContext();

    await processQueueHandler(JSON.stringify(record), context);

    // analytics/yyyy/MM/dd/{shareId}.json
    expect(mockGetBlockBlobClient).toHaveBeenCalledWith(
      '2026/07/12/deterministic-uuid.json',
    );
  });

  it('should be idempotent on duplicate processing (§10)', async () => {
    const record = createTestRecord({ shareId: 'same-share-id' });
    const context = createMockContext();

    // 2回処理しても同じファイルへの上書き
    await processQueueHandler(JSON.stringify(record), context);
    await processQueueHandler(JSON.stringify(record), context);

    expect(mockGetBlockBlobClient).toHaveBeenCalledTimes(2);
    // 同じパスで呼ばれている
    expect(mockGetBlockBlobClient.mock.calls[0][0]).toBe(
      mockGetBlockBlobClient.mock.calls[1][0],
    );
  });

  it('should throw when Analytics write fails (triggers retry)', async () => {
    const record = createTestRecord();
    const context = createMockContext();

    mockUpload.mockRejectedValue(new Error('Blob write failed'));

    await expect(
      processQueueHandler(JSON.stringify(record), context),
    ).rejects.toThrow('Failed to write Analytics JSON');
  });

  it('should throw when Log Analytics send fails (triggers retry)', async () => {
    const record = createTestRecord();
    const context = createMockContext();

    (sendToLogAnalytics as jest.Mock).mockRejectedValue(new Error('LA send failed'));

    await expect(
      processQueueHandler(JSON.stringify(record), context),
    ).rejects.toThrow('Failed to send to Log Analytics');

    // Analytics は正常に書き込まれている
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('should handle object-type queue message', async () => {
    const record = createTestRecord();
    const context = createMockContext();

    // Queue から直接オブジェクトとして渡される場合
    await processQueueHandler(record, context);

    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('should throw on invalid JSON queue message', async () => {
    const context = createMockContext();

    await expect(
      processQueueHandler('NOT VALID JSON', context),
    ).rejects.toThrow('Failed to parse queue message');
  });
});
