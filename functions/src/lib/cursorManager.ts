/**
 * Byte Offset カーソル管理 (§11)
 *
 * Timer Trigger による差分検知のためのカーソル状態管理。
 * カーソルは `cursor/{diagnosticBlobパス}.json` に保存する。
 *
 * - Byte Offset 方式（行番号方式は毎回Blob全体の再読込が必要で非効率なため不採用）
 * - 状態: { offset: number, lastUpdated: string }
 */

import type { ContainerClient } from '@azure/storage-blob';
import type { CursorState } from './logRecord.js';

/**
 * Diagnostic Blob パスからカーソル Blob 名を生成する。
 *
 * 例: "insights-logs-gatewaylogs/resourceId=.../y=2026/m=07/d=12/h=12/m=00/PT1H.json"
 *   → "insights-logs-gatewaylogs/resourceId=.../y=2026/m=07/d=12/h=12/m=00/PT1H.json.json"
 */
export function buildCursorBlobName(diagnosticBlobPath: string): string {
  // スラッシュやパスセパレータはそのまま保持し、拡張子 .json を付与
  return `${diagnosticBlobPath}.json`;
}

/**
 * カーソル状態を読み取る。
 * 未存在の場合は offset=0 で初期化した状態を返す（初回実行時）。
 */
export async function readCursor(
  cursorContainer: ContainerClient,
  diagnosticBlobPath: string,
): Promise<CursorState> {
  const cursorBlobName = buildCursorBlobName(diagnosticBlobPath);
  const blobClient = cursorContainer.getBlobClient(cursorBlobName);

  try {
    const downloadResponse = await blobClient.download(0);
    if (!downloadResponse.readableStreamBody) {
      return { offset: 0, lastUpdated: '' };
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf-8');
    const state = JSON.parse(body) as CursorState;
    return state;
  } catch (err: unknown) {
    // BlobNotFound は正常（初回実行）。その他のエラーは再スローしない（offset=0 で処理開始）。
    const restError = err as { statusCode?: number };
    if (restError.statusCode === 404) {
      return { offset: 0, lastUpdated: '' };
    }
    // 予期しないエラーでも offset=0 で続行（欠落は許容しない設計だが、カーソル読取失敗時は
    // 既に処理済みの範囲を再処理する方が安全）
    return { offset: 0, lastUpdated: '' };
  }
}

/**
 * カーソル状態を更新する。
 *
 * キュー送信が成功した後にのみ呼び出すこと (§11 ステップ10)。
 * キュー送信前にカーソルを進めてはならない。
 */
export async function writeCursor(
  cursorContainer: ContainerClient,
  diagnosticBlobPath: string,
  offset: number,
): Promise<void> {
  const cursorBlobName = buildCursorBlobName(diagnosticBlobPath);
  const blockBlobClient = cursorContainer.getBlockBlobClient(cursorBlobName);

  const state: CursorState = {
    offset,
    lastUpdated: new Date().toISOString(),
  };

  const content = JSON.stringify(state);
  await blockBlobClient.upload(content, Buffer.byteLength(content, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    overwriteExisting: true,
  } as any);
}
