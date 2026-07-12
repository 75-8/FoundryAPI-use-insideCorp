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

import { app, type InvocationContext } from '@azure/functions';
import { loadConfig } from '../lib/config.js';
import { getBlobServiceClient } from '../lib/blobClients.js';
import { writePoisonBlob } from '../lib/poisonBlobWriter.js';

/**
 * poisonHandler のメインハンドラー
 */
export async function poisonHandlerFunction(
  queueItem: unknown,
  context: InvocationContext,
): Promise<void> {
  context.log('poisonHandler: Poison queue trigger started.');

  const config = loadConfig();

  try {
    // メッセージ内容の取得
    let rawMessage: unknown;
    let shareId = '';
    let messageId = '';

    if (typeof queueItem === 'string') {
      try {
        rawMessage = JSON.parse(queueItem);
        // LogRecord として shareId を抽出できるか試行
        if (typeof rawMessage === 'object' && rawMessage !== null && 'shareId' in rawMessage) {
          shareId = String((rawMessage as { shareId: unknown }).shareId);
        }
      } catch {
        rawMessage = queueItem;
      }
    } else {
      rawMessage = queueItem;
      if (typeof rawMessage === 'object' && rawMessage !== null && 'shareId' in rawMessage) {
        shareId = String((rawMessage as { shareId: unknown }).shareId);
      }
    }

    // Queue Trigger のコンテキストからメタデータを取得
    const dequeueCount = (context.triggerMetadata?.dequeueCount as number) ?? 0;
    messageId = String(context.triggerMetadata?.id ?? '');

    // ステップ2: Poison Blob 生成・保存 (§15)
    const blobServiceClient = getBlobServiceClient();
    const poisonContainer = blobServiceClient.getContainerClient(config.poisonContainer);

    const poisonBlobPath = await writePoisonBlob(
      poisonContainer,
      'processQueue',
      'Message exceeded maxDequeueCount and was moved to poison queue.',
      rawMessage,
      {
        shareId: shareId || undefined,
        messageId: messageId || undefined,
        exceptionType: 'MaxDequeueCountExceeded',
        retryCount: dequeueCount,
      },
    );

    context.log(`poisonHandler: Poison blob saved to ${poisonBlobPath}`);

    // ステップ3: Application Insights への構造化エラーログ出力 (§11, §15)
    // context.error() で出力し、Azure Monitor Alert Rule の発火条件として利用 (§30)
    context.error(
      JSON.stringify({
        event: 'PoisonBlobCreated',
        poisonBlobPath: `${config.poisonContainer}/${poisonBlobPath}`,
        functionName: 'processQueue',
        errorType: 'MaxDequeueCountExceeded',
        shareId: shareId || null,
        messageId: messageId || null,
        dequeueCount,
      }),
    );
  } catch (err) {
    // poisonHandler 自体の失敗はログ出力のみ（無限ループ防止）(§11)
    context.error(
      `poisonHandler: CRITICAL - Failed to process poison message: ${err instanceof Error ? err.message : String(err)}`,
    );
    // 例外は再スローしない → Poison の Poison を防ぐ
  }

  context.log('poisonHandler: Poison queue trigger completed.');
}

/**
 * Queue Trigger 登録 (§11)
 *
 * buffer-poison は Azure Functions ランタイムが自動生成する組み込み Poison Queue (§12)。
 * ユーザー側でのプロビジョニングは不要。
 */
app.storageQueue('poisonHandler', {
  queueName: 'buffer-poison',
  connection: '',
  handler: poisonHandlerFunction,
});
