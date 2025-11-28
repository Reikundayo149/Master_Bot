import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botのレイテンシを測定します'),
  async execute(interaction) {
    const latency = Math.round(interaction.client.ws.ping);
    await interaction.reply({ content: `🏓 pong! ${latency}ms` });
  },
};
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply('🏓 pong!');
    console.log(`📝 ${interaction.user.tag} が /ping を使用`);
  },
};
