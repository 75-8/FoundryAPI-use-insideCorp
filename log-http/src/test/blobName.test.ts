import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBlobName } from '../functions/auditLogUtils';

test('buildBlobName uses UTC date parts for blob paths', () => {
  assert.equal(buildBlobName('2024-01-02T03:04:05.000Z', 'req-123'), 'raw-log/2024/01/02/req-123.json');
});
