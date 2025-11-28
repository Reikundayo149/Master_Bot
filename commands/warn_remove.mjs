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
    .setName('warn_remove')
    .setDescription('ユーザーの警告を削除します（インデックス指定、未指定で全削除）')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .addIntegerOption(opt => opt.setName('index').setDescription('削除する警告のインデックス（1始まり）'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const member = interaction.options.getUser('user');
    const index = interaction.options.getInteger('index');
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '権限がありません。', ephemeral: true });
    const warns = loadWarns();
    const id = member.id;
    if (!warns[id] || warns[id].length === 0) return interaction.reply({ content: '警告が見つかりません。', ephemeral: true });
    if (!index) {
      delete warns[id];
      saveWarns(warns);
      return interaction.reply({ content: `✅ ${member.tag} の警告をすべて削除しました。` });
    }
    if (index < 1 || index > warns[id].length) return interaction.reply({ content: '無効なインデックスです。', ephemeral: true });
    warns[id].splice(index - 1, 1);
    if (warns[id].length === 0) delete warns[id];
    saveWarns(warns);
    return interaction.reply({ content: `✅ ${member.tag} の警告（インデックス ${index}）を削除しました。` });
  },
};
