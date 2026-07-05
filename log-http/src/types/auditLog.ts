/**
 * 型宣言ファイル: 監査ログ HTTP トリガー
 *
 * 仕様書 spec.md に基づき以下の要件を満たす型を定義する。
 *   AU-002: 利用者識別 (oid, upn, tenantId, requestId, timestamp)
 *   AU-003: LLM利用量 (promptTokens, completionTokens, totalTokens, model, deployment)
 *   可観測性: requestId, oid, model, token, responseTimeMs, statusCode
 */

// ---------------------------------------------------------------------------
// 監査ログレコード (Blob / App Insights へ保存する正規化済みデータ)
// ---------------------------------------------------------------------------

/** 受信した監査ログの全フィールドを表す型 */
export interface AuditLogRecord {
  /** ISO 8601 形式のリクエスト発生日時 (AU-002) */
  timestamp: string;

  /** APIM が付与するリクエスト追跡 ID (AU-002, 可観測性) */
  requestId: string;

  /** Entra ID の Object ID - 利用者識別に使用 (AU-002, 可観測性) */
  oid: string;

  /** User Principal Name (AU-002, 任意) */
  upn: string;

  /** Entra ID テナント ID (AU-002, 任意) */
  tenantId: string;

  /** Foundry application / API サービスの識別子 */
  applicationId: string;

  /** Azure サブスクリプション ID */
  subscriptionId: string;

  /** Foundry モデルデプロイメント名 (AU-003) */
  deployment: string;

  /** LLM モデル名 (AU-003, 可観測性) */
  model: string;

  /** プロンプトトークン数 (AU-003, 可観測性) */
  promptTokens: number;

  /** コンプリーショントークン数 (AU-003, 可観測性) */
  completionTokens: number;

  /** 合計トークン数 (AU-003, 可観測性) */
  totalTokens: number;

  /** API レスポンスタイム (ミリ秒, 可観測性) */
  responseTimeMs: number;

  /** HTTP ステータスコード (可観測性) */
  statusCode: number;
}

/** リクエストボディの部分型 (バリデーション前に使用) */
export type AuditLogPayload = Partial<AuditLogRecord>;

// ---------------------------------------------------------------------------
// 必須フィールド定義 (バリデーションに使用)
// ---------------------------------------------------------------------------

/** バリデーション必須フィールドの一覧 */
export const REQUIRED_AUDIT_FIELDS: ReadonlyArray<keyof AuditLogRecord> = [
  'timestamp',
  'requestId',
  'oid',
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'responseTimeMs',
  'statusCode',
] as const;

// ---------------------------------------------------------------------------
// 環境変数 / パラメータ設定 (シークレットを外出し)
// ---------------------------------------------------------------------------

/**
 * HTTP トリガー関数が参照する環境変数の設定インターフェース。
 * 値は process.env から読み込まれる。
 *
 * シークレット候補:
 *   - auditApiKey        : 受信リクエストの認証キー (Key Vault / App Settings で管理)
 *   - appInsightsConnStr : Application Insights 接続文字列 (Key Vault / App Settings で管理)
 *
 * 非シークレット設定:
 *   - blobEndpoint       : Blob Storage エンドポイント URL
 *   - azureWebJobsStorage: ローカル開発用ストレージ接続文字列 (ローカルのみ)
 */
export interface FunctionConfig {
  /**
   * 受信リクエストを認証する API キー。
   * 環境変数名: AUDIT_API_KEY
   * [シークレット] Azure Key Vault または Function App Settings で管理する。
   */
  auditApiKey: string | undefined;

  /**
   * Azure Blob Storage のエンドポイント URL。
   * 例: https://<account>.blob.core.windows.net
   * 環境変数名: AZURE_STORAGE_BLOB_ENDPOINT
   */
  blobEndpoint: string | undefined;

  /**
   * ローカル開発用ストレージエミュレータ接続文字列。
   * 本番環境では使用しない。
   * 環境変数名: AzureWebJobsStorage
   */
  azureWebJobsStorage: string | undefined;

  /**
   * Application Insights 接続文字列。
   * 環境変数名: APPLICATIONINSIGHTS_CONNECTION_STRING
   * [シークレット] Azure Key Vault または Function App Settings で管理する。
   */
  appInsightsConnStr: string | undefined;
}

// ---------------------------------------------------------------------------
// HTTP レスポンス型
// ---------------------------------------------------------------------------

/** 成功時のレスポンスボディ */
export interface AuditSuccessResponse {
  status: 'Success';
  requestId: string;
}

/** エラー時のレスポンスボディ */
export interface AuditErrorResponse {
  error: string;
}
