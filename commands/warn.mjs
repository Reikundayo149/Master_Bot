import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data');
const WARNS_FILE = path.join(DATA_PATH, 'warns.json');

function loadWarns() {
  try {
    if (!fs.existsSync(WARNS_FILE)) return {};
    return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveWarns(data) {
  if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH, { recursive: true });
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('ユーザーに警告を追加します')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const member = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '権限がありません。', ephemeral: true });
    const warns = loadWarns();
    const id = member.id;
    if (!warns[id]) warns[id] = [];
    warns[id].push({ moderator: interaction.user.id, reason, timestamp: new Date().toISOString() });
    saveWarns(warns);
    await interaction.reply({ content: `✅ ${member.tag} に警告を追加しました。現在の警告数: ${warns[id].length}` });
  },
};
