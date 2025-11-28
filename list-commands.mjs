import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('DISCORD_TOKEN と CLIENT_ID を環境変数に設定してください');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    if (guildId) {
      const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      console.log(`Guild (${guildId}) commands:`);
      console.log(JSON.stringify(cmds, null, 2));
    } else {
      const cmds = await rest.get(Routes.applicationCommands(clientId));
      console.log('Global commands:');
      console.log(JSON.stringify(cmds, null, 2));
    }
  } catch (err) {
    console.error('Failed to list commands:', err);
  }
})();
