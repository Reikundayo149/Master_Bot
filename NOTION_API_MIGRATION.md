# Notion API 2025-09-03 への移行ガイド

このプロジェクトは現在、Notion API バージョン `2022-06-28` を使用しています。
将来的に `2025-09-03` に移行する必要があります。

## 📋 現在の状況

- **使用中のSDK**: `@notionhq/client` v5.6.0 ✅
- **APIバージョン**: `2022-06-28` 
- **影響を受けるコード**: `utils/notion-calendar.mjs`, `utils/notion-sync.mjs`

## 🔄 主な変更点

### 1. Database ID → Data Source ID
- 以前: `database_id` を使用
- 新規: `data_source_id` を使用（データベースごとに複数のデータソースをサポート）

### 2. APIエンドポイントの変更
```javascript
// 旧: Query Database
POST /v1/databases/:database_id/query

// 新: Query Data Source
POST /v1/data_sources/:data_source_id/query
```

### 3. ページ作成時のparent指定
```javascript
// 旧
{
  parent: {
    type: "database_id",
    database_id: "..."
  }
}

// 新
{
  parent: {
    type: "data_source_id",
    data_source_id: "..."
  }
}
```

## 📝 移行手順（将来実施）

### Step 1: Data Source IDの取得
```javascript
const response = await notion.databases.retrieve({
  database_id: SCHEDULE_DATABASE_ID,
});

// response.data_sources[0].id を取得して保存
const dataSourceId = response.data_sources[0].id;
```

### Step 2: .envファイルの更新
```env
# 現在
NOTION_SCHEDULE_DATABASE_ID=2e7b7cac341580a0afaddb55da09e500

# 将来追加
NOTION_SCHEDULE_DATA_SOURCE_ID=xxxxx  # Step 1で取得したID
```

### Step 3: コードの更新
以下のファイルを更新：
- `utils/notion-calendar.mjs` - createEventInNotion, listEventsFromNotion
- `utils/notion-sync.mjs` - fetchNotionEvents

### Step 4: APIバージョンの変更
```javascript
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03', // ← 変更
});
```

### Step 5: テスト
1. Discordで `/schedule create` コマンドを実行
2. Notionで予定が正しく作成されることを確認
3. Notion側で予定を追加・編集・削除
4. Discord側に正しく同期されることを確認

## ⚠️ 注意事項

- **後方互換性なし**: 2025-09-03に移行すると、古いコードは動作しません
- **段階的移行**: まずdata_source_idを取得してから、APIバージョンを変更してください
- **マルチデータソース**: 今後、1つのデータベースに複数のデータソースが存在する可能性があります

## 📚 参考リンク

- [公式移行ガイド](https://developers.notion.com/docs/upgrade-guide-2025-09-03)
- [FAQ](https://developers.notion.com/docs/upgrade-faqs-2025-09-03)
- [TypeScript SDK v5リリース](https://github.com/makenotion/notion-sdk-js/releases/tag/v5.0.0)

## 🚦 移行のタイミング

**今すぐ移行する必要はありません**が、以下の場合は検討してください：

- ✅ Notionでマルチデータソース機能を使いたい
- ✅ 最新のAPI機能を利用したい
- ⚠️ Notionがユーザーに2つ目のデータソースを追加した（この場合、現在のコードはエラーになります）

現在のコードは問題なく動作しますが、将来的な機能拡張のために、この移行を計画しておくことを推奨します。
