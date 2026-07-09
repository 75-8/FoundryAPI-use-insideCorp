"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const auditLogBatchUtils_1 = require("../functions/auditLogBatchUtils");
(0, node_test_1.test)('groupBlobNamesByDate groups blobs by UTC date', () => {
    const groups = (0, auditLogBatchUtils_1.groupBlobNamesByDate)(['raw-log/2024/01/02/file1.json', 'raw-log/2024/01/02/file2.json']);
    strict_1.default.deepEqual(groups['2024-01-02'], ['raw-log/2024/01/02/file1.json', 'raw-log/2024/01/02/file2.json']);
});
//# sourceMappingURL=dateGroup.test.js.map