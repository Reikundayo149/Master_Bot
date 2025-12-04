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
                    // Try to update the original panel message in-place with the refreshed list
                    try {
                        const { listSchedules } = await import('./utils/scheduleStore.mjs');
                        const schedules = await listSchedules(interaction.guildId);
                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = await import('discord.js');
                        const listText = (!schedules || schedules.length === 0) ? 'スケジュールは登録されていません。' : schedules.slice(0,10).map(s => `• ${s.title} — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`).join('\n');
                        const embed = new EmbedBuilder().setTitle('🧭 スケジュール管理パネル').setDescription(listText).setTimestamp();
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
                        );
                        // interaction.update edits the message that had the buttons
                        try {
                            await interaction.update({ embeds: [embed], components: [row] });
                        } catch (updErr) {
                            // If update fails (e.g., interaction expired), fallback to ephemeral reply
                            console.warn('パネル更新に失敗しました、フォールバックします:', updErr);
                            try { await interaction.reply({ content: '一覧の更新に失敗しました。再度 /schedule panel を実行してください。', flags: 64 }); } catch (e) {}
                        }
                    } catch (e) {
                        console.error('sched:list handler error:', e);
                        try { await interaction.reply({ content: '一覧の取得中にエラーが発生しました。', flags: 64 }); } catch (r) {}
                    }
                    return;
                }
                // Edit button with id: sched:edit:<id>
                if (cid.startsWith('sched:edit:')) {
                    const parts = cid.split(':');
                    const sid = parts[2];
                    try {
                        const { getSchedule } = await import('./utils/scheduleStore.mjs');
                        const s = await getSchedule(sid);
                        if (!s) {
                            try { await interaction.reply({ content: 'スケジュールが見つかりません。', flags: 64 }); } catch (e) {}
                            return;
                        }
                        // Show modal prefilled
                        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
                        const modal = new ModalBuilder().setCustomId(`sched:edit:modal:${sid}`).setTitle('スケジュール編集');
                        const titleInput = new TextInputBuilder().setCustomId('title').setLabel('タイトル').setStyle(TextInputStyle.Short).setRequired(true).setValue(s.title);
                        const datetimeInput = new TextInputBuilder().setCustomId('datetime').setLabel('日時 (YYYY-MM-DD HH:MM or ISO)').setStyle(TextInputStyle.Short).setRequired(true).setValue(new Date(s.datetime).toISOString());
                        const descInput = new TextInputBuilder().setCustomId('description').setLabel('説明 (任意)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(s.description || '');
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(titleInput),
                            new ActionRowBuilder().addComponents(datetimeInput),
                            new ActionRowBuilder().addComponents(descInput),
                        );
                        try { await interaction.showModal(modal); } catch (e) { console.error('show edit modal failed:', e); try { await interaction.reply({ content: 'モーダルを開けませんでした。', flags: 64 }); } catch (e2) {} }
                    } catch (e) {
                        console.error('sched:edit handler error:', e);
                        try { await interaction.reply({ content: '編集中にエラーが発生しました。', flags: 64 }); } catch (e2) {}
                    }
                    return;
                }
                // Delete button: sched:delete:<id>
                if (cid.startsWith('sched:delete:')) {
                    const parts = cid.split(':');
                    const sid = parts[2];
                    try {
                        const { deleteSchedule } = await import('./utils/scheduleStore.mjs');
                        const ok = await deleteSchedule(sid);
                        if (!ok) {
                            try { await interaction.reply({ content: 'スケジュールの削除に失敗しました。', flags: 64 }); } catch (e) {}
                            return;
                        }
                        // Attempt to update the panel message in-place
                        try {
                            const { listSchedules, getSchedule } = await import('./utils/scheduleStore.mjs');
                            const schedules = await listSchedules(interaction.guildId);
                            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = await import('discord.js');
                            const listText = (!schedules || schedules.length === 0) ? 'スケジュールは登録されていません。' : schedules.slice(0,10).map(s => `• ${s.title} — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`).join('\n');
                            const embed = new EmbedBuilder().setTitle('🧭 スケジュール管理パネル').setDescription(listText).setTimestamp();
                            const selectOptions = (schedules && schedules.length) ? schedules.slice(0,25).map(s => ({ label: s.title.slice(0,100), description: (s.description||'').slice(0,100) || new Date(s.datetime).toLocaleString(), value: s.id })) : [];
                            let selectRow = null;
                            if (selectOptions.length > 0) {
                                const select = new StringSelectMenuBuilder().setCustomId('sched:select').setPlaceholder('スケジュールを選択して編集／削除').addOptions(...selectOptions);
                                selectRow = new ActionRowBuilder().addComponents(select);
                            }
                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
                            );
                            const editRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('sched:edit:noop').setLabel('編集').setStyle(ButtonStyle.Success).setDisabled(true),
                                new ButtonBuilder().setCustomId('sched:delete:noop').setLabel('削除').setStyle(ButtonStyle.Danger).setDisabled(true),
                            );
                            try { await interaction.update({ embeds: [embed], components: (selectRow ? [selectRow, row, editRow] : [row, editRow]) }); } catch (updErr) { try { await interaction.reply({ content: '削除しましたが、パネル更新に失敗しました。再度 /schedule panel を実行してください。', flags: 64 }); } catch (e) {} }
                        } catch (e) {
                            console.error('after-delete update failed:', e);
                        }
                        return;
                    } catch (e) {
                        console.error('sched:delete handler error:', e);
                        try { await interaction.reply({ content: '削除中にエラーが発生しました。', flags: 64 }); } catch (e2) {}
                    }
                    return;
                }
            }
        }

        // Handle select menu selection from panel
        if (interaction.isStringSelectMenu && interaction.customId === 'sched:select') {
            try {
                const sid = interaction.values && interaction.values[0];
                if (!sid) {
                    try { await interaction.reply({ content: '選択が無効です。', flags: 64 }); } catch (e) {}
                    return;
                }
                const { getSchedule } = await import('./utils/scheduleStore.mjs');
                const s = await getSchedule(sid);
                if (!s) {
                    try { await interaction.reply({ content: 'スケジュールが見つかりません。', flags: 64 }); } catch (e) {}
                    return;
                }
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(s.title)
                    .setDescription(s.description || '説明なし')
                    .addFields(
                        { name: '日時', value: new Date(s.datetime).toLocaleString(), inline: true },
                        { name: '参加者数', value: `${(s.attendees || []).length}`, inline: true },
                        { name: 'ID', value: s.id, inline: false },
                    ).setTimestamp(new Date(s.createdAt || s.datetime));
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
                );
                const controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`sched:edit:${s.id}`).setLabel('編集').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`sched:delete:${s.id}`).setLabel('削除').setStyle(ButtonStyle.Danger),
                );
                try {
                    const comps = [];
                    if (interaction.message && Array.isArray(interaction.message.components) && interaction.message.components[0]) comps.push(interaction.message.components[0]);
                    comps.push(row, controlRow);
                    await interaction.update({ embeds: [embed], components: comps });
                } catch (e) {
                    console.error('select update failed:', e);
                    try { await interaction.reply({ content: 'パネルの更新に失敗しました。', flags: 64 }); } catch (e2) {}
                }
            } catch (e) {
                console.error('sched select handler error:', e);
                try { await interaction.reply({ content: '選択処理中にエラーが発生しました。', flags: 64 }); } catch (e2) {}
            }
            return;
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
        // Handle edit modal submit: sched:edit:modal:<id>
        if (interaction.isModalSubmit && interaction.customId && interaction.customId.startsWith('sched:edit:modal')) {
            try {
                const parts = interaction.customId.split(':');
                const sid = parts[2];
                const title = interaction.fields.getTextInputValue('title');
                const datetimeRaw = interaction.fields.getTextInputValue('datetime');
                const description = interaction.fields.getTextInputValue('description') || '';
                let dt = new Date(datetimeRaw);
                if (isNaN(dt.getTime())) dt = new Date(datetimeRaw.replace(' ', 'T'));
                if (isNaN(dt.getTime())) {
                    try { await interaction.reply({ content: '無効な日時形式です。', flags: 64 }); } catch (e) {}
                    return;
                }
                const { updateSchedule } = await import('./utils/scheduleStore.mjs');
                const res = await updateSchedule(sid, { title, datetime: dt.toISOString(), description });
                if (!res || !res.ok) {
                    try { await interaction.reply({ content: '更新に失敗しました。', flags: 64 }); } catch (e) {}
                    return;
                }
                // Attempt to update the panel message in recent messages
                try {
                    const { listSchedules } = await import('./utils/scheduleStore.mjs');
                    const schedules = await listSchedules(interaction.guildId);
                    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = await import('discord.js');
                    const listText = (!schedules || schedules.length === 0) ? 'スケジュールは登録されていません。' : schedules.slice(0,10).map(s => `• ${s.title} — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`).join('\n');
                    const embed = new EmbedBuilder().setTitle('🧭 スケジュール管理パネル').setDescription(listText).setTimestamp();
                            const selectOptions = (schedules && schedules.length) ? schedules.slice(0,25).map(s => ({ label: s.title.slice(0,100), description: (s.description||'').slice(0,100) || new Date(s.datetime).toLocaleString(), value: s.id })) : [];
                            let selectRow = null;
                            if (selectOptions.length > 0) {
                                const select = new StringSelectMenuBuilder().setCustomId('sched:select').setPlaceholder('スケジュールを選択して編集／削除').addOptions(...selectOptions);
                                selectRow = new ActionRowBuilder().addComponents(select);
                            }
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
                    );
                    const editRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('sched:edit:noop').setLabel('編集').setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId('sched:delete:noop').setLabel('削除').setStyle(ButtonStyle.Danger).setDisabled(true),
                    );
                    // find a recent panel message and edit it
                    try {
                        const recent = await interaction.channel.messages.fetch({ limit: 50 });
                        const panelMsg = recent.find(m => m.embeds && m.embeds[0] && m.embeds[0].title === '🧭 スケジュール管理パネル');
                        if (panelMsg) {
                            const comps = [];
                            if (selectRow) comps.push(selectRow);
                            comps.push(row, editRow);
                            await panelMsg.edit({ embeds: [embed], components: comps });
                        }
                    } catch (e) { console.warn('panel refresh after edit failed:', e); }
                } catch (e) { console.error('post-edit panel update failed:', e); }

                try { await interaction.reply({ content: '✅ スケジュールを更新しました。', flags: 64 }); } catch (e) {}
            } catch (err) {
                console.error('edit modal submit error:', err);
                try { await interaction.reply({ content: '更新に失敗しました。', flags: 64 }); } catch (e) {}
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