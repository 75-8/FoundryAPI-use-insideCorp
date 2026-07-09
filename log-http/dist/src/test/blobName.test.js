"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const auditLogUtils_1 = require("../functions/auditLogUtils");
(0, node_test_1.test)('buildBlobName uses UTC date parts for blob paths', () => {
    strict_1.default.equal((0, auditLogUtils_1.buildBlobName)('2024-01-02T03:04:05.000Z', 'req-123'), 'raw-log/2024/01/02/req-123.json');
});
//# sourceMappingURL=blobName.test.js.map