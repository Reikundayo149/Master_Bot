import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('指定したユーザーをキックします')
    .addUserOption(opt => opt.setName('user').setDescription('キックするユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!member) {
      try { await interaction.reply({ content: 'サーバー内ユーザーを指定してください。', flags: 64 }); } catch {}
      return;
    }
    if (!hasPermission(interaction, PermissionFlagsBits.KickMembers)) {
      try { await interaction.reply({ content: '権限がありません (KickMembers)。', flags: 64 }); } catch {}
      return;
    }

    try { await interaction.deferReply({ flags: 64 }); } catch (e) {}
    const safeSend = async (payload) => {
      try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        try { return await interaction.followUp(payload); } catch (e) { console.error('返信に失敗しました:', e); }
      }
    };

    try {
      await member.kick(reason);
      const embed = new EmbedBuilder()
        .setTitle('👢 ユーザーをキックしました')
        .setDescription(`${member.user.tag}`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '🔰 実行者', value: interaction.user.tag, inline: true },
          { name: '📌 理由', value: reason, inline: true },
        )
        .setTimestamp();
      await safeSend({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await safeSend({ content: '❌ キックに失敗しました。', flags: 64 });
    }
  },
};
