"use strict";
/**
 * APIM Diagnostic JSON Lines パーサー (§7, §11)
 *
 * APIMのDiagnostic SettingsからBlobへの出力は
 * バッチされたJSON Lines形式（1行1リクエストのJSON）(§7)。
 *
 * ingestLog はこの前提で Blob 内容を1行ずつパースする。
 * 行単位でのJSON解析失敗は当該行をスキップしログ出力（§14）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDiagnosticData = parseDiagnosticData;
const logRecord_js_1 = require("./logRecord.js");
const jwtDecoder_js_1 = require("./jwtDecoder.js");
/**
 * Diagnostic Blob から取得した差分データ（バイト列）をJSON Linesとして解析し、
 * 最後の完全な改行位置までを処理する。
 *
 * @param data 差分バイトデータ（UTF-8文字列として解釈）
 * @param context ログ出力用の InvocationContext
 * @returns { records: LogRecord[], processedBytes: number }
 *   - records: 解析成功した LogRecord の配列
 *   - processedBytes: 処理したバイト数（カーソル更新に使用）
 */
function parseDiagnosticData(data, context) {
    const text = data.toString('utf-8');
    const records = [];
    // 末尾が改行で終わっていない場合、未完成な最終行は今回処理しない (§11)
    const lastNewlineIndex = text.lastIndexOf('\n');
    if (lastNewlineIndex === -1) {
        // 改行が1つもない → 処理対象なし（次回に持ち越し）
        return { records: [], processedBytes: 0 };
    }
    const processableText = text.substring(0, lastNewlineIndex + 1);
    const processedBytes = Buffer.byteLength(processableText, 'utf-8');
    const lines = processableText.split('\n').filter((line) => line.trim().length > 0);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        try {
            const entry = JSON.parse(line);
            const record = convertToLogRecord(entry);
            if (record) {
                records.push(record);
            }
        }
        catch (err) {
            // 行単位でのJSON解析失敗は当該行をスキップし処理継続 (§14)
            context.warn(`Skipping malformed JSON line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return { records, processedBytes };
}
/**
 * Diagnostic Log エントリを LogRecord に変換する。
 *
 * shareId は APIM が x-ms-share-id として付与する (§7)。
 * apiName / operationName は APIM 標準フィールドをそのまま使用 (§10)。
 */
function convertToLogRecord(entry) {
    const props = entry.properties ?? {};
    // shareId の取得: request-headers から x-ms-share-id を抽出
    const shareId = extractShareId(props['request-headers'] ?? '');
    // eventTime (§10): APIM の time フィールド
    const eventTime = entry.time ?? '';
    // shareId または eventTime が欠落している場合は異常とみなす (§14)
    if (!shareId || !eventTime) {
        return null;
    }
    // URL から routePath を抽出
    const routePath = extractRoutePath(String(props.url ?? ''));
    // JWT デコード（署名検証なし）(§7, §9)
    const jwtToken = String(props.jwtToken ?? '');
    const jwtPayload = jwtToken ? (0, jwtDecoder_js_1.decodeJwtPayload)(jwtToken) : null;
    const identity = (0, jwtDecoder_js_1.extractIdentity)(jwtPayload);
    return {
        schemaVersion: logRecord_js_1.CURRENT_SCHEMA_VERSION,
        shareId,
        eventTime,
        httpMethod: String(props.method ?? ''),
        routePath,
        apiName: String(props.apiId ?? ''),
        operationName: String(entry.operationId ?? props.operationId ?? ''),
        statusCode: typeof props.responseCode === 'number' ? props.responseCode : null,
        latencyMs: typeof props.elapsed === 'number' ? props.elapsed : null,
        clientIp: String(props.clientIp ?? ''),
        identity,
        source: 'apim',
    };
}
/**
 * request-headers 文字列から x-ms-share-id を抽出する。
 */
function extractShareId(headersStr) {
    if (!headersStr)
        return '';
    // APIM Diagnostic の headers は "key1=value1;key2=value2" 形式、
    // または JSON 文字列の場合がある
    try {
        const parsed = JSON.parse(headersStr);
        if (typeof parsed === 'object' && parsed !== null) {
            return String(parsed['x-ms-share-id'] ?? parsed['X-Ms-Share-Id'] ?? '');
        }
    }
    catch {
        // JSON でない場合、セミコロン区切りで解析
    }
    // "key: value" 形式のヘッダー文字列をパース
    const match = headersStr.match(/x-ms-share-id\s*[:=]\s*([^\s;,]+)/i);
    return match ? match[1] : '';
}
/**
 * URL 文字列からパス部分を抽出する。
 */
function extractRoutePath(url) {
    if (!url)
        return '';
    try {
        const parsed = new URL(url);
        return parsed.pathname;
    }
    catch {
        // URL パースに失敗した場合はそのまま返す
        return url;
    }
}
//# sourceMappingURL=diagnosticParser.js.map