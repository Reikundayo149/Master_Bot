import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('指定したユーザーのタイムアウトを解除します')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    if (!member) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', ephemeral: true });
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '権限がありません (ModerateMembers)。', ephemeral: true });
    try {
      await member.timeout(null);
      await interaction.reply({ content: `✅ ${member.user.tag} のタイムアウトを解除しました。` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: タイムアウト解除に失敗しました。', ephemeral: true });
    }
  },
};
