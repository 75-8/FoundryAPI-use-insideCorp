/**
 * Function4: archiveDaily (§11, §17)
 *
 * Archive Parquet の日次バッチ生成。
 *
 * 採用理由 (§11):
 *   processQueue 内でメッセージ単位（1リクエスト=1ファイル）に Parquet を生成すると、
 *   Parquet 本来の列指向フォーマットとしての利点が活きず、ファイル数増加による
 *   トランザクションコスト増・ストレージ効率の悪化を招く。
 *   Archive は証跡保管専用でありリアルタイム性を要求しないため、日次バッチ処理へ分離。
 *
 * 処理 (§11):
 *   1. 前日分（UTC 日付）の Analytics JSON を全件列挙・取得
 *   2. 全 LogRecord を1つの Parquet ファイルにまとめる（schemaVersion 列含む）
 *   3. archive/yyyy/MM/dd/{yyyy-MM-dd}.parquet へ Archive Tier で直接アップロード
 *
 * 異常時 (§11):
 *   - Function 単位 retry ポリシー（最大3回）で再試行
 *   - それでも失敗した場合は Poison Blob に記録し、翌日以降のスケジュール実行はブロックしない
 */
import { type InvocationContext, type Timer } from '@azure/functions';
/**
 * archiveDaily のメインハンドラー
 */
export declare function archiveDailyHandler(myTimer: Timer, context: InvocationContext): Promise<void>;
