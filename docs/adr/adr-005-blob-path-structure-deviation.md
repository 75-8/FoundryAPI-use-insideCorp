# ADR-005: Blob パス構造の仕様差分

## ステータス

Accepted

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §7) では、Raw JSON の Blob パスを以下のように定義している:

```
raw-log/          ← コンテナ名
    2026/
        07/
            01/
                xxxx.json
```

ファイル名は `xxxx.json` と記載されており、具体的な命名規則は未指定。

## 決定

### Raw パス

コンテナ `raw-log` に対して、Blob 名を `raw-log/YYYY/MM/DD/{requestId}.json` としている。

- [httpTrigger.ts](log-http/src/functions/httpTrigger.ts#L147-L149): `const blobName = 'raw-log/${year}/${month}/${day}/${logRecord.requestId}.json'`
- コンテナ名 `raw-log` の下に `raw-log/` プレフィックスが付くため、実質的なパスは `raw-log` (container) → `raw-log/2026/07/01/xxx.json` (blob) となる

### Archive パス

仕様書通りの Hive パーティション形式を採用:

- [timerTrigger.ts](log-batch/src/functions/timerTrigger.ts#L191): `year=${year}/month=${month}/day=${day}/audit.parquet`

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| Raw blob 名 | `raw-log/YYYY/MM/DD/xxxx.json` | `raw-log/YYYY/MM/DD/{requestId}.json` |
| Raw blob プレフィックス重複 | なし (仕様上はコンテナ直下) | コンテナ `raw-log` + パス `raw-log/...` で重複 |
| ファイル名 | `xxxx.json` (未指定) | `{requestId}.json` |
| Archive パス | `year=YYYY/month=MM/day=DD/audit.parquet` | ✅ 仕様通り |

## 影響

- `raw-log/raw-log/2026/07/01/` という二重プレフィックス構造になる
- Lifecycle Management のフィルタが `raw-log/` プレフィックスで設定されているため、動作上の問題はない
- Timer Trigger 側の日付グルーピングで `parts[0] === 'raw-log'` をチェックしているため整合性は保たれている

## Spec 更新の必要性

コンテナ内のパス構造を明確にし、ファイル名を `{requestId}.json` と明記すべき。
