import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { addAttendance, removeAttendance, getSchedule } from '../utils/scheduleStore.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription('出欠を管理します（参加／不参加／状況確認）')
    .addSubcommand(sc => sc
      .setName('join')
      .setDescription('スケジュールに参加登録します')
      .addIntegerOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('leave')
      .setDescription('スケジュールの参加登録を取り消します')
      .addIntegerOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('status')
      .setDescription('スケジュールの参加状況を表示します')
      .addIntegerOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getInteger('id', true);
    const s = await getSchedule(id);
    if (!s) return interaction.reply({ content: `ID ${id} のスケジュールが見つかりません。`, flags: 64 });

    if (sub === 'join') {
      await addAttendance(id, interaction.user.id);
      return interaction.reply({ content: `参加登録しました： **${s.name}** (ID ${s.id})`, flags: 64 });
    }

    if (sub === 'leave') {
      await removeAttendance(id, interaction.user.id);
      return interaction.reply({ content: `参加登録を取り消しました： **${s.name}** (ID ${s.id})`, flags: 64 });
    }

    if (sub === 'status') {
      const attendees = s.attendees || [];
      const mentionLines = attendees.slice(0, 25).map(id => `<@${id}>`);
      const more = attendees.length > 25 ? `and ${attendees.length - 25} more` : '';
      const embed = new EmbedBuilder()
        .setTitle(`📋 出欠 — ${s.name}`)
        .addFields(
          { name: 'ID', value: String(s.id), inline: true },
          { name: '日時', value: s.datetime || '未指定', inline: true },
          { name: '参加数', value: String(attendees.length), inline: true }
        )
        .setDescription(mentionLines.join(' ') + (more ? ` ${more}` : ''))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }
};
