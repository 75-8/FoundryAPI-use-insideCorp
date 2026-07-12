"use strict";
/**
 * JWT デコーダーのテスト (§28)
 *
 * テスト項目:
 * - JWT解析
 * - ShareId取得
 * - §9 の identity 項目抽出（oid→sub, tid, upn→preferred_username, appid→azp）
 */
Object.defineProperty(exports, "__esModule", { value: true });
const jwtDecoder_js_1 = require("../lib/jwtDecoder.js");
// テスト用 JWT payload を Base64url エンコードする
function createTestJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = 'test-signature';
    return `${header}.${body}.${signature}`;
}
describe('jwtDecoder', () => {
    describe('decodeJwtPayload', () => {
        it('should decode a valid JWT payload', () => {
            const token = createTestJwt({ oid: 'user-123', tid: 'tenant-456' });
            const payload = (0, jwtDecoder_js_1.decodeJwtPayload)(token);
            expect(payload).not.toBeNull();
            expect(payload.oid).toBe('user-123');
            expect(payload.tid).toBe('tenant-456');
        });
        it('should return null for invalid JWT format (not 3 parts)', () => {
            expect((0, jwtDecoder_js_1.decodeJwtPayload)('not-a-jwt')).toBeNull();
            expect((0, jwtDecoder_js_1.decodeJwtPayload)('only.two')).toBeNull();
            expect((0, jwtDecoder_js_1.decodeJwtPayload)('')).toBeNull();
        });
        it('should return null for invalid Base64 payload', () => {
            expect((0, jwtDecoder_js_1.decodeJwtPayload)('header.!!!invalid!!!.signature')).toBeNull();
        });
        it('should handle Base64url padding correctly', () => {
            // payload が4の倍数でない長さの場合
            const payload = { sub: 'test' };
            const token = createTestJwt(payload);
            const result = (0, jwtDecoder_js_1.decodeJwtPayload)(token);
            expect(result).not.toBeNull();
            expect(result.sub).toBe('test');
        });
    });
    describe('extractIdentity', () => {
        it('should extract identity with primary fields (oid, tid, upn, appid)', () => {
            const payload = {
                oid: 'oid-value',
                tid: 'tid-value',
                upn: 'user@example.com',
                appid: 'app-123',
            };
            const identity = (0, jwtDecoder_js_1.extractIdentity)(payload);
            expect(identity.subjectId).toBe('oid-value');
            expect(identity.tenantId).toBe('tid-value');
            expect(identity.userPrincipalName).toBe('user@example.com');
            expect(identity.appId).toBe('app-123');
        });
        it('should fallback to secondary fields (sub, preferred_username, azp)', () => {
            const payload = {
                sub: 'sub-value',
                tid: 'tid-value',
                preferred_username: 'preferred@example.com',
                azp: 'azp-123',
            };
            const identity = (0, jwtDecoder_js_1.extractIdentity)(payload);
            expect(identity.subjectId).toBe('sub-value');
            expect(identity.tenantId).toBe('tid-value');
            expect(identity.userPrincipalName).toBe('preferred@example.com');
            expect(identity.appId).toBe('azp-123');
        });
        it('should prefer oid over sub', () => {
            const payload = { oid: 'oid-value', sub: 'sub-value' };
            const identity = (0, jwtDecoder_js_1.extractIdentity)(payload);
            expect(identity.subjectId).toBe('oid-value');
        });
        it('should prefer upn over preferred_username', () => {
            const payload = { upn: 'upn-value', preferred_username: 'preferred-value' };
            const identity = (0, jwtDecoder_js_1.extractIdentity)(payload);
            expect(identity.userPrincipalName).toBe('upn-value');
        });
        it('should prefer appid over azp', () => {
            const payload = { appid: 'appid-value', azp: 'azp-value' };
            const identity = (0, jwtDecoder_js_1.extractIdentity)(payload);
            expect(identity.appId).toBe('appid-value');
        });
        it('should return empty strings for null payload', () => {
            const identity = (0, jwtDecoder_js_1.extractIdentity)(null);
            expect(identity.subjectId).toBe('');
            expect(identity.tenantId).toBe('');
            expect(identity.userPrincipalName).toBe('');
            expect(identity.appId).toBe('');
        });
        it('should return empty strings for missing fields', () => {
            const identity = (0, jwtDecoder_js_1.extractIdentity)({});
            expect(identity.subjectId).toBe('');
            expect(identity.tenantId).toBe('');
            expect(identity.userPrincipalName).toBe('');
            expect(identity.appId).toBe('');
        });
    });
});
//# sourceMappingURL=jwtDecoder.test.js.map