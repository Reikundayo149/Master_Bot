import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

// 各チャンネルのボトムピンメッセージを管理
const bottomPinnedMessages = new Map();

// メッセージ更新の防止フラグ（無限ループ防止）
const updatingChannels = new Set();

export default {
  data: new SlashCommandBuilder()
    .setName('pin-message')
    .setDescription('メッセージを最下層（最新位置）に常に表示します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('最下層に固定するメッセージを設定します')
        .addStringOption(option =>
          option
            .setName('content')
            .setDescription('表示するメッセージ内容')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('interval')
            .setDescription('更新間隔（分）デフォルト: 60分')
            .setMinValue(5)
            .setMaxValue(1440)
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('埋め込みの色（例: #FF5733）')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('最下層固定を停止します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('現在の設定を確認します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('すぐにメッセージを更新します')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      await handleSet(interaction);
    } else if (subcommand === 'stop') {
      await handleStop(interaction);
    } else if (subcommand === 'status') {
      await handleStatus(interaction);
    } else if (subcommand === 'update') {
      await handleUpdate(interaction);
    }
  },
};

async function handleSet(interaction) {
  const content = interaction.options.getString('content').replace(/\\n/g, '\n');
  const interval = interaction.options.getInteger('interval') || 60;
  const color = interaction.options.getString('color') || '#5865F2';
  const channelId = interaction.channelId;

  // 既存のタイマーがあればクリア
  const existing = bottomPinnedMessages.get(channelId);
  if (existing && existing.intervalId) {
    clearInterval(existing.intervalId);
  }

  // 初回メッセージを送信
  let lastMessage;
  try {
    const embed = new EmbedBuilder()
      .setDescription(content)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: '📌 このメッセージは自動的に最下層に更新されます' });

    lastMessage = await interaction.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    await interaction.reply({
      content: '❌ メッセージの送信に失敗しました。',
      ephemeral: true
    });
    return;
  }

  // 定期的に再送信
  const intervalId = setInterval(async () => {
    try {
      // 古いメッセージを削除
      if (lastMessage) {
        await lastMessage.delete().catch(err => 
          console.log('古いメッセージの削除に失敗:', err.message)
        );
      }

      // 新しいメッセージを送信
      const savedData = bottomPinnedMessages.get(channelId);
      const embed = new EmbedBuilder()
        .setDescription(savedData ? savedData.content : content)
        .setColor(savedData ? savedData.color : color)
        .setTimestamp()
        .setFooter({ text: '📌 このメッセージは自動的に最下層に更新されます' });

      lastMessage = await interaction.channel.send({ embeds: [embed] });

      // 保存されている参照を更新
      if (savedData) {
        savedData.lastMessage = lastMessage;
      }

      console.log(`✅ チャンネル ${channelId} のボトムピンメッセージを更新しました`);
    } catch (error) {
      console.error('メッセージ更新エラー:', error);
    }
  }, interval * 60 * 1000);

  // 設定を保存
  bottomPinnedMessages.set(channelId, {
    content,
    interval,
    color,
    intervalId,
    lastMessage,
    createdBy: interaction.user.tag,
    createdAt: new Date()
  });

  await interaction.reply({
    content: `✅ 最下層固定メッセージを設定しました！\n📝 内容: ${content}\n⏱️ 更新間隔: ${interval}分`,
    ephemeral: true
  });

  console.log(`📌 ${interaction.user.tag} がチャンネル ${channelId} にボトムピンを設定`);
}

async function handleStop(interaction) {
  const channelId = interaction.channelId;
  const data = bottomPinnedMessages.get(channelId);

  if (!data) {
    await interaction.reply({
      content: '❌ このチャンネルには設定されたボトムピンメッセージがありません。',
      ephemeral: true
    });
    return;
  }

  // タイマーをクリア
  if (data.intervalId) {
    clearInterval(data.intervalId);
  }

  // 最後のメッセージを削除
  if (data.lastMessage) {
    try {
      await data.lastMessage.delete();
    } catch (error) {
      console.log('メッセージ削除エラー:', error.message);
    }
  }

  bottomPinnedMessages.delete(channelId);

  await interaction.reply({
    content: '✅ 最下層固定メッセージを停止しました。',
    ephemeral: true
  });

  console.log(`🛑 ${interaction.user.tag} がチャンネル ${channelId} のボトムピンを停止`);
}

