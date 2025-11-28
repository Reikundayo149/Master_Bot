// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// .envファイルから環境変数を読み込み
dotenv.config();

// Discord Botクライアントを作成
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,            // サーバー情報取得
		GatewayIntentBits.GuildMessages,     // メッセージ取得
		GatewayIntentBits.MessageContent,    // メッセージ内容取得
		GatewayIntentBits.GuildMembers,      // メンバー情報取得
	],
});

client.commands = new Collection();

// コマンドをロード
async function loadCommands() {
	const commandsPath = path.join(process.cwd(), 'commands');
	if (!fs.existsSync(commandsPath)) return;
	const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.mjs'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		try {
			const { default: command } = await import(pathToFileURL(filePath).href);
			if (command?.data?.name && command?.execute) {
				client.commands.set(command.data.name, command);
			}
		} catch (err) {
			console.error(`コマンド読み込み中にエラー: ${file}`, err);
		}
	}
}

// Botが起動完了したときの処理
client.once('ready', () => {
	console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
	console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
});

// メッセージが送信されたときの処理（従来のテキストコマンド対応）
client.on('messageCreate', (message) => {
	if (message.author.bot) return;
	if (message.content.toLowerCase() === 'ping') {
		message.reply('🏓 pong!');
		console.log(`📝 ${message.author.tag} が ping コマンドを使用`);
	}
});

// スラッシュコマンド（インタラクション）処理
client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = client.commands.get(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error('コマンド実行中のエラー:', error);
		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'エラーが発生しました。', flags: 64 });
			} else {
				await interaction.reply({ content: 'エラーが発生しました。', flags: 64 });
			}
		} catch (err) {
			// ここで Unknown interaction (10062) などが発生する場合があるため、フォールバックを試みる
			try {
				await interaction.followUp({ content: 'エラーが発生しました（返信できませんでした）。', flags: 64 });
			} catch (err2) {
				console.error('返信フォールバックに失敗しました:', err2);
			}
		}
	}
});

// エラーハンドリング
client.on('error', (error) => {
    console.error('❌ Discord クライアントエラー:', error);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
    console.log('🛑 Botを終了しています...');
    client.destroy();
    process.exit(0);
});

// Discord にログイン
if (!process.env.DISCORD_TOKEN) {
	console.error('❌ DISCORD_TOKEN が環境変数に設定されていません！');
	process.exit(1);
}

(async () => {
	await loadCommands();
	console.log('🔄 Discord に接続中...');
	client.login(process.env.DISCORD_TOKEN)
		.catch(error => {
			console.error('❌ ログインに失敗しました:', error);
			process.exit(1);
		});
})();

// Express Webサーバーの設定（Render用）
const app = express();
const port = process.env.PORT || 3000;

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running! 🤖',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// サーバー起動
app.listen(port, () => {
    console.log(`🌐 Web サーバーがポート ${port} で起動しました`);
});