/**
 * Function1: ingestLog (§11)
 *
 * Timer Trigger + カーソル管理方式によるAPIM Diagnostic Blobの差分読み取り。
 *
 * 採用理由:
 *   APIM Diagnostic Settings は PT1H.json を Append Blob として出力し、
 *   1時間の間継続的に追記する。Blob Trigger の blob receipt 機構では
 *   同一 Blob に対して1回しか発火しないため、追記分の大半が欠落する。
 *   そのため Timer Trigger + Byte Offset カーソル管理方式を採用する (§11)。
 *
 * 処理フロー (§11):
 *   1. 現在時刻から対象 PT1H.json のパスを特定（当該 + 直前の2時間帯）
 *   2. カーソル読取り（初回 offset=0）
 *   3. Range Download で差分取得
 *   4. 末尾改行チェック（未完成行は次回に持ち越し）
 *   5. JSON Lines 1行ずつ解析 → JWT デコード → ShareId 取得 → LogRecord 生成
 *   6. 48KB サイズ検証（超過は直接 Poison Blob）
 *   7. Storage Queue (buffer) へ送信
 *   8. カーソル更新（送信成功後のみ）
 */
import { type InvocationContext, type Timer } from '@azure/functions';
/**
 * 現在時刻を基に、対象となる PT1H.json の Blob パスリストを生成する。
 * 当該時間帯 + 直前の時間帯の2つ（時間境界をまたぐ追記漏れを防ぐため）(§11 ステップ1)。
 *
 * APIM Diagnostic Settings の出力パス例:
 *   insights-logs-gatewaylogs/resourceId=.../y=2026/m=07/d=12/h=14/m=00/PT1H.json
 *
 * 注: 実際のリソースIDパスはAPIM Diagnostic Settingsの設定に依存するため、
 *     ここではコンテナ内の Blob を列挙して PT1H.json を見つける方式を取る。
 */
declare function getTargetHourPrefixes(now: Date): string[];
/**
 * ingestLog のメインハンドラー
 */
export declare function ingestLogHandler(myTimer: Timer, context: InvocationContext): Promise<void>;
export { getTargetHourPrefixes };
