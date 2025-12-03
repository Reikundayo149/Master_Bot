import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { hasPermission } from '../utils/permissions.mjs';
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
    .setDescription('ユーザーに警告を追加します（オプションでDM通知）')
    .addUserOption(opt => opt.setName('user').setDescription('対象ユーザー').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('理由'))
    .addBooleanOption(opt => opt.setName('dm').setDescription('警告をDMで送信するか'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const member = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || '理由が指定されていません';
    const dm = interaction.options.getBoolean('dm') || false;
    if (!hasPermission(interaction, PermissionFlagsBits.KickMembers)) return interaction.reply({ content: '権限がありません。', flags: 64 });
    const warns = loadWarns();
    const id = member.id;
    if (!warns[id]) warns[id] = [];
    warns[id].push({ moderator: interaction.user.id, reason, timestamp: new Date().toISOString() });
    saveWarns(warns);
    let replyText = `✅ ${member.tag} に警告を追加しました。現在の警告数: ${warns[id].length}`;
    if (dm) {
      try {
        await member.send(`あなたはサーバーで警告されました。理由: ${reason}`);
        replyText += '\n📩 DMで通知しました。';
      } catch (err) {
        console.error('DM送信に失敗:', err);
        replyText += '\n⚠️ DM送信に失敗しました。';
      }
    }
    // This command can do DM/file I/O; acknowledge early.
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
      await safeSend({ content: replyText, flags: 64 });
    } catch (err) {
      console.error('最終返信に失敗しました:', err);
    }
  },
};
