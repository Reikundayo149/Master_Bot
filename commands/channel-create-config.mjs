import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { setChannelMapping, removeChannelMapping, getAllMappings } from '../utils/channelCreateConfig.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('channel-create-config')
    .setDescription('チャンネル作成の設定を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('チャンネルとカテゴリーのマッピングを設定')
        .addChannelOption(option =>
          option.setName('command-channel')
            .setDescription('コマンドを実行するチャンネル')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('target-category')
            .setDescription('チャンネルを作成するカテゴリー')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('マッピングを削除')
        .addChannelOption(option =>
          option.setName('command-channel')
            .setDescription('削除するチャンネル')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('現在のマッピングを表示')),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const commandChannel = interaction.options.getChannel('command-channel');
      const targetCategory = interaction.options.getChannel('target-category');

      const success = setChannelMapping(commandChannel.id, targetCategory.id);
      
      if (success) {
        await interaction.reply({
          content: `✅ 設定完了: ${commandChannel} でコマンドを実行すると、${targetCategory} の最下層にチャンネルが作成されます。`,
          ephemeral: true,
        });
        console.log(`📝 ${interaction.user.tag} がチャンネル作成マッピングを設定: ${commandChannel.id} -> ${targetCategory.id}`);
      } else {
        await interaction.reply({
          content: '❌ 設定の保存に失敗しました。',
          ephemeral: true,
        });
      }
    } else if (subcommand === 'remove') {
      const commandChannel = interaction.options.getChannel('command-channel');
      
      const success = removeChannelMapping(commandChannel.id);
      
      if (success) {
        await interaction.reply({
          content: `✅ ${commandChannel} のマッピングを削除しました。`,
          ephemeral: true,
        });
        console.log(`📝 ${interaction.user.tag} がチャンネル作成マッピングを削除: ${commandChannel.id}`);
      } else {
        await interaction.reply({
          content: '❌ マッピングの削除に失敗しました。',
          ephemeral: true,
        });
      }
    } else if (subcommand === 'list') {
      const mappings = getAllMappings();
      
      if (Object.keys(mappings).length === 0) {
        await interaction.reply({
          content: '現在、マッピングは設定されていません。',
          ephemeral: true,
        });
        return;
      }

      let listText = '**現在のマッピング:**\n\n';
      for (const [channelId, categoryId] of Object.entries(mappings)) {
        const channel = interaction.guild.channels.cache.get(channelId);
        const category = interaction.guild.channels.cache.get(categoryId);
        
        const channelName = channel ? `<#${channelId}>` : `ID: ${channelId}`;
        const categoryName = category ? category.name : `ID: ${categoryId}`;
        
        listText += `${channelName} → **${categoryName}**\n`;
      }

      await interaction.reply({
        content: listText,
        ephemeral: true,
      });
    }
  },
};
