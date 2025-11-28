import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('指定したユーザーIDのBANを解除します')
    .addStringOption(opt => opt.setName('user_id').setDescription('BAN解除するユーザーのID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: '権限がありません (BanMembers)。', ephemeral: true });
    try {
      await interaction.guild.members.unban(userId);
      await interaction.reply({ content: `✅ ユーザーID ${userId} のBANを解除しました。` });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'ERROR: UNBAN に失敗しました。IDを確認してください。', ephemeral: true });
    }
  },
};
