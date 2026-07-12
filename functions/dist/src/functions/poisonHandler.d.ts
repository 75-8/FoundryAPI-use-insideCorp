/**
 * Function3: poisonHandler (§11, §15)
 *
 * Azure Functions の Storage Queue Trigger が maxDequeueCount 回失敗すると、
 * 自動的に buffer-poison キューへメッセージを移動する。
 * この移動をトリガーとして Poison Blob への保存と通知を行う。
 *
 * 処理 (§11):
 *   1. buffer-poison キューのメッセージを受信
 *   2. §15 の Poison Blob フォーマットへマッピング・保存
 *   3. Application Insights へ構造化エラーログ出力
 *
 * poisonHandler 自体の処理が失敗した場合:
 *   - ログ出力のみに留め処理を継続
 *   - Poison Blob の Poison Blob という無限ループを防ぐ (§11)
 */
import { type InvocationContext } from '@azure/functions';
/**
 * poisonHandler のメインハンドラー
 */
export declare function poisonHandlerFunction(queueItem: unknown, context: InvocationContext): Promise<void>;
