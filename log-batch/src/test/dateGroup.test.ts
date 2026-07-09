import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBlobNamesByDate } from '../functions/auditLogBatchUtils';

test('groupBlobNamesByDate groups blobs by UTC date', () => {
  const groups = groupBlobNamesByDate(['raw-log/2024/01/02/file1.json', 'raw-log/2024/01/02/file2.json']);
  assert.deepEqual(groups['2024-01-02'], ['raw-log/2024/01/02/file1.json', 'raw-log/2024/01/02/file2.json']);
});
