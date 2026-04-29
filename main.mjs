// main.mjs - Discord Botのメインプログラム

// 必要なライブラリを読み込み
import { Client, GatewayIntentBits, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { handleNewMessage as handleBottomPinMessage } from './commands/pin-message.mjs';
import { handlePanelInteraction } from './handlers/panelHandler.mjs';
import * as http from 'node:http';

// .envファイルから環境変数を読み込み
dotenv.config();

// Discord Botクライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Botが起動完了したときの処理
let __clientReadyHandled = false;
async function handleClientReady() {
    if (__clientReadyHandled) return;
    __clientReadyHandled = true;
    console.log(`🎉 ${client.user.tag} が正常に起動しました！`);
    console.log(`📊 ${client.guilds.cache.size} つのサーバーに参加中`);
}

// 新しいイベント名 'clientReady' に対応しつつ、互換性のため 'ready' も受け付ける
client.on('clientReady', handleClientReady);

// コマンドプレフィックス設定（環境変数で変更可能）
const PREFIX = process.env.COMMAND_PREFIX || '!';

// コマンドエイリアス（短縮形）の定義
const COMMAND_ALIASES = {
    'chcreate': 'create-channel',
};

// メッセージが送信されたときの処理（従来のテキストコマンド対応）
client.on('messageCreate', async (message) => {
    // ボトムピンメッセージのリアルタイム更新処理
    await handleBottomPinMessage(message);

    if (message.author.bot) return;

    // テキストコマンド処理
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
        let commandName = args.shift().toLowerCase();

        // エイリアスを実際のコマンド名に変換
        if (COMMAND_ALIASES[commandName]) {
            commandName = COMMAND_ALIASES[commandName];
        }

        // コマンドが存在するか確認
        if (!client.commands || !client.commands.has(commandName)) {
            // 旧式のpingコマンド互換性維持
            if (commandName === 'ping' || message.content.toLowerCase() === 'ping') {
                message.reply('🏓 pong!');
                console.log(`📝 ${message.author.tag} が ping コマンドを使用`);
            }
            return;
        }

        const command = client.commands.get(commandName);

        try {
            // スラッシュコマンド用のインタラクションをエミュレート
            const fakeInteraction = {
                commandName,
                user: message.author,
                member: message.member,
                guild: message.guild,
                channel: message.channel,
                channelId: message.channelId,
                guildId: message.guildId,
                client: message.client,
                deferred: false,
                replied: false,
                options: {
                    // 引数をパース（簡易版）
                    getString(name, required = false) {
                        const value = args.join(' ') || null;
                        if (required && !value) throw new Error(`必須パラメータ '${name}' が指定されていません`);
                        return value;
                    },
                    getChannel(name) {
                        const channelMention = args.find(arg => arg.startsWith('<#') && arg.endsWith('>'));
                        if (!channelMention) return null;
                        const channelId = channelMention.slice(2, -1);
                        return message.guild.channels.cache.get(channelId);
                    },
                    getUser(name) {
                        const userMention = args.find(arg => arg.startsWith('<@') && arg.endsWith('>'));
                        if (!userMention) return null;
                        const userId = userMention.replace(/[<@!>]/g, '');
                        return message.guild.members.cache.get(userId)?.user;
                    },
                    getMember(name) {
                        const userMention = args.find(arg => arg.startsWith('<@') && arg.endsWith('>'));
                        if (!userMention) return null;
                        const userId = userMention.replace(/[<@!>]/g, '');
                        return message.guild.members.cache.get(userId);
                    },
                },
                async reply(options) {
                    this.replied = true;
                    const content = typeof options === 'string' ? options : options.content;
                    const embeds = typeof options === 'object' ? options.embeds : undefined;
                    const ephemeral = typeof options === 'object' ? options.ephemeral : false;

                    if (ephemeral) {
                        // ephemeralの場合はDMで送信を試みる
                        try {
                            await message.author.send({ content, embeds });
                            await message.react('✅');
                        } catch (e) {
                            await message.reply({ content: `(本来は非公開メッセージ)\n${content}`, embeds });
                        }
                    } else {
                        await message.reply({ content, embeds });
                    }
                },
                async deferReply() {
                    this.deferred = true;
                    await message.channel.sendTyping();
                },
                async editReply(options) {
                    const content = typeof options === 'string' ? options : options.content;
                    const embeds = typeof options === 'object' ? options.embeds : undefined;
                    await message.reply({ content, embeds });
                },
                async followUp(options) {
                    const content = typeof options === 'string' ? options : options.content;
                    const embeds = typeof options === 'object' ? options.embeds : undefined;
                    await message.channel.send({ content, embeds });
                },
            };

            // コマンドを実行
            await command.execute(fakeInteraction);
            console.log(`📝 ${message.author.tag} がテキストコマンド ${PREFIX}${commandName} を使用`);
        } catch (error) {
            console.error(`テキストコマンド ${commandName} の実行中にエラー:`, error);
            try {
                const errorMsg = `❌ コマンドの実行中にエラーが発生しました: ${error.message}`;
                await message.reply(errorMsg);
            } catch (e) {
                console.error('エラーメッセージの送信に失敗:', e);
            }
        }
    } else if (message.content.toLowerCase() === 'ping') {
        // プレフィックスなしのpingも互換性維持
        message.reply('🏓 pong!');
        console.log(`📝 ${message.author.tag} が ping コマンドを使用`);
    }
});

