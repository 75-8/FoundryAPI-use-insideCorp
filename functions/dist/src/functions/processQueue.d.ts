/**
 * Function2: processQueue (§11)
 *
 * Storage Queue Trigger (buffer) で受信した LogRecord を処理する。
 *
 * 処理 (§11):
 *   1. 必須項目確認
 *   2. Analytics JSON 生成（Hot Tier, analytics/yyyy/MM/dd/{shareId}.json）を先に完了
 *   3. Analytics 書込み成功後、Log Analytics 送信
 *
 * 障害分離の方針 (§11):
 *   Analytics 書込みを常に先行させることで、Log Analytics 側の障害が
 *   Analytics（Workbook 等の可視化の主経路）に影響しない設計。
 *   Log Analytics 送信が失敗した場合のみ例外をスローし、メッセージ全体を再試行。
 *   Analytics 書込みは冪等な上書きのため再試行しても問題ない。
 *
 * 処理が失敗した場合は例外をスローし、Azure Functions の組み込み Queue Trigger
 * 再試行機構に委ねる（host.json の maxDequeueCount 回まで自動リトライ後、
 * buffer-poison キューへ自動移動。§12, §14, §15）。
 * processQueue 自身が Poison Blob への書込みを行うことはない。
 */
import { type InvocationContext } from '@azure/functions';
/**
 * processQueue のメインハンドラー
 */
export declare function processQueueHandler(queueItem: unknown, context: InvocationContext): Promise<void>;
