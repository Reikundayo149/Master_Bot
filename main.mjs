// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
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
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

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
    // Handle schedule UI interactions (buttons / modals) before chat input commands
    try {
        if (interaction.isButton && interaction.isButton()) {
            const cid = interaction.customId;
            if (cid && cid.startsWith('sched')) {
                // Handle create button
                if (cid === 'sched:create') {
                    const modal = new ModalBuilder().setCustomId('sched:create:modal').setTitle('スケジュール作成');
                    const titleInput = new TextInputBuilder().setCustomId('title').setLabel('タイトル').setStyle(TextInputStyle.Short).setRequired(true);
                    const datetimeInput = new TextInputBuilder().setCustomId('datetime').setLabel('日時 (YYYY-MM-DD HH:MM or ISO)').setStyle(TextInputStyle.Short).setRequired(true);
                    const descInput = new TextInputBuilder().setCustomId('description').setLabel('説明 (任意)').setStyle(TextInputStyle.Paragraph).setRequired(false);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(titleInput),
                        new ActionRowBuilder().addComponents(datetimeInput),
                        new ActionRowBuilder().addComponents(descInput),
                    );
                    try { await interaction.showModal(modal); } catch (e) { console.error('modal show failed:', e); }
                    return;
                }
                if (cid === 'sched:list') {
                    // Let the command that created the panel handle reloading, but as a fallback reply ephemeral
                    try { await interaction.reply({ content: '一覧を更新しました。パネルコマンドを再実行してください。', flags: 64 }); } catch (e) {}
                    return;
                }
            }
        }

        if (interaction.isModalSubmit && interaction.customId && interaction.customId.startsWith('sched:create')) {
            // Handle modal submit for schedule creation
            try {
                const title = interaction.fields.getTextInputValue('title');
                const datetimeRaw = interaction.fields.getTextInputValue('datetime');
                const description = interaction.fields.getTextInputValue('description') || '';
                let dt = new Date(datetimeRaw);
                if (isNaN(dt.getTime())) dt = new Date(datetimeRaw.replace(' ', 'T'));
                if (isNaN(dt.getTime())) {
                    try { await interaction.reply({ content: '無効な日時形式です。', flags: 64 }); } catch (e) {}
                    return;
                }
                const { createSchedule } = await import('./utils/scheduleStore.mjs');
                const schedule = await createSchedule({ guildId: interaction.guildId, title, datetime: dt.toISOString(), description, creatorId: interaction.user.id });
                const { EmbedBuilder } = await import('discord.js');
                const embed = new EmbedBuilder().setTitle('✅ スケジュールを作成しました').addFields(
                    { name: 'タイトル', value: schedule.title },
                    { name: '日時', value: new Date(schedule.datetime).toLocaleString() },
                    { name: 'ID', value: schedule.id },
                ).setTimestamp();
                try { await interaction.reply({ embeds: [embed], flags: 64 }); } catch (e) { console.error('reply failed:', e); }
            } catch (err) {
                console.error('modal submit error:', err);
                try { await interaction.reply({ content: 'スケジュール作成に失敗しました。', flags: 64 }); } catch (e) {}
            }
            return;
        }
    } catch (uiErr) {
        console.error('schedule UI handler error:', uiErr);
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
            // If interaction is already expired/unknown, ignore instead of throwing.
            try {
                if (err && err.code === 10062) {
                    console.warn('Unknown interaction when replying — ignored.');
                    return null;
                }
            } catch (e) {}
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
                // If the interaction has not been replied to or deferred, prefer sending a reply
                if (!interaction.replied && !interaction.deferred) {
                    return await origReply(options);
                }
                return await origFollowUp(options);
            } catch (err) {
                // Ignore unknown interaction errors from followUp
                try {
                    if (err && err.code === 10062) {
                        console.warn('Unknown interaction when followUp — ignored.');
                        return null;
                    }
                } catch (e) {}
                try {
                    if (interaction.deferred) return await interaction.editReply(options);
                    if (interaction.replied) return await origFollowUp(options);
                } catch (err2) {}
                throw err;
            }
        };
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('コマンド実行中のエラー:', error);
        // Robust fallback sequence: prefer editReply if deferred, origFollowUp if already replied,
        // otherwise try origReply, then channel send as last resort.
        try {
            if (interaction.deferred) {
                try { await interaction.editReply({ content: 'エラーが発生しました。' }); return; } catch (e) { console.error('editReply failed:', e); }
            }

            if (interaction.replied && origFollowUp) {
                try { await origFollowUp({ content: 'エラーが発生しました。', flags: 64 }); return; } catch (e) { console.error('origFollowUp failed:', e); }
            }

            // If not deferred/replied, try to reply normally
            try { await origReply({ content: 'エラーが発生しました。', flags: 64 }); return; } catch (rErr) { console.error('origReply failed:', rErr); }

            // As a last resort, post to the channel if available
            try { await interaction.channel?.send?.('エラーが発生しました。'); } catch (chErr) { console.error('チャンネル送信にも失敗しました:', chErr); }
        } catch (finalErr) {
            console.error('エラー返信の全フォールバックに失敗しました:', finalErr);
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
    // Ensure `client.commands` collection exists and load command modules from the `commands` directory.
    // Defines `loadCommands` here if it was accidentally removed.
    async function loadCommands() {
        client.commands = new Collection();
        const commandsPath = path.join(process.cwd(), 'commands');
        if (!fs.existsSync(commandsPath)) {
            console.warn('⚠️ commands ディレクトリが見つかりません:', commandsPath);
            return;
        }
        const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.mjs'));
        for (const file of files) {
            try {
                const full = path.join(commandsPath, file);
                const mod = await import(pathToFileURL(full).href);
                const cmd = mod.default || mod;
                if (cmd && cmd.data && cmd.data.name) {
                    client.commands.set(cmd.data.name, cmd);
                    console.log(`✅ コマンドをロードしました: ${cmd.data.name}`);
                } else {
                    console.warn('⚠️ コマンドが正しい構造ではありません:', file);
                }
            } catch (err) {
                console.error('コマンドの読み込みに失敗しました:', file, err);
            }
        }
    }

    // Load commands then login
    try {
        await loadCommands();
    } catch (err) {
        console.error('loadCommands 実行中にエラーが発生しました:', err);
    }
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