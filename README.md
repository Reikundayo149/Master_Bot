# Master-Bot
軽量な Discord ボットのテンプレートです。

## 必要条件
- Node.js 18+ がインストールされていること
- Discord アプリケーションと Bot を作成済みであること

## ローカルセットアップ
1. リポジトリをクローン
2. 依存関係をインストール

```powershell
npm install
```

3. `.env` を作成（※コミットしないでください）:

```
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
CLIENT_ID=YOUR_CLIENT_ID_HERE
GUILD_ID=YOUR_GUILD_ID_HERE
PORT=3000
```

4. スラッシュコマンドを登録（テスト用はギルド登録がおすすめ）:

```powershell
node deploy-commands.mjs
```

5. ボットを起動:

```powershell
node main.mjs
```

## Render にデプロイする手順（Free プラン想定）
1. Render にログインして新しい Web Service を作成（静的ではなく `Web Service` を選択）。
2. リポジトリを接続し、ブランチを選択（`main` など）。
3. `Build Command` は空欄、`Start Command` に `node main.mjs` を指定。
4. 環境変数を設定（Render の `Environment` セクション）:
	- `DISCORD_TOKEN`: 発行した Bot トークン
	- `CLIENT_ID`: アプリケーションID
	- `GUILD_ID`: （開発中はテストギルドIDを入れると便利）
	- `PORT`: 省略可（Render が指定する場合は不要）
5. 保存してデプロイ。デプロイ後、Render のログで Bot の起動メッセージを確認してください。

## スラッシュコマンドの追加方法
1. `commands/` に新しい `.mjs` ファイルを追加し、`export default { data: new SlashCommandBuilder()..., execute(interaction) {...} }` の形を守ってください。
2. `deploy-commands.mjs` を実行してコマンドを登録します。

## 既知の注意点
- `.env` はコミットしないでください（`.gitignore` に含まれています）。
- トークンが漏洩した場合は Discord Developer Portal で即座にトークンをリセットしてください。

---

開発者: Reikundayo149

