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
        if (interaction.deferred) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        console.error('safeSend reply/editReply failed:', err);
        try {
          if (interaction.channel && typeof interaction.channel.send === 'function') return await interaction.channel.send(payload);
        } catch (chErr) {
          console.error('チャネル送信にも失敗しました (payload):', chErr);
        }
        try { return await interaction.channel?.send?.(payload.content || (payload.embeds ? '（埋め込みメッセージ）' : 'メッセージ')); } catch (chErr2) { console.error('チャネル送信にも失敗しました (text):', chErr2); }
      }
    };
    try { await interaction.deferReply({ flags: 64 }); } catch (e) {}

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
