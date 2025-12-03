import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('サーバーの基本情報を表示します'),
  async execute(interaction) {
    const g = interaction.guild;
    const embed = new EmbedBuilder()
      .setTitle(`🌐 ${g.name}`)
      .setThumbnail(g.iconURL())
      .addFields(
        { name: '🆔 サーバーID', value: g.id, inline: true },
        { name: '👥 メンバー数', value: `${g.memberCount}`, inline: true },
        { name: '👑 所有者ID', value: g.ownerId || '不明', inline: true },
        { name: '📅 作成日', value: g.createdAt.toISOString(), inline: false },
      )
      .setTimestamp();
      try { await interaction.reply({ embeds: [embed] }); } catch (e) { try { await interaction.followUp({ embeds: [embed] }); } catch (e2) { console.error('返信に失敗しました:', e2); } }
  },
};
