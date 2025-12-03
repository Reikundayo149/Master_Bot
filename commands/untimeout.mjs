import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('指定したユーザーのタイムアウトを解除します')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    if (!member) {
      try { await interaction.reply({ content: 'サーバー内ユーザーを指定してください。', flags: 64 }); } catch {}
      return;
    }
    if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers)) {
      try { await interaction.reply({ content: '権限がありません (ModerateMembers)。', flags: 64 }); } catch {}
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
      await member.timeout(null);
      const embed = new EmbedBuilder()
        .setTitle('🔓 タイムアウト解除')
        .setDescription(`✅ ${member.user.tag} のタイムアウトを解除しました`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: '🔰 実行者', value: interaction.user.tag, inline: true })
        .setTimestamp();
      await safeSend({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await safeSend({ content: '❌ タイムアウト解除に失敗しました。', flags: 64 });
    }
  },
};