// スラッシュコマンド（インタラクション）処理

client.on('interactionCreate', async (interaction) => {
    // パネルインタラクション処理
    if (await handlePanelInteraction(interaction)) {
        return; // パネル処理で完結した場合は終了
    }

    // Only handle slash/chat commands here; other interaction types are not used by core bot.
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    // 安全な reply/followUp を動的にラップして注入する
    const origReply = interaction.reply.bind(interaction);
    const origFollowUp = interaction.followUp ? interaction.followUp.bind(interaction) : null;
    interaction.reply = async (options) => {
        try {
            return await origReply(options);
        } catch (err) {
            // If interaction is already expired/unknown, ignore instead of throwing.
            try {
                if (err && err.code === 10062) {
                    console.warn('Unknown interaction when replying — ignored.');
                    return null;
                }
            } catch (e) { }
            try {
                if (interaction.deferred) {
                    return await interaction.editReply(options);
                }
                if (interaction.replied && origFollowUp) {
                    return await origFollowUp(options);
                }
            } catch (err2) { }
            throw err;
        }
    };
    if (origFollowUp) {
        interaction.followUp = async (options) => {
            try {
                // If the interaction has not been replied to or deferred, prefer sending a reply
                if (!interaction.replied && !interaction.deferred) {
                    return await origReply(options);
                }
                return await origFollowUp(options);
            } catch (err) {
                // Ignore unknown interaction errors from followUp
                try {
                    if (err && err.code === 10062) {
                        console.warn('Unknown interaction when followUp — ignored.');
                        return null;
                    }
                } catch (e) { }
                try {
                    if (interaction.deferred) return await interaction.editReply(options);
                    if (interaction.replied) return await origFollowUp(options);
                } catch (err2) { }
                throw err;
            }
        };
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('コマンド実行中のエラー:', error);
        // Robust fallback sequence: prefer editReply if deferred, origFollowUp if already replied,
        // otherwise try origReply, then channel send as last resort.
        try {
            if (interaction.deferred) {
                try { await interaction.editReply({ content: 'エラーが発生しました。' }); return; } catch (e) { console.error('editReply failed:', e); }
            }

            if (interaction.replied && origFollowUp) {
                try { await origFollowUp({ content: 'エラーが発生しました。', flags: 64 }); return; } catch (e) { console.error('origFollowUp failed:', e); }
            }

            // If not deferred/replied, try to reply normally
            try { await origReply({ content: 'エラーが発生しました。', flags: 64 }); return; } catch (rErr) { console.error('origReply failed:', rErr); }

            // As a last resort, post to the channel if available
            try { await interaction.channel?.send?.('エラーが発生しました。'); } catch (chErr) { console.error('チャンネル送信にも失敗しました:', chErr); }
        } catch (finalErr) {
            console.error('エラー返信の全フォールバックに失敗しました:', finalErr);
        }
    }
});

// エラーハンドリング
client.on('error', (error) => {
    console.error('❌ Discord クライアントエラー:', error);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
    console.log('🛑 Botを終了しています...');
    client.destroy();
    process.exit(0);
});

// Discord にログイン
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN が環境変数に設定されていません！');
    process.exit(1);
}

(async () => {
    // Ensure `client.commands` collection exists and load command modules from the `commands` directory.
    // Defines `loadCommands` here if it was accidentally removed.
    async function loadCommands() {
        client.commands = new Collection();
        const commandsPath = path.join(process.cwd(), 'commands');
        if (!fs.existsSync(commandsPath)) {
            console.warn('⚠️ commands ディレクトリが見つかりません:', commandsPath);
            return;
        }
        const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.mjs'));
        for (const file of files) {
            try {
                const full = path.join(commandsPath, file);
                const mod = await import(pathToFileURL(full).href);
                const cmd = mod.default || mod;
                if (cmd && cmd.data && cmd.data.name) {
                    client.commands.set(cmd.data.name, cmd);
                    console.log(`✅ コマンドをロードしました: ${cmd.data.name}`);
                } else {
                    console.warn('⚠️ コマンドが正しい構造ではありません:', file);
                }
            } catch (err) {
                console.error('コマンドの読み込みに失敗しました:', file, err);
            }
        }
    }

    // Load commands then login
    try {
        await loadCommands();
    } catch (err) {
        console.error('loadCommands 実行中にエラーが発生しました:', err);
    }
    console.log('🔄 Discord に接続中...');
    client.login(process.env.DISCORD_TOKEN)
        .catch(error => {
            console.error('❌ ログインに失敗しました:', error);
            process.exit(1);
        });

    // Renderのポートスキャンをパスするための簡易サーバー
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is running!');
    }).listen(process.env.PORT || 3000);
})();