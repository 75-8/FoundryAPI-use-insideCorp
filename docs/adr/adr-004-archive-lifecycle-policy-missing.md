# ADR-004: Archive コンテナの 2 年間保持ポリシーが未実装

## ステータス

Accepted (未実装を認識)

## 日付

2026-07-05

## コンテキスト

仕様書 (spec.md §7) では、`archive-log` コンテナの保持期間を **2 年間** と定義している。

現在の実装では `raw-log` コンテナに対して 7 日間の Lifecycle Management ポリシーが設定されているが、`archive-log` コンテナには保持期間制御がない。

## 決定

`archive-log` コンテナには Lifecycle Management ポリシーを **未設定** とする（現時点）。

### 実装箇所

- [storage.bicep](infra/module/storage.bicep#L42-L73): `raw-log/` プレフィックスに対する 7 日削除ルールのみ定義

## Spec との差分

| 項目 | Spec | 実装 |
|------|------|------|
| `raw-log` 保持期間 | 7 日 (Lifecycle Management) | ✅ 7 日削除ルール実装済み |
| `archive-log` 保持期間 | 2 年間 | ❌ ポリシー未設定（無期限保持） |

## 理由

- 監査証跡の誤削除リスクを回避するため、手動管理を優先した可能性
- 2 年間の自動削除は、法的要件の確認後に設定する方が安全

## 推奨アクション

以下の Lifecycle Management ルールを `storage.bicep` に追加することを推奨:

```bicep
{
  enabled: true
  name: 'delete-archive-logs-after-730-days'
  type: 'Lifecycle'
  definition: {
    actions: {
      baseBlob: {
        delete: {
          daysAfterCreationGreaterThan: 730
        }
      }
    }
    filters: {
      blobTypes: ['blockBlob']
      prefixMatch: ['archive-log/']
    }
  }
}
```

## Spec 更新の必要性

実装と合わせるか、上記ルールを実装した上で Spec 通りとするか判断が必要。
