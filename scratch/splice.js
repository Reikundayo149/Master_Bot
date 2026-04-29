const fs = require('fs');

const content = fs.readFileSync('main.mjs', 'utf8');
const lines = content.split('\n');

// 1. Remove express import
const expressImportIdx = lines.findIndex(l => l.includes("import express from 'express';"));
if (expressImportIdx !== -1) lines.splice(expressImportIdx, 1);

// 2. Add panelHandler import
const pinMessageIdx = lines.findIndex(l => l.includes("import { handleNewMessage as handleBottomPinMessage } from './commands/pin-message.mjs';"));
if (pinMessageIdx !== -1) {
    lines.splice(pinMessageIdx + 1, 0, "import { handlePanelInteraction } from './handlers/panelHandler.mjs';");
}

// 3. Remove express server setup at the end
const expressSetupIdx = lines.findIndex(l => l.includes("// Express Webサーバーの設定（Render用）"));
if (expressSetupIdx !== -1) {
    lines.splice(expressSetupIdx, lines.length - expressSetupIdx);
}

// 4. Replace interactionCreate schedule code with panelHandler call
const interactionStart = lines.findIndex(l => l.includes("client.on('interactionCreate', async (interaction) => {"));
const interactionEnd = lines.findIndex(l => l.includes("// Only handle slash/chat commands here; other interaction types are not used by core bot."));

if (interactionStart !== -1 && interactionEnd !== -1) {
    const newHandler = `
    // パネルインタラクション処理
    if (await handlePanelInteraction(interaction)) {
        return; // パネル処理で完結した場合は終了
    }
`;
    lines.splice(interactionStart + 1, interactionEnd - interactionStart - 1, newHandler);
}

fs.writeFileSync('main.mjs', lines.join('\n'));
console.log('main.mjs patched successfully');
