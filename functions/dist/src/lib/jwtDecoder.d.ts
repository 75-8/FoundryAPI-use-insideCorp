/**
 * JWT デコード (§9)
 *
 * APIM Diagnostic Settings の出力に含まれる JWT の payload をデコードし、
 * 利用者識別情報を抽出する。
 * 署名検証は APIM 側の validate-jwt で実施済みのため、ここでは行わない (§7)。
 */
import type { LogRecordIdentity } from './logRecord.js';
/** JWT payload の想定フィールド */
interface JwtPayload {
    oid?: string;
    sub?: string;
    tid?: string;
    upn?: string;
    preferred_username?: string;
    appid?: string;
    azp?: string;
    [key: string]: unknown;
}
/**
 * JWT トークンの payload 部分をデコードする（署名検証なし）。
 *
 * @param token JWT トークン文字列
 * @returns デコードされた payload オブジェクト。デコード失敗時は null。
 */
export declare function decodeJwtPayload(token: string): JwtPayload | null;
/**
 * JWT payload から利用者識別情報を抽出する (§9)。
 *
 * | 項目                | 取得元                      |
 * |---------------------|-----------------------------|
 * | subjectId           | oid → sub                   |
 * | tenantId            | tid                         |
 * | userPrincipalName   | upn → preferred_username    |
 * | appId               | appid → azp                 |
 *
 * @param payload JWT payload（デコード済み）
 * @returns LogRecordIdentity
 */
export declare function extractIdentity(payload: JwtPayload | null): LogRecordIdentity;
export {};
