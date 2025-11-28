import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

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
    if (!member) return interaction.reply({ content: 'サーバー内ユーザーを指定してください。', ephemeral: true });
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply({ content: '権限がありません (ModerateMembers)。', ephemeral: true });
    const ms = minutes * 60 * 1000;
    try {
      await member.timeout(ms, reason);
      await interaction.reply({ content: `✅ ${member.user.tag} を ${minutes} 分間タイムアウトしました。理由: ${reason}` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: タイムアウトに失敗しました。', ephemeral: true });
    }
  },
};
