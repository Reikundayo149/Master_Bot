import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('指定したユーザーの情報を表示します')
    .addUserOption(opt => opt.setName('user').setDescription('ユーザー（省略可）')),
  async execute(interaction) {
    const member = interaction.options.getMember('user') || interaction.member;
    const roles = member.roles ? member.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') || 'なし' : 'なし';
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${member.user.tag}`)
      .setThumbnail(member.displayAvatarURL())
      .addFields(
        { name: '🆔 ID', value: member.id, inline: true },
        { name: '📥 参加日時', value: member.joinedAt ? member.joinedAt.toISOString() : '不明', inline: true },
        { name: '🎭 ロール', value: roles, inline: false },
      )
      .setTimestamp();
      try { await interaction.reply({ embeds: [embed] }); } catch (e) { try { await interaction.followUp({ embeds: [embed] }); } catch (e2) { console.error('返信に失敗しました:', e2); } }
  },
};
