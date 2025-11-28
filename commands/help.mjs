import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('利用可能なコマンド一覧を表示します'),
  async execute(interaction) {
    const helpText = [
      '/ban <user> [reason] - ユーザーをBAN
      /unban <user_id> - BAN解除
      /timeout <user> <minutes> [reason] - タイムアウト
      /untimeout <user> - タイムアウト解除
      /kick <user> [reason] - キック
      /serverinfo - サーバー情報
      /userinfo [user] - ユーザー情報
      /clear <amount> - メッセージ削除
      /ping - レイテンシ確認
      /warn <user> [reason] - 警告を追加
      /warn_remove <user> [index/all] - 警告削除
    ].join('\n');
    await interaction.reply({ content: '```
' + helpText + '\n```', ephemeral: true });
  },
};
