"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePoisonBlob = writePoisonBlob;
/**
 * Poison Blob を生成・保存する。
 *
 * @param poisonContainer Poison Blob コンテナクライアント
 * @param functionName 元の失敗元 Function 名
 * @param errorMessage エラーメッセージ
 * @param rawMessage 元のメッセージ内容
 * @param options 追加オプション
 */
async function writePoisonBlob(poisonContainer, functionName, errorMessage, rawMessage, options) {
    const now = new Date();
    const errorTime = now.toISOString();
    // ファイル名の識別子: shareId > messageId > タイムスタンプ
    const identifier = options?.shareId
        ?? options?.messageId
        ?? now.getTime().toString();
    // ISO文字列からファイル名に使えない文字を除去
    const safeErrorTime = errorTime.replace(/[:.]/g, '-');
    const blobPath = `${functionName}/${safeErrorTime}_${identifier}.json`;
    const record = {
        errorTime,
        retryCount: options?.retryCount ?? 0,
        functionName,
        exceptionType: options?.exceptionType ?? 'Error',
        errorMessage,
        stackTrace: options?.stackTrace ?? '',
        rawMessage,
    };
    const content = JSON.stringify(record, null, 2);
    const blockBlobClient = poisonContainer.getBlockBlobClient(blobPath);
    await blockBlobClient.upload(content, Buffer.byteLength(content, 'utf-8'), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    return blobPath;
}
//# sourceMappingURL=poisonBlobWriter.js.map