/**
 * ingestLog のテスト (§28)
 *
 * テスト項目:
 * - Diagnostic Blob 差分読み取り（オフセット以降のみ取得できること）
 * - Queue 送信
 * - メッセージサイズ超過時の Poison Blob 直接書込み
 * - カーソル読取り・更新
 * - Retry（Timer Trigger 側の Function 単位 retry）
 */
export {};
