import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('運営管理センターパネルを設置します。'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('👑 運営管理センター')
      .setDescription('以下のボタンから出欠管理やデータ出力を行えます。\n※このパネルは運営メンバー専用です。')
      .setColor('#ffcc00');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_create_event')
        .setLabel('📅 イベント作成')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_tally')
        .setLabel('📊 出欠集計')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_export')
        .setLabel('📥 データ出力')
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('setupPanel error:', err);
      try { await interaction.channel.send({ embeds: [embed], components: [row] }); } catch(e){}
    }
  }
};
