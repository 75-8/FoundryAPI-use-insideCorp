/**
 * APIM Diagnostic JSON Lines パーサー (§7, §11)
 *
 * APIMのDiagnostic SettingsからBlobへの出力は
 * バッチされたJSON Lines形式（1行1リクエストのJSON）(§7)。
 *
 * ingestLog はこの前提で Blob 内容を1行ずつパースする。
 * 行単位でのJSON解析失敗は当該行をスキップしログ出力（§14）。
 */
import type { InvocationContext } from '@azure/functions';
import type { LogRecord } from './logRecord.js';
export interface ParsedDiagnosticLine {
    /** This line's exact byte length, including the trailing newline. */
    lineBytes: number;
    /** Converted LogRecord. Null means the line was intentionally skipped after parsing. */
    record: LogRecord | null;
}
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
export declare function parseDiagnosticData(data: Buffer, context: InvocationContext): {
    records: LogRecord[];
    processedBytes: number;
};
/**
 * Diagnostic Blob の差分データを、処理可能な行ごとのバイト長つきで解析する。
 *
 * ingestLog は Queue 送信に失敗した行の直前までしかカーソルを進めてはならないため、
 * レコード単位の成否と元の行バイト長を保持する。
 */
export declare function parseDiagnosticLines(data: Buffer, context: InvocationContext): {
    lines: ParsedDiagnosticLine[];
    processedBytes: number;
};
