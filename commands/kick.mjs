import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('指定したユーザーをキックします')
    .addUserOption(opt => opt.setName('user').setDescription('キックするユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!member) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', flags: 64 });
    if (!hasPermission(interaction, PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '権限がありません (KickMembers)。', flags: 64 });
    try {
      await member.kick(reason);
      const embed = new EmbedBuilder()
        .setTitle('👢 ユーザーをキックしました')
        .setDescription(`${member.user.tag}`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '🔰 実行者', value: interaction.user.tag, inline: true },
          { name: '📌 理由', value: reason, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ キックに失敗しました。', flags: 64 });
    }
  },
};
