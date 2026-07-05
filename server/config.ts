/**
 * Persistent configuration module
 * Stores admin-editable settings in a JSON file so changes survive server restarts.
 * Falls back to environment variables if the file doesn't exist.
 */

import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "data", "config.json");

export interface AppConfig {
  adminPin: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramFaceidBotToken: string;
  telegramFaceidChatId: string;
}

function getDefaults(): AppConfig {
  return {
    adminPin: process.env.ADMIN_PIN || "3312",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
    telegramFaceidBotToken: process.env.TELEGRAM_FACEID_BOT_TOKEN || "",
    telegramFaceidChatId: process.env.TELEGRAM_FACEID_CHAT_ID || "",
  };
}

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(raw) as Partial<AppConfig>;
      const defaults = getDefaults();
      return {
        adminPin: saved.adminPin || defaults.adminPin,
        telegramBotToken: saved.telegramBotToken || defaults.telegramBotToken,
        telegramChatId: saved.telegramChatId || defaults.telegramChatId,
        telegramFaceidBotToken: saved.telegramFaceidBotToken || defaults.telegramFaceidBotToken,
        telegramFaceidChatId: saved.telegramFaceidChatId || defaults.telegramFaceidChatId,
      };
    }
  } catch (e) {
    console.error("[Config] Error loading config:", e);
  }
  return getDefaults();
}

export function saveConfig(config: Partial<AppConfig>): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = loadConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (e) {
    console.error("[Config] Error saving config:", e);
    throw e;
  }
}
