import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'channelCreateConfig.json');

/**
 * 設定ファイルを読み込む
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { channelMappings: {} };
    }
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗:', error);
    return { channelMappings: {} };
  }
}

/**
 * 設定ファイルを保存する
 */
function saveConfig(config) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('設定ファイルの保存に失敗:', error);
    return false;
  }
}

/**
 * チャンネルとカテゴリーのマッピングを追加
 */
export function setChannelMapping(channelId, categoryId) {
  const config = loadConfig();
  config.channelMappings[channelId] = categoryId;
  return saveConfig(config);
}

/**
 * チャンネルに対応するカテゴリーIDを取得
 */
export function getCategoryForChannel(channelId) {
  const config = loadConfig();
  return config.channelMappings[channelId] || null;
}

/**
 * マッピングを削除
 */
export function removeChannelMapping(channelId) {
  const config = loadConfig();
  delete config.channelMappings[channelId];
  return saveConfig(config);
}

/**
 * すべてのマッピングを取得
 */
export function getAllMappings() {
  const config = loadConfig();
  return config.channelMappings;
}
