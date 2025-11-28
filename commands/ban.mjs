import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

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
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '権限がありません (BanMembers)。', ephemeral: true });
    try {
      await target.ban({ reason });
      await interaction.reply({ content: `✅ ${target.user.tag} を BAN しました。
理由: ${reason}` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: BAN に失敗しました。', ephemeral: true });
    }
  },
};
