import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('指定したユーザーをBANします')
    .addUserOption(opt => opt.setName('user').setDescription('BANするユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!target) {
      try { await interaction.reply({ content: 'サーバー内ユーザーを指定してください。', flags: 64 }); } catch {}
      return;
    }
    if (!hasPermission(interaction, PermissionFlagsBits.BanMembers)) {
      try { await interaction.reply({ content: '権限がありません (BanMembers)。', flags: 64 }); } catch {}
      return;
    }

    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}
    const safeSend = async (payload) => {
      try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        try { return await interaction.followUp(payload); } catch (e) { console.error('返信に失敗しました:', e); }
      }
    };

    try {
      await target.ban({ reason });
      const embed = new EmbedBuilder()
        .setTitle('⛔ ユーザーをBANしました')
        .setDescription(`🔨 ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '🔰 モデレーター', value: interaction.user.tag, inline: true },
          { name: '📌 理由', value: reason, inline: true },
          { name: '🆔 ユーザーID', value: target.id, inline: true },
        )
        .setTimestamp();
      await safeSend({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await safeSend({ content: '❌ BAN に失敗しました。', flags: 64 });
    }
  },
};
