import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { createSchedule, listSchedules, getSchedule, deleteSchedule } from '../utils/scheduleStore.mjs';
import { getScheduleCreatorRole, setScheduleCreatorRole, removeScheduleCreatorRole } from '../utils/roleConfig.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('スケジュール管理')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('create').setDescription('スケジュールを作成します')
        .addStringOption(o => o.setName('title').setDescription('タイトル').setRequired(true))
        .addStringOption(o => o.setName('datetime').setDescription('日時（ISO or YYYY-MM-DD HH:MM）').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('詳細'))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('このサーバーのスケジュール一覧を表示します'))
    .addSubcommand(sub => sub.setName('panel').setDescription('管理パネルを開きます（管理者向け）'))
    .addSubcommand(sub =>
      sub.setName('view').setDescription('スケジュールを表示します')
        .addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete').setDescription('スケジュールを削除します')
        .addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setrole').setDescription('スケジュール作成可能ロールを設定します（管理者のみ）')
        .addRoleOption(o => o.setName('role').setDescription('スケジュール作成可能ロール').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('removerole').setDescription('スケジュール作成可能ロールを削除します（管理者のみ）')
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const safeSend = async (payload) => {
      try {
        if (interaction.deferred) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        console.error('safeSend reply/editReply failed:', err);
      }
    };

    try { await interaction.deferReply(); } catch (e) {}

    try {
      if (sub === 'create') {
        // Check permissions: Admin or has the specific role
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const creatorRole = await getScheduleCreatorRole(interaction.guildId);
        const hasRole = creatorRole && interaction.member.roles.cache.has(creatorRole);
        
        if (!isAdmin && !hasRole) {
          await safeSend({ content: '❌ スケジュール作成権限がありません。管理者またはスケジュール作成可能ロールが必要です。' });
          return;
        }
        
        const title = interaction.options.getString('title');
        const datetimeRaw = interaction.options.getString('datetime');
        const desc = interaction.options.getString('description') || '';
        // Try to parse datetime
        let dt = new Date(datetimeRaw);
        if (isNaN(dt.getTime())) {
          // Try replace space with 'T'
          dt = new Date(datetimeRaw.replace(' ', 'T'));
        }
        if (isNaN(dt.getTime())) {
          await safeSend({ content: '無効な日時形式です。ISO または `YYYY-MM-DD HH:MM` の形式で指定してください。' });
          return;
        }
        
        // ローカルDBに保存
        const schedule = await createSchedule({ 
          guildId: interaction.guildId, 
          title, 
          datetime: dt.toISOString(), 
          description: desc, 
          creatorId: interaction.user.id,
        });
        
        const embed = new EmbedBuilder()
          .setTitle('✅ スケジュールを作成しました')
          .addFields(
            { name: 'タイトル', value: schedule.title },
            { name: '日時', value: new Date(schedule.datetime).toLocaleString() },
            { name: 'ID', value: schedule.id },
          )
          .setTimestamp();
        await safeSend({ embeds: [embed] });
        return;
      }

      if (sub === 'panel') {
        // Admin panel: show create button and list
        const all = await listSchedules(interaction.guildId);
        const listText = (!all || all.length === 0) ? 'スケジュールは登録されていません。' : all.slice(0,10).map(s => `• ${s.title} — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`).join('\n');
        const embed = new EmbedBuilder().setTitle('🧭 スケジュール管理パネル').setDescription(listText).setTimestamp();
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = await import('discord.js');
        const options = (all && all.length) ? all.slice(0, 25).map(s => {
          const short = (s.id || '').slice(0, 8);
          // reserve space for [short] and a space; label max 100 chars
          const maxLabel = 100 - (short.length + 3);
          const title = (s.title || '').slice(0, Math.max(0, maxLabel));
          const label = `[${short}] ${title}`.slice(0, 100);
          const desc = (s.description || '').slice(0, 100) || new Date(s.datetime).toLocaleString();
          return { label, description: desc, value: s.id };
        }) : [];
        let selectRow = null;
        if (options.length > 0) {
          const select = new StringSelectMenuBuilder()
            .setCustomId('sched:select')
            .setPlaceholder('スケジュールを選択して編集／削除')
            .addOptions(...options);
          selectRow = new ActionRowBuilder().addComponents(select);
        }
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
        );
        // Buttons for edit/delete (initially disabled until a selection is made)
        const editRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sched:edit:noop').setLabel('編集').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('sched:delete:noop').setLabel('削除').setStyle(ButtonStyle.Danger).setDisabled(true),
        );
        const components = [];
        if (selectRow) components.push(selectRow);
        components.push(row, editRow);
        await safeSend({ embeds: [embed], components });
        return;
      }

      if (sub === 'list') {
        const all = await listSchedules(interaction.guildId);
        if (!all || all.length === 0) {
          await safeSend({ content: 'このサーバーのスケジュールはありません。' });
          return;
        }
        // Build a fixed-width table for easier scanning. Show index, short-id, date, title.
        const slice = all.slice(0, 25);
        // Determine running timezone for clarity
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const rows = [];
        // Columns: No | ShortID | Date | Title
        const noW = 3;
        const idW = 10;
        const dateW = 20;
        const titleW = 40;
        const headerLabel = `日時 (${tz})`;
        const header = ` ${'No'.padEnd(noW)} | ${'ShortID'.padEnd(idW)} | ${headerLabel.padEnd(dateW)} | ${'タイトル'.padEnd(titleW)}`;
        rows.push(header);
        rows.push('-'.repeat(header.length));
        slice.forEach((s, idx) => {
          const no = String(idx + 1).padEnd(noW);
          const short = (s.id || '').slice(0,8).padEnd(idW);
          // include timezone abbreviation where possible; keep width constrained
          const dt = new Date(s.datetime);
          const dateStr = dt.toLocaleString();
          const date = (dateStr + ` (${tz})`).padEnd(dateW).slice(0, dateW);
          const title = (s.title || '').replace(/\n/g, ' ').slice(0, titleW).padEnd(titleW);
          rows.push(` ${no} | ${short} | ${date} | ${title}`);
        });
        const footerNote = '\n※ テーブル中の ShortID は内部IDの先頭8文字です。詳細表示/削除は `/schedule view <ID>` `/schedule delete <ID>` で、ShortID でもマッチします。';
        const embed = new EmbedBuilder().setTitle('📅 スケジュール一覧').setDescription('```\n' + rows.join('\n') + '\n```' + footerNote);
        await safeSend({ embeds: [embed] });
        return;
      }

      if (sub === 'view') {
        const id = interaction.options.getString('id');
        const s = await getSchedule(id);
        if (!s || s.guildId !== interaction.guildId) {
          await safeSend({ content: 'スケジュールが見つかりません。' });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(s.title)
          .setDescription(s.description || '説明なし')
          .addFields(
            { name: '日時', value: new Date(s.datetime).toLocaleString(), inline: true },
            { name: '作成者ID', value: s.creatorId || '不明', inline: true },
            { name: '参加者数', value: `${(s.attendees || []).length}`, inline: true },
            { name: 'ID', value: s.id, inline: false },
          )
          .setTimestamp(new Date(s.createdAt || s.datetime));
        await safeSend({ embeds: [embed] });
        return;
      }

      if (sub === 'delete') {
        const id = interaction.options.getString('id');
        const s = await getSchedule(id);
        if (!s || s.guildId !== interaction.guildId) {
          await safeSend({ content: 'スケジュールが見つかりません。' });
          return;
        }
        const ok = await deleteSchedule(id);
        if (ok) {
          await safeSend({ content: '✅ スケジュールを削除しました。' });
        } else {
          await safeSend({ content: '❌ スケジュールの削除に失敗しました。' });
        }
        return;
      }

      if (sub === 'setrole') {
        // Only admins can set the role
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          await safeSend({ content: '❌ このコマンドは管理者のみが使用できます。' });
          return;
        }
        const role = interaction.options.getRole('role');
        await setScheduleCreatorRole(interaction.guildId, role.id);
        const embed = new EmbedBuilder()
          .setTitle('✅ スケジュール作成ロールを設定しました')
          .addFields({ name: 'ロール', value: `<@&${role.id}> (${role.name})` })
          .setTimestamp();
        await safeSend({ embeds: [embed] });
        return;
      }

      if (sub === 'removerole') {
        // Only admins can remove the role
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          await safeSend({ content: '❌ このコマンドは管理者のみが使用できます。' });
          return;
        }
        await removeScheduleCreatorRole(interaction.guildId);
        await safeSend({ content: '✅ スケジュール作成ロールを削除しました。管理者のみがスケジュールを作成できるようになりました。' });
        return;
      }
    } catch (err) {
      console.error('schedule command error:', err);
      await safeSend({ content: 'コマンド実行中にエラーが発生しました。' });
    }
  }
};
