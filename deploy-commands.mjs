import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('DISCORD_TOKEN と CLIENT_ID を環境変数に設定してください');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(process.cwd(), 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.mjs'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const { default: command } = await import(pathToFileURL(filePath).href);
    if (command?.data?.toJSON) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⚙️ コマンドを登録中...');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('✅ ギルドコマンドを登録しました');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ グローバルコマンドを登録しました');
    }
  } catch (error) {
    console.error(error);
  }
})();
