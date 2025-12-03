import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('schedule').setDescription('スケジュール機能（無効化）'),
  async execute(interaction) {
    try { await interaction.reply({ content: 'スケジュール機能は無効化されています。', ephemeral: true }); } catch (e) { /* ignore */ }
  }
};
