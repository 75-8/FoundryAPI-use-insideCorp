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
 * Base64url エンコードされた文字列をデコードする。
 */
function base64UrlDecode(str: string): string {
  // Base64url → Base64 変換
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // パディング補完
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * JWT トークンの payload 部分をデコードする（署名検証なし）。
 *
 * @param token JWT トークン文字列
 * @returns デコードされた payload オブジェクト。デコード失敗時は null。
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payloadStr = base64UrlDecode(parts[1]);
    return JSON.parse(payloadStr) as JwtPayload;
  } catch {
    return null;
  }
}

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
export function extractIdentity(payload: JwtPayload | null): LogRecordIdentity {
  if (!payload) {
    return {
      subjectId: '',
      tenantId: '',
      userPrincipalName: '',
      appId: '',
    };
  }

  return {
    subjectId: String(payload.oid ?? payload.sub ?? ''),
    tenantId: String(payload.tid ?? ''),
    userPrincipalName: String(payload.upn ?? payload.preferred_username ?? ''),
    appId: String(payload.appid ?? payload.azp ?? ''),
  };
}
