// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
// Schedule and Azure DB integrations removed per user request.
// Schedule-specific imports removed to disable schedule features.

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
let __clientReadyHandled = false;
function handleClientReady() {
	if (__clientReadyHandled) return;
	__clientReadyHandled = true;
	console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
	console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
	// Schedule/reminder service disabled (removed by cleanup)
	// startReminders removed to avoid Azure/DB dependency
}

// 新しいイベント名 'clientReady' に対応しつつ、互換性のため 'ready' も受け付ける
client.on('clientReady', handleClientReady);
client.on('ready', handleClientReady);

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
    // If the interaction is part of the removed schedule feature, reply briefly and stop.
    try {
        const cid = interaction.customId;
        if (cid && typeof cid === 'string' && (cid.startsWith('sched') || cid.startsWith('sched_panel'))) {
            try { await interaction.reply({ content: 'このサーバーではスケジュール機能は無効化されています。', flags: 64 }); } catch (e) {}
            return;
        }
        if (interaction.isModalSubmit && interaction.customId && (interaction.customId.startsWith('sched') || interaction.customId.startsWith('sched_edit'))) {
            try { await interaction.reply({ content: 'このサーバーではスケジュール機能は無効化されています。', flags: 64 }); } catch (e) {}
            return;
        }
    } catch (guardErr) {
        // ignore
    }

    // Only handle slash/chat commands here; other interaction types are not used by core bot.
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    // 安全な reply/followUp を動的にラップして注入する
    const origReply = interaction.reply.bind(interaction);
    const origFollowUp = interaction.followUp ? interaction.followUp.bind(interaction) : null;
    interaction.reply = async (options) => {
        try {
            return await origReply(options);
        } catch (err) {
            try {
                if (interaction.deferred) {
                    return await interaction.editReply(options);
                }
                if (interaction.replied && origFollowUp) {
                    return await origFollowUp(options);
                }
            } catch (err2) {}
            throw err;
        }
    };
    if (origFollowUp) {
        interaction.followUp = async (options) => {
            try {
                return await origFollowUp(options);
            } catch (err) {
                try {
                    if (interaction.replied) return await origFollowUp(options);
                    if (interaction.deferred) return await interaction.editReply(options);
                } catch (err2) {}
                throw err;
            }
        };
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('コマンド実行中のエラー:', error);
        try {
            if (interaction.replied || interaction.deferred) {
                try { await interaction.followUp({ content: 'エラーが発生しました。', flags: 64 }); } catch { try { await interaction.editReply({ content: 'エラーが発生しました。' }); } catch {} }
            } else {
                try { await interaction.reply({ content: 'エラーが発生しました。', flags: 64 }); } catch { try { await interaction.channel?.send?.('エラーが発生しました。'); } catch {} }
            }
        } catch (err) {
            try { await interaction.channel?.send?.('エラーが発生しました（返信できませんでした）。'); } catch (err2) { console.error('返信フォールバックに失敗しました:', err2); }
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