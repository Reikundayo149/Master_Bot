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
  console.log(`Found ${commandFiles.length} command file(s):`, commandFiles);
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const { default: command } = await import(pathToFileURL(filePath).href);
      if (command?.data?.toJSON) {
        commands.push(command.data.toJSON());
      } else {
        console.warn(`Warning: ${file} does not export a command with data.toJSON()`);
      }
    } catch (err) {
      console.error(`Failed to import ${file}:`, err);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⚙️ コマンドを登録中...');
    console.log(`Prepared ${commands.length} command(s) for registration:`, commands.map(c => c.name));
    if (guildId) {
      // 複数のギルドIDに対応
      const guildIds = guildId.split(',').map(id => id.trim());
      console.log(`Registering commands for ${guildIds.length} guild(s)...`);
      
      for (const id of guildIds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, id), { body: commands });
          console.log(`✅ ギルド ${id} にコマンドを登録しました`);
        } catch (error) {
          console.error(`❌ ギルド ${id} へのコマンド登録に失敗:`, error.message);
        }
      }
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ グローバルコマンドを登録しました');
    }
  } catch (error) {
    console.error(error);
  }
})();
