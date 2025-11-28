// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { startReminders } from './utils/reminder.mjs';
import { addAttendance, removeAttendance, getSchedule, createSchedule, listSchedules } from './utils/scheduleStore.mjs';
import { updateNotificationEmbeds } from './utils/reminder.mjs';
import { parseToISO, formatISOToTokyo } from './utils/datetime.mjs';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelSelectMenuBuilder } from 'discord.js';

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
	// Start background reminder service
	try {
		startReminders(client, { checkIntervalSeconds: 60 });
		console.log('🔔 リマインダーサービスを開始しました。');
	} catch (err) {
		console.error('リマインダーサービス起動に失敗しました:', err);
	}
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
	// Simple in-memory map to hold channel selection for panel per user
	if (!global.panelSelections) global.panelSelections = new Map();

	// Button interactions for schedule attendance and panel
	if (interaction.isButton && interaction.isButton()) {
		const id = interaction.customId;
		if (typeof id === 'string') {
			// attendance buttons: sched:<id>:join|leave
			if (id.startsWith('sched:')) {
				const parts = id.split(':');
				const schedId = parts[1];
				const action = parts[2];
				try {
					if (action === 'join') {
						await addAttendance(schedId, interaction.user.id);
						await interaction.reply({ content: '参加登録しました ✅', flags: 64 });
					} else if (action === 'leave') {
						await removeAttendance(schedId, interaction.user.id);
						await interaction.reply({ content: '参加登録を取り消しました ✖️', flags: 64 });
					}
					// Update notification embeds to reflect new counts
					try {
						await updateNotificationEmbeds(client, schedId);
					} catch (err) {
						console.error('Failed to refresh notification embeds:', err);
					}
				} catch (err) {
					console.error('Attendance button handler error:', err);
					try { await interaction.reply({ content: '処理中にエラーが発生しました。', flags: 64 }); } catch {};
				}
				return;
			}

			// panel buttons: sched_panel:create | sched_panel:list
			if (id === 'sched_panel:create') {
				// show modal for creating schedule
				const modal = new ModalBuilder()
					.setCustomId('sched_panel:modal')
					.setTitle('スケジュールを作成');
				const nameInput = new TextInputBuilder().setCustomId('name').setLabel('イベント名').setStyle(TextInputStyle.Short).setRequired(true);
				const dateInput = new TextInputBuilder().setCustomId('datetime').setLabel('日時（例: 2025-12-01 18:00）').setStyle(TextInputStyle.Short).setRequired(true);
				const descInput = new TextInputBuilder().setCustomId('description').setLabel('説明（任意）').setStyle(TextInputStyle.Paragraph).setRequired(false);
				const remInput = new TextInputBuilder().setCustomId('reminders').setLabel('リマインド（カンマ区切り分: 60,10）').setStyle(TextInputStyle.Short).setRequired(false);
				const channelInput = new TextInputBuilder().setCustomId('channel').setLabel('通知チャンネル（#channel 形式かID、省略可）').setStyle(TextInputStyle.Short).setRequired(false);
				modal.addComponents(
					new ActionRowBuilder().addComponents(nameInput),
					new ActionRowBuilder().addComponents(dateInput),
					new ActionRowBuilder().addComponents(descInput),
					new ActionRowBuilder().addComponents(remInput),
					new ActionRowBuilder().addComponents(channelInput)
				);
				try {
					await interaction.showModal(modal);
				} catch (err) {
					console.error('Failed to show modal', err);
					try { await interaction.reply({ content: 'モーダルを開けませんでした。', flags: 64 }); } catch {};
				}
				return;
			}
			if (id === 'sched_panel:list') {
				try {
					const all = await listSchedules();
					if (!all || all.length === 0) return interaction.reply({ content: '登録されたスケジュールはありません。', flags: 64 });
					const { EmbedBuilder } = await import('discord.js');
					const embed = new EmbedBuilder().setTitle('📅 スケジュール一覧').setColor(0x5865F2).setTimestamp();
					const lines = all.map(s => `**ID ${s.id}** — ${s.name}\n日時: ${formatISOToTokyo(s.datetime) || s.datetime}\n参加: ${s.attendees.length}人`);
					embed.addFields([{ name: '一覧', value: lines.join('\n\n').slice(0, 1024) }]);
					return interaction.reply({ embeds: [embed], flags: 64 });
				} catch (err) {
					console.error('Panel list error', err);
					return interaction.reply({ content: '一覧の取得に失敗しました。', flags: 64 });
				}
			}
		}
	}

	// Channel select for panel
	if (interaction.isAnySelectMenu && interaction.customId === 'sched_panel:channel_select') {
		try {
			const vals = interaction.values || [];
			const chosen = vals[0] || null;
			if (chosen) {
				global.panelSelections.set(interaction.user.id, chosen);
				await interaction.reply({ content: `通知チャンネルを <#${chosen}> に設定しました。モーダルで詳細を入力してください。`, flags: 64 });
			} else {
				global.panelSelections.delete(interaction.user.id);
				await interaction.reply({ content: '選択がクリアされました。', flags: 64 });
			}
		} catch (err) {
			console.error('Channel select handler error', err);
			try { await interaction.reply({ content: 'チャンネル選択の処理に失敗しました。', flags: 64 }); } catch {};
		}
		return;
	}

	// Modal submit handling
	if (interaction.isModalSubmit && interaction.isModalSubmit()) {
		if (interaction.customId === 'sched_panel:modal') {
			try {
				const name = interaction.fields.getTextInputValue('name');
				const datetimeInput = interaction.fields.getTextInputValue('datetime');
				const description = interaction.fields.getTextInputValue('description') || '';
				const remindersRaw = interaction.fields.getTextInputValue('reminders') || '';
				const channelField = interaction.fields.getTextInputValue('channel') || '';

				const parsed = parseToISO(datetimeInput);
				if (!parsed.ok) {
					return interaction.reply({ content: '日時を解析できませんでした。例: `2025-12-01 18:00` のように入力してください（東京時間）。', flags: 64 });
				}

				// resolve channel: prefer panelSelections, then channelField mention/id, else current channel
				let channelId = global.panelSelections.get(interaction.user.id) || null;
				if (!channelId && channelField) {
					const m = channelField.match(/<#!?(\d+)>|#(.*)|^(\d+)$/);
					if (m) {
						const id = m[1] || m[3] || null;
						channelId = id;
					}
				}
				if (!channelId) channelId = interaction.channelId;

				// parse reminders
				let reminders = undefined;
				if (remindersRaw && remindersRaw.trim()) {
					reminders = remindersRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0);
					if (reminders.length === 0) reminders = undefined;
				}

				const created = await createSchedule({ name, datetime: parsed.iso, description, creatorId: interaction.user.id, guildId: interaction.guildId, channelId, reminders });
				const { EmbedBuilder } = await import('discord.js');
				const embed = new EmbedBuilder()
					.setTitle('✅ スケジュール作成（パネル）')
					.setDescription(created.name)
					.addFields(
						{ name: 'ID', value: String(created.id), inline: true },
						{ name: '日時', value: formatISOToTokyo(created.datetime) || created.datetime, inline: true },
						{ name: '通知先', value: `<#${channelId}>`, inline: true }
					)
					.setColor(0x57F287)
					.setTimestamp();
				// clear stored selection
				global.panelSelections.delete(interaction.user.id);
				await interaction.reply({ embeds: [embed], flags: 64 });
				return;
			} catch (err) {
				console.error('Modal submit error', err);
				try { await interaction.reply({ content: 'スケジュール作成中にエラーが発生しました。', flags: 64 }); } catch {};
				return;
			}
		}
	}

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
			// 既に deferred なら editReply を試す
			try {
				if (interaction.deferred) {
					return await interaction.editReply(options);
				}
				if (interaction.replied && origFollowUp) {
					return await origFollowUp(options);
				}
			} catch (err2) {
				// ignore here and rethrow original
			}
			throw err;
		}
	};
	if (origFollowUp) {
		interaction.followUp = async (options) => {
			try {
				return await origFollowUp(options);
			} catch (err) {
				try {
					if (interaction.replied) {
						return await origFollowUp(options);
					}
					if (interaction.deferred) {
						return await interaction.editReply(options);
					}
				} catch (err2) {
					// ignore
				}
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
				await interaction.followUp({ content: 'エラーが発生しました。', flags: 64 });
			} else {
				await interaction.reply({ content: 'エラーが発生しました。', flags: 64 });
			}
		} catch (err) {
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