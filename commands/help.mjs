import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const ALL_COMMANDS = [
  { sig: '/ban <user> [reason]', admin: true },
  { sig: '/unban <user_id>', admin: true },
  { sig: '/timeout <user> <minutes> [reason]', admin: true },
  { sig: '/untimeout <user>', admin: true },
  { sig: '/kick <user> [reason]', admin: true },
  { sig: '/serverinfo', admin: false },
  { sig: '/userinfo [user]', admin: false },
  { sig: '/clear <amount>', admin: true },
  { sig: '/ping', admin: false },
  { sig: '/warn <user> [reason] (dm:false)', admin: true },
  { sig: '/warn <user> [reason] (dm:true)', admin: true },
  { sig: '/warn_remove <user> [index/all]', admin: true },
];

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('利用可能なコマンド一覧を表示します'),
  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const allowedExtra = (process.env.HELP_ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);
    const isExtraAllowed = allowedExtra.includes(interaction.user.id);
    const visible = ALL_COMMANDS.filter(c => !c.admin || isAdmin || isExtraAllowed);
    const lines = visible.map(c => c.sig);
    await interaction.reply({ content: `\`\`\`\n${lines.join('\n')}\n\`\`\``, flags: 64 });
  },
};
