import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

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
    if (!member) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', ephemeral: true });
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '権限がありません (KickMembers)。', ephemeral: true });
    try {
      await member.kick(reason);
      await interaction.reply({ content: `✅ ${member.user.tag} をキックしました。理由: ${reason}` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: キックに失敗しました。', ephemeral: true });
    }
  },
};
