import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('メッセージを一括削除します（最大100）')
    .addIntegerOption(opt => opt.setName('amount').setDescription('削除するメッセージ数').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    if (amount <= 0 || amount > 100) {
      try { await interaction.reply({ content: '1〜100の数を指定してください。', flags: 64 }); } catch {};
      return;
    }
    if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
      try { await interaction.reply({ content: '権限がありません (ManageMessages)。', flags: 64 }); } catch {};
      return;
    }

    // This command performs network / bulk operations; defer the reply.
    try { await interaction.deferReply({ flags: 64 }); } catch (e) {}

    const safeSend = async (payload) => {
      try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        try { return await interaction.followUp(payload); } catch (e) { console.error('返信に失敗しました:', e); }
      }
    };

    try {
      const fetched = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(fetched, true);
      await safeSend({ content: `✅ ${fetched.size} 件のメッセージを削除しました。`, flags: 64 });
    } catch (err) {
      console.error(err);
      await safeSend({ content: 'ERROR: メッセージ削除に失敗しました。', flags: 64 });
    }
  },
};
