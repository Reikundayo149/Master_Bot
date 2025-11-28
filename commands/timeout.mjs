import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('指定したユーザーをタイムアウト（ミュート）します（分単位）')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('タイムアウト時間（分）').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!member) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', flags: 64 });
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '権限がありません (ModerateMembers)。', flags: 64 });
    const ms = minutes * 60 * 1000;
    try {
      await member.timeout(ms, reason);
      const embed = new EmbedBuilder()
        .setTitle('⏳ タイムアウトを適用')
        .setDescription(`🛑 ${member.user.tag} を ${minutes} 分間タイムアウトしました`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '🔰 実行者', value: interaction.user.tag, inline: true },
          { name: '⏱️ 秒数', value: `${minutes} 分`, inline: true },
          { name: '📌 理由', value: reason, inline: false },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ タイムアウトに失敗しました。', flags: 64 });
    }
  },
};
