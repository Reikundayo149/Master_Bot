import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { createSchedule, listSchedules, getSchedule, deleteSchedule } from '../utils/scheduleStore.mjs';
import { parseToISO, formatISOToTokyo } from '../utils/datetime.mjs';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('部活動のスケジュールを管理します')
    .addSubcommand(sc => sc
      .setName('create')
      .setDescription('スケジュールを作成します')
      .addStringOption(o => o.setName('name').setDescription('イベント名').setRequired(true))
      .addStringOption(o => o.setName('datetime').setDescription('日時（自由入力・例: 2025-12-01 18:00）').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('説明（任意）'))
      .addChannelOption(o => o.setName('channel').setDescription('通知先チャンネル（指定しない場合はサーバーのシステムチャンネル）')))
    .addSubcommand(sc => sc
      .setName('list')
      .setDescription('スケジュール一覧を表示します'))
    .addSubcommand(sc => sc
      .setName('panel')
      .setDescription('管理パネルを表示します（モーダルでの作成が可能）'))
    .addSubcommand(sc => sc
      .setName('delete')
      .setDescription('スケジュールを削除します（作成者または管理者のみ）')
      .addIntegerOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const datetimeInput = interaction.options.getString('datetime', true);
      const description = interaction.options.getString('description') || '';
      const parsed = parseToISO(datetimeInput);
      if (!parsed.ok) {
        return interaction.reply({ content: '日時を解析できませんでした。例: `2025-12-01 18:00` のように入力してください（東京時間）。', flags: 64 });
      }
      const channel = interaction.options.getChannel('channel');
      const created = await createSchedule({ name, datetime: parsed.iso, description, creatorId: interaction.user.id, guildId: interaction.guildId, channelId: channel ? channel.id : null });
      const embed = new EmbedBuilder()
        .setTitle('✅ スケジュール作成')
        .setDescription(`${created.name}`)
        .addFields(
          { name: 'ID', value: String(created.id), inline: true },
          { name: '日時', value: formatISOToTokyo(created.datetime) || created.datetime, inline: true },
          { name: '作成者', value: `<@${created.creatorId}>`, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }

    if (sub === 'list') {
      const all = await listSchedules();
      if (all.length === 0) return interaction.reply({ content: '登録されたスケジュールはありません。', flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle('📅 スケジュール一覧')
        .setColor(0x5865F2)
        .setTimestamp();
      const lines = all.map(s => `**ID ${s.id}** — ${s.name}\n日時: ${formatISOToTokyo(s.datetime) || s.datetime}\n参加: ${s.attendees.length}人${s.description ? `\n説明: ${s.description}` : ''}`);
      // Discord embed field value max length ~1024, so split if large
      const chunk = lines.join('\n\n');
      embed.addFields([{ name: '一覧', value: chunk.slice(0, 1024) }]);
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }

    if (sub === 'panel') {
      // Post a management panel with a Create button that opens a modal.
      const embed = new EmbedBuilder()
        .setTitle('🛠️ スケジュール管理パネル')
        .setDescription('「作成」ボタンでモーダルを開き、スケジュールを入力できます。')
        .setColor(0x5865F2)
        .setTimestamp();
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder } = await import('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sched_panel:create').setLabel('作成 (モーダル)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sched_panel:list').setLabel('一覧を表示').setStyle(ButtonStyle.Secondary)
      );
      // channel select row
      const chanRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('sched_panel:channel_select').setPlaceholder('通知チャンネルを選択（任意）')
      );
      await interaction.reply({ embeds: [embed], components: [chanRow, row], flags: 64 });
      return;
    }

    if (sub === 'delete') {
      const id = interaction.options.getInteger('id', true);
      const s = await getSchedule(id);
      if (!s) return interaction.reply({ content: `ID ${id} のスケジュールは見つかりません。`, flags: 64 });
      const isCreator = String(s.creatorId) === String(interaction.user.id);
      const canManage = hasPermission(interaction, PermissionFlagsBits.ManageGuild) || isCreator;
      if (!canManage) return interaction.reply({ content: 'このスケジュールを削除する権限がありません（作成者かサーバー管理者のみ）。', flags: 64 });
      const ok = await deleteSchedule(id);
      if (!ok) return interaction.reply({ content: '削除に失敗しました。もう一度試してください。', flags: 64 });
      await interaction.reply({ content: `ID ${id} のスケジュールを削除しました。`, flags: 64 });
      return;
    }
  }
};
