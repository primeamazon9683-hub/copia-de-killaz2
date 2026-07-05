/**
 * Security Middleware
 * - Anti-bot detection (Puppeteer, Selenium, headless browsers, scrapers)
 * - Google agent blocking (Googlebot, crawlers, AdsBot, etc.)
 * - Suspicious header detection
 * - Country-based IP blocking (Colombia only)
 */

import type { Request, Response, NextFunction } from "express";
import geoip from "geoip-lite";

// ─── Google & crawler user-agent patterns ───────────────────────────────────
const BLOCKED_UA_PATTERNS = [
  // Google bots
  /googlebot/i,
  /google-inspectiontool/i,
  /google-read-aloud/i,
  /google-structured-data-testing/i,
  /adsbot-google/i,
  /mediapartners-google/i,
  /googleweblight/i,
  /google-safety/i,
  /google-extended/i,
  /google-cloudvertexbot/i,
  /google-other/i,
  /google-site-verification/i,
  /feedfetcher-google/i,
  /apis-google/i,
  // Other major crawlers
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /ia_archiver/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /linkdexbot/i,
  /screaming frog/i,
  /seokicks/i,
  /spbot/i,
  /blexbot/i,
  /seznambot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /anthropic-ai/i,
  /ccbot/i,
  /omgili/i,
  /dataforseo/i,
  // Security scanners & antiphishing
  /phishtank/i,
  /virustotal/i,
  /netcraft/i,
  /safebrowsing/i,
  /kaspersky/i,
  /norton/i,
  /symantec/i,
  /mcafee/i,
  /siteadvisor/i,
  /bitdefender/i,
  /avast/i,
  /avg/i,
  /eset/i,
  /trendmicro/i,
  /sophos/i,
  /fortinet/i,
  /fortiguard/i,
  /paloalto/i,
  /wildfire/i,
  /sucuri/i,
  /urlscan/i,
  /hybrid.analysis/i,
  /any\.run/i,
  /joesandbox/i,
  /cuckoo/i,
  /phishlabs/i,
  /proofpoint/i,
  /barracuda/i,
  /mimecast/i,
  /talos/i,
  /spamhaus/i,
  /apwg/i,
  /abuse\.ch/i,
  /urlhaus/i,
  /malwarebytes/i,
  /webroot/i,
  /comodo/i,
  /zscaler/i,
  /forcepoint/i,
  /trustwave/i,
  /imperva/i,
  /smartscreen/i,
  /microsoft.*url/i,
  /apple.*bot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  // Headless / automation
  /headlesschrome/i,
  /phantomjs/i,
  /slimerjs/i,
  /htmlunit/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\/\d/i,
  /curl\//i,
  /wget\//i,
  /libwww-perl/i,
  /lwp-trivial/i,
  /scrapy/i,
  /mechanize/i,
  /httpclient/i,
  /okhttp/i,
  /axios\//i,
  /node-fetch/i,
  /got\//i,
  /superagent/i,
  /postman/i,
  /insomnia/i,
  /pycurl/i,
  /aiohttp/i,
  /httpx/i,
];

// ─── Headless browser fingerprint detection ──────────────────────────────────
// These headers are typically absent in real browsers but present in automation
const AUTOMATION_HEADERS = [
  "x-forwarded-for-original",
  "x-real-ip-original",
  "x-selenium",
  "x-webdriver",
  "x-puppeteer",
  "x-playwright",
];

// ─── Paths that should NEVER be blocked ──────────────────────────────────────
const BYPASS_PATHS = [
  "/api/",
  "/manus-storage/",
  "/__manus__/",
  "/robots.txt",
  "/favicon.ico",
];

function shouldBypass(path: string): boolean {
  return BYPASS_PATHS.some((p) => path.startsWith(p));
}

function isBlockedUserAgent(ua: string): boolean {
  if (!ua) return true; // No user-agent = block
  return BLOCKED_UA_PATTERNS.some((pattern) => pattern.test(ua));
}

function hasAutomationHeaders(req: Request): boolean {
  return AUTOMATION_HEADERS.some((h) => req.headers[h] !== undefined);
}

function isHeadlessBrowser(ua: string): boolean {
  // Detect headless Chrome/Chromium specifically
  if (/headlesschrome/i.test(ua)) return true;
  // Chrome without typical Chrome identifiers
  if (/chrome/i.test(ua) && !/mozilla/i.test(ua)) return true;
  return false;
}

// ─── Country detection ───────────────────────────────────────────────────────
const ALLOWED_COUNTRIES = ["CO"]; // Colombia only

