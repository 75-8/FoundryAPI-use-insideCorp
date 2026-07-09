"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBlobName = buildBlobName;
function buildBlobName(timestamp, requestId) {
    const date = new Date(timestamp);
    const isValidDate = !Number.isNaN(date.getTime());
    const year = isValidDate ? date.getUTCFullYear() : new Date().getUTCFullYear();
    const month = String((isValidDate ? date.getUTCMonth() : new Date().getUTCMonth()) + 1).padStart(2, '0');
    const day = String(isValidDate ? date.getUTCDate() : new Date().getUTCDate()).padStart(2, '0');
    return `raw-log/${year}/${month}/${day}/${requestId}.json`;
}
//# sourceMappingURL=auditLogUtils.js.map