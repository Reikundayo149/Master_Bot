import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('指定したユーザーIDのBANを解除します')
    .addStringOption(opt => opt.setName('user_id').setDescription('BAN解除するユーザーのID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    if (!hasPermission(interaction, PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '権限がありません (BanMembers)。', ephemeral: true });
    try {
      const user = await interaction.guild.members.unban(userId);
      const embed = new EmbedBuilder()
        .setTitle('✅ BAN 解除')
        .setDescription(`🔓 ${userId}`)
        .addFields(
          { name: '🔰 実行者', value: interaction.user.tag, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ UNBAN に失敗しました。IDを確認してください。', ephemeral: true });
    }
  },
};
