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
    if (amount <= 0 || amount > 100) return interaction.reply({ content: '1〜100の数を指定してください。', ephemeral: true });
    if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '権限がありません (ManageMessages)。', ephemeral: true });
    try {
      const fetched = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(fetched, true);
      await interaction.reply({ content: `✅ ${fetched.size} 件のメッセージを削除しました。`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: メッセージ削除に失敗しました。', ephemeral: true });
    }
  },
};
