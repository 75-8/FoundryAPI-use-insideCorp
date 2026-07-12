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
export declare function buildCursorBlobName(diagnosticBlobPath: string): string;
/**
 * カーソル状態を読み取る。
 * 未存在の場合は offset=0 で初期化した状態を返す（初回実行時）。
 */
export declare function readCursor(cursorContainer: ContainerClient, diagnosticBlobPath: string): Promise<CursorState>;
/**
 * カーソル状態を更新する。
 *
 * キュー送信が成功した後にのみ呼び出すこと (§11 ステップ10)。
 * キュー送信前にカーソルを進めてはならない。
 */
export declare function writeCursor(cursorContainer: ContainerClient, diagnosticBlobPath: string, offset: number): Promise<void>;
