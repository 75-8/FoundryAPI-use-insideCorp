/**
 * Poison Blob 書込み (§15)
 *
 * 生成経路:
 * - poisonHandler (Function3): buffer-poison キューのメッセージを受信し生成
 * - ingestLog (Function1): メッセージサイズ超過時に直接生成
 * - archiveDaily (Function4): 処理失敗時に生成
 *
 * 保存先: poison/{functionName}/{errorTime}_{shareIdまたはmessageId}.json (§10)
 * 保持: 14日 (§27)。再処理対象ではない。
 */
import type { ContainerClient } from '@azure/storage-blob';
/**
 * Poison Blob を生成・保存する。
 *
 * @param poisonContainer Poison Blob コンテナクライアント
 * @param functionName 元の失敗元 Function 名
 * @param errorMessage エラーメッセージ
 * @param rawMessage 元のメッセージ内容
 * @param options 追加オプション
 */
export declare function writePoisonBlob(poisonContainer: ContainerClient, functionName: string, errorMessage: string, rawMessage: unknown, options?: {
    shareId?: string;
    messageId?: string;
    exceptionType?: string;
    stackTrace?: string;
    retryCount?: number;
}): Promise<string>;
