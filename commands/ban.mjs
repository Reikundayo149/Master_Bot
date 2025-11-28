import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('指定したユーザーをBANします')
    .addUserOption(opt => opt.setName('user').setDescription('BANするユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!target) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', ephemeral: true });
    if (!hasPermission(interaction, PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '権限がありません (BanMembers)。', ephemeral: true });
    try {
      await target.ban({ reason });
      const embed = new EmbedBuilder()
        .setTitle('⛔ ユーザーをBANしました')
        .setDescription(`🔨 ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '🔰 モデレーター', value: interaction.user.tag, inline: true },
          { name: '📌 理由', value: reason, inline: true },
          { name: '🆔 ユーザーID', value: target.id, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ BAN に失敗しました。', ephemeral: true });
    }
  },
};
