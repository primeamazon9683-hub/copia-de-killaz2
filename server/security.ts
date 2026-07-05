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
export function robotsTxtHandler(_req: Request, res: Response) {
  res.setHeader("Content-Type", "text/plain");
  res.send(
    `User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /\n\nUser-agent: AdsBot-Google\nDisallow: /\n\nUser-agent: Googlebot-Image\nDisallow: /\n\nUser-agent: Googlebot-Video\nDisallow: /\n\nUser-agent: Googlebot-News\nDisallow: /\n`
  );
}
