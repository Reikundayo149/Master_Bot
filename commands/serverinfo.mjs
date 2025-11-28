import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('サーバーの基本情報を表示します'),
  async execute(interaction) {
    const g = interaction.guild;
    await interaction.reply({ content: `**サーバー名:** ${g.name}\n**ID:** ${g.id}\n**メンバー数:** ${g.memberCount}\n**所有者ID:** ${g.ownerId}\n**作成日:** ${g.createdAt.toISOString()}` });
  },
};