function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string;
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

function isAllowedCountry(ip: string): boolean {
  // Always allow localhost / private IPs (dev environment)
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.3") ||
    ip === "" ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.") ||
    ip.startsWith("::ffff:172.")
  ) {
    return true;
  }

  // Strip IPv6-mapped IPv4 prefix for geoip lookup
  let lookupIP = ip;
  if (ip.startsWith("::ffff:")) {
    lookupIP = ip.slice(7);
  }

  const geo = geoip.lookup(lookupIP);
  if (!geo) {
    // Unknown IP — ALLOW to avoid blocking legitimate users from mobile carriers
    // whose IPs may not be in the geoip database yet
    return true;
  }

  return ALLOWED_COUNTRIES.includes(geo.country);
}

/**
 * Main security middleware — blocks bots, crawlers, and automation tools
 */
export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip for API and internal paths
  if (shouldBypass(req.path)) {
    return next();
  }

  const ua = (req.headers["user-agent"] || "") as string;

  // 1. Block known bad user agents
  if (isBlockedUserAgent(ua)) {
    return res.status(403).send("Access denied");
  }

  // 2. Block automation headers
  if (hasAutomationHeaders(req)) {
    return res.status(403).send("Access denied");
  }

  // 3. Block headless browsers
  if (isHeadlessBrowser(ua)) {
    return res.status(403).send("Access denied");
  }

  // 4. Block empty accept headers (typical of bots)
  const accept = req.headers["accept"] || "";
  if (!accept && req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.status(403).send("Access denied");
  }

  // 5. Block non-Colombian IPs (only runs when security is enabled)
  const clientIP = getClientIP(req);
  if (!isAllowedCountry(clientIP)) {
    return res.status(403).send("Servicio no disponible en tu región");
  }

  next();
}

/**
 * Serve a robots.txt that disallows all crawlers
 */
/**
 * Advanced bot trap - honeypot endpoint that only bots would access
 */
export function botTrapHandler(req: Request, res: Response) {
  // Log the bot that fell into the trap
  const ip = getClientIP(req);
  const ua = (req.headers["user-agent"] || "") as string;
  console.log(`[Security] Bot trap triggered: IP=${ip}, UA=${ua.slice(0, 80)}`);
  // Return a realistic-looking but useless response with delay
  setTimeout(() => {
    res.status(200).json({
      status: "ok",
      data: Array.from({length: 50}, () => ({
        id: Math.random().toString(36).slice(2),
        value: Math.random().toString(36).repeat(3),
        timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      }))
    });
  }, 2000 + Math.random() * 3000);
}

/**
 * Advanced request fingerprinting - detect suspicious request patterns
 */
export function requestFingerprint(req: Request): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ua = (req.headers["user-agent"] || "") as string;
  const accept = (req.headers["accept"] || "") as string;
  const acceptLang = (req.headers["accept-language"] || "") as string;
  const acceptEnc = (req.headers["accept-encoding"] || "") as string;

  // Missing standard headers
  if (!accept) { score += 2; reasons.push("no-accept"); }
  if (!acceptLang) { score += 2; reasons.push("no-accept-language"); }
  if (!acceptEnc) { score += 1; reasons.push("no-accept-encoding"); }

  // Suspicious UA patterns
  if (ua.length < 20) { score += 3; reasons.push("short-ua"); }
  if (ua.length > 500) { score += 2; reasons.push("long-ua"); }
  if (!ua.includes("Mozilla")) { score += 2; reasons.push("no-mozilla"); }

  // Check for TLS fingerprint inconsistencies
  const secFetchSite = req.headers["sec-fetch-site"];
  const secFetchMode = req.headers["sec-fetch-mode"];
  if (!secFetchSite && !secFetchMode && ua.includes("Chrome")) {
    score += 3; reasons.push("missing-sec-fetch");
  }

  // Check connection header patterns
  const connection = req.headers["connection"];
  if (connection === "close" && ua.includes("Chrome")) {
    score += 2; reasons.push("connection-close-chrome");
  }

  // Check for HTTP/2 pseudo-headers inconsistency
  if (req.httpVersion === "1.0") {
    score += 3; reasons.push("http-1.0");
  }

  return { score, reasons };
}

export function robotsTxtHandler(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/plain");
  res.send(
    `User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /\n\nUser-agent: AdsBot-Google\nDisallow: /\n\nUser-agent: Googlebot-Image\nDisallow: /\n\nUser-agent: Googlebot-Video\nDisallow: /\n\nUser-agent: Googlebot-News\nDisallow: /\n`
  );
}
