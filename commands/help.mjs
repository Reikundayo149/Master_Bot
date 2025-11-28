import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

const MOD_COMMANDS = [
  { sig: '/ban <user> [reason]', desc: 'ユーザーをBANします', emoji: '⛔', example: '/ban @user 迷惑行為' },
  { sig: '/unban <user_id>', desc: '指定IDのBANを解除します', emoji: '🔓', example: '/unban 123456789012345678' },
  { sig: '/timeout <user> <minutes> [reason]', desc: '指定ユーザーをタイムアウトします', emoji: '⏳', example: '/timeout @user 30 スパム' },
  { sig: '/untimeout <user>', desc: 'タイムアウトを解除します', emoji: '🔓', example: '/untimeout @user' },
  { sig: '/kick <user> [reason]', desc: 'ユーザーをキックします', emoji: '👢', example: '/kick @user 規約違反' },
  { sig: '/clear <amount>', desc: 'メッセージを一括削除します', emoji: '🧹', example: '/clear 50' },
  { sig: '/warn <user> [reason] (dm:true/false)', desc: '警告を付与します（DM送信可）', emoji: '⚠️', example: '/warn @user Spam dm:true' },
  { sig: '/warn_remove <user> [index/all]', desc: '警告を削除します', emoji: '🗑️', example: '/warn_remove @user 1' },
];

const UTIL_COMMANDS = [
  { sig: '/serverinfo', desc: 'サーバー情報を表示します', emoji: '🌐', example: '/serverinfo' },
  { sig: '/userinfo [user]', desc: 'ユーザー情報を表示します', emoji: '👤', example: '/userinfo @user' },
  { sig: '/ping', desc: 'Botのレイテンシを確認します', emoji: '🏓', example: '/ping' },
  { sig: '/help', desc: 'このヘルプを表示します', emoji: '📖', example: '/help' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('利用可能なコマンド一覧を表示します'),
  async execute(interaction) {
    const isAdmin = hasPermission(interaction, PermissionFlagsBits.Administrator);
    const ownerAllowed = (process.env.OWNER_ID && String(process.env.OWNER_ID) === String(interaction.user.id));
    const allowedExtra = (process.env.HELP_ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);
    const isExtraAllowed = allowedExtra.includes(interaction.user.id) || ownerAllowed;

    const embed = new EmbedBuilder()
      .setTitle('📋 コマンド一覧')
      .setDescription('利用可能なコマンドをカテゴリ別に表示します。管理者専用コマンドは権限のあるユーザーにのみ表示されます。')
      .setColor(0x5865F2)
      .setTimestamp()
      .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() });

    if (interaction.guild) {
      const icon = interaction.guild.iconURL();
      if (icon) embed.setThumbnail(icon);
    }

    // Moderation: show only if admin or explicitly allowed
    if (isAdmin || isExtraAllowed) {
      const modLines = MOD_COMMANDS.map(c => `${c.emoji} **${c.sig}** — ${c.desc}\n例: \\`${c.example}\\``);
      embed.addFields({ name: '🛡️ Moderation', value: modLines.join('\n\n') });
    } else {
      embed.addFields({ name: '🛡️ Moderation', value: 'このカテゴリのコマンドは管理者のみが表示できます。' });
    }

    // Utilities: always visible
    const utilLines = UTIL_COMMANDS.map(c => `${c.emoji} **${c.sig}** — ${c.desc}\n例: \\`${c.example}\\``);
    embed.addFields({ name: '🔧 Utilities', value: utilLines.join('\n\n') });

    // Footer with tips
    embed.setFooter({ text: '詳しい使い方は /help を参照。所有者はすべてのコマンドを表示できます。' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
