import { SlashCommandBuilder } from 'discord.js';
import { addAttendance, removeAttendance, getSchedule } from '../utils/scheduleStore.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription('スケジュールの参加/離脱を行います')
    .addSubcommand(sub => sub.setName('join').setDescription('参加します').addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true)))
    .addSubcommand(sub => sub.setName('leave').setDescription('離脱します').addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getString('id');
    const safeSend = async (payload) => {
      try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        try { return await interaction.followUp(payload); } catch (e) { console.error('返信に失敗しました:', e); }
      }
    };
    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}

    try {
      const sched = await getSchedule(id);
      if (!sched || sched.guildId !== interaction.guildId) {
        await safeSend({ content: '指定されたスケジュールが見つかりません。', flags: 64 });
        return;
      }
      if (sub === 'join') {
        const ok = await addAttendance(id, interaction.user.id);
        if (ok) await safeSend({ content: `✅ 参加しました（${sched.title}）`, flags: 64 });
        else await safeSend({ content: '参加に失敗しました。', flags: 64 });
        return;
      }
      if (sub === 'leave') {
        const ok = await removeAttendance(id, interaction.user.id);
        if (ok) await safeSend({ content: `✅ 離脱しました（${sched.title}）`, flags: 64 });
        else await safeSend({ content: '離脱に失敗しました。', flags: 64 });
        return;
      }
    } catch (err) {
      console.error('attendance command error:', err);
      await safeSend({ content: 'コマンド実行中にエラーが発生しました。', flags: 64 });
    }
  }
};
