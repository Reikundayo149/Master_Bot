import dotenv from 'dotenv';
import { PermissionFlagsBits } from 'discord.js';

dotenv.config();

const OWNER_ID = process.env.OWNER_ID || '116915371795887719';

export function isOwner(userId) {
  return String(userId) === String(OWNER_ID);
}

export function hasPermission(interaction, permissionFlag) {
  if (!interaction) return false;
  if (isOwner(interaction.user?.id)) return true;
  try {
    return Boolean(interaction.member?.permissions?.has(permissionFlag));
  } catch {
    return false;
  }
}
