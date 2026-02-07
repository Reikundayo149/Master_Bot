import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('create-channel')
    .setDescription('新しいチャンネルを作成します')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('チャンネル名')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('チャンネルのタイプ')
        .setRequired(false)
        .addChoices(
          { name: 'テキストチャンネル', value: 'text' },
          { name: 'ボイスチャンネル', value: 'voice' },
          { name: 'お知らせチャンネル', value: 'announcement' },
        ))
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('チャンネルのトピック（テキストチャンネルのみ）')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('作成先のカテゴリ')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)),
  async execute(interaction) {
    // テキストコマンドからの実行かどうかを判定
    const isTextCommand = !interaction.options.data;
    
    let channelName, channelType, topic, category;
    
    if (isTextCommand) {
      // テキストコマンドの場合、簡易的な引数パース
      const args = interaction.options.getString('name', false)?.split(/\s+/) || [];
      
      if (args.length === 0) {
        return await interaction.reply({
          content: '❌ 使い方: `!create-channel チャンネル名 [type:テキスト|ボイス|お知らせ] [topic:トピック]`\n例: `!create-channel 雑談 type:テキスト topic:自由に話そう`',
          ephemeral: true,
        });
      }
      
      channelName = args[0];
      
      // type:xxx, topic:xxx 形式の引数をパース
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('type:')) {
          const typeValue = arg.slice(5).toLowerCase();
          if (typeValue.includes('ボイス') || typeValue === 'voice') {
            channelType = 'voice';
          } else if (typeValue.includes('お知らせ') || typeValue === 'announcement') {
            channelType = 'announcement';
          } else {
            channelType = 'text';
          }
        } else if (arg.startsWith('topic:')) {
          topic = args.slice(i).join(' ').slice(6);
          break;
        }
      }
      
      channelType = channelType || 'text';
    } else {
      // スラッシュコマンドの場合
      channelName = interaction.options.getString('name');
      channelType = interaction.options.getString('type') || 'text';
      topic = interaction.options.getString('topic');
      category = interaction.options.getChannel('category');
    }

    // Botがチャンネル管理権限を持っているか確認
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return await interaction.reply({
        content: '❌ Botがチャンネル管理権限を持っていません。',
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply();

      let channelTypeEnum;
      let channelData = {
        name: channelName,
      };

      // チャンネルタイプを設定
      switch (channelType) {
        case 'voice':
          channelTypeEnum = ChannelType.GuildVoice;
          break;
        case 'announcement':
          channelTypeEnum = ChannelType.GuildAnnouncement;
          if (topic) channelData.topic = topic;
          break;
        case 'text':
        default:
          channelTypeEnum = ChannelType.GuildText;
          if (topic) channelData.topic = topic;
          break;
      }

      channelData.type = channelTypeEnum;

      // カテゴリが指定されている場合
      if (category) {
        channelData.parent = category.id;
      }

      // チャンネルを作成
      const newChannel = await interaction.guild.channels.create(channelData);

      const typeDisplay = channelType === 'voice' ? 'ボイス' : 
                          channelType === 'announcement' ? 'お知らせ' : 'テキスト';

      await interaction.editReply({
        content: `✅ ${typeDisplay}チャンネル ${newChannel} を作成しました！`,
      });

      console.log(`📝 ${interaction.user.tag} が /create-channel を使用してチャンネル「${channelName}」を作成`);
    } catch (error) {
      console.error('チャンネル作成エラー:', error);
      const errorMessage = error.message || '不明なエラー';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ チャンネルの作成に失敗しました: ${errorMessage}`,
        });
      } else {
        await interaction.reply({
          content: `❌ チャンネルの作成に失敗しました: ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  },
};
