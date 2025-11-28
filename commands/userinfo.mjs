import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('指定したユーザーの情報を表示します')
    .addUserOption(opt => opt.setName('user').setDescription('ユーザー（省略可）')),
  async execute(interaction) {
    const user = interaction.options.getMember('user') || interaction.member;
    const roles = user.roles ? user.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') : 'なし';
    await interaction.reply({ content: `**ユーザー:** ${user.user.tag}\n**ID:** ${user.id}\n**参加日時:** ${user.joinedAt ? user.joinedAt.toISOString() : '不明'}\n**ロール:** ${roles}` });
  },
};
