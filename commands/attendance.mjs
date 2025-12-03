import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('attendance').setDescription('出欠機能（無効化）'),
  async execute(interaction) {
    try { await interaction.reply({ content: '出欠／スケジュール機能は無効化されています。', ephemeral: true }); } catch (e) {}
  }
};