async function handleStatus(interaction) {
  const channelId = interaction.channelId;
  const data = bottomPinnedMessages.get(channelId);

  if (!data) {
    await interaction.reply({
      content: 'ℹ️ このチャンネルには設定されたボトムピンメッセージがありません。',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📌 ボトムピン設定状況')
    .addFields(
      { name: '📝 メッセージ内容', value: data.content, inline: false },
      { name: '⏱️ 更新間隔', value: `${data.interval}分`, inline: true },
      { name: '🎨 色', value: data.color, inline: true },
      { name: '👤 設定者', value: data.createdBy, inline: true },
      { name: '📅 設定日時', value: data.createdAt.toLocaleString('ja-JP'), inline: false }
    )
    .setColor(data.color)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUpdate(interaction) {
  const channelId = interaction.channelId;
  const data = bottomPinnedMessages.get(channelId);

  if (!data) {
    await interaction.reply({
      content: '❌ このチャンネルには設定されたボトムピンメッセージがありません。',
      ephemeral: true
    });
    return;
  }

  try {
    // 古いメッセージを削除
    if (data.lastMessage) {
      await data.lastMessage.delete().catch(err => 
        console.log('古いメッセージの削除に失敗:', err.message)
      );
    }

    // 新しいメッセージを送信（既に改行変換済みのcontentを使用）
    const embed = new EmbedBuilder()
      .setDescription(data.content)
      .setColor(data.color)
      .setTimestamp()
      .setFooter({ text: '📌 このメッセージは自動的に最下層に更新されます' });

    data.lastMessage = await interaction.channel.send({ embeds: [embed] });

    await interaction.reply({
      content: '✅ メッセージを更新しました！',
      ephemeral: true
    });

    console.log(`🔄 ${interaction.user.tag} がチャンネル ${channelId} のボトムピンを手動更新`);
  } catch (error) {
    console.error('メッセージ更新エラー:', error);
    await interaction.reply({
      content: '❌ メッセージの更新に失敗しました。',
      ephemeral: true
    });
  }
}

// 新しいメッセージが投稿されたときに呼び出される関数
export async function handleNewMessage(message) {
  const channelId = message.channelId;
  const data = bottomPinnedMessages.get(channelId);

  // このチャンネルにボトムピンが設定されていない場合は何もしない
  if (!data) return;

  // Bot自身のメッセージや更新中は無視（無限ループ防止）
  if (message.author.bot || updatingChannels.has(channelId)) return;

  try {
    // 更新中フラグをセット
    updatingChannels.add(channelId);

    // 古いメッセージを削除
    if (data.lastMessage) {
      await data.lastMessage.delete().catch(err => 
        console.log('古いメッセージの削除に失敗:', err.message)
      );
    }

    // 新しいメッセージを送信（既に改行変換済みのcontentを使用）
    const embed = new EmbedBuilder()
      .setDescription(data.content)
      .setColor(data.color)
      .setTimestamp()
      .setFooter({ text: '📌 このメッセージは自動的に最下層に更新されます' });

    data.lastMessage = await message.channel.send({ embeds: [embed] });

    console.log(`♻️ チャンネル ${channelId} のボトムピンメッセージをリアルタイム更新`);
  } catch (error) {
    console.error('リアルタイム更新エラー:', error);
  } finally {
    // 更新完了後、フラグを解除（少し遅延を入れる）
    setTimeout(() => {
      updatingChannels.delete(channelId);
    }, 1000);
  }
}

// クリーンアップ関数（Botが終了する際に呼び出す）
export function cleanup() {
  for (const [channelId, data] of bottomPinnedMessages.entries()) {
    if (data.intervalId) {
      clearInterval(data.intervalId);
      console.log(`🧹 チャンネル ${channelId} のボトムピンタイマーをクリア`);
    }
  }
  bottomPinnedMessages.clear();
}
