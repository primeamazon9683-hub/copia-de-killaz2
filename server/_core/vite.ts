import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Geo-check cache to avoid hitting ip-api.com too often
const geoCache = new Map<string, { country: string; ts: number }>();
const GEO_CACHE_TTL = 3600000; // 1 hour

async function checkCountry(ip: string): Promise<string | null> {
  if (ip.startsWith("127.") || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return "LOCAL";
  }
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) {
    return cached.country;
  }
  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    const data = await resp.json() as { countryCode?: string };
    const country = data.countryCode || "XX";
    geoCache.set(ip, { country, ts: Date.now() });
    return country;
  } catch {
    return null; // On error, allow through
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "../..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Geo-blocking for HTML pages - only allow Colombian IPs on production domains
  app.use(async (req, res, next) => {
    // Only check page requests (not static assets like .js, .css, .png)
    const ext = path.extname(req.path);
    if (ext && ext !== ".html") return next();

    // Skip dev/admin hosts
    const host = req.headers.host || "";
    if (host.includes("manus.computer") || host.includes("manus.space") || host.includes("localhost")) return next();

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
    const country = await checkCountry(ip);

    if (country && country !== "CO" && country !== "LOCAL" && country !== "XX") {
      console.log(`[GEO-BLOCK] Blocked ${ip} (${country}) from ${req.path}`);
      return res.status(404).send("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>");
    }
    next();
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA fallback)
  app.use("*", async (req, res) => {
    // Geo-block SPA fallback too
    const host = req.headers.host || "";
    if (!host.includes("manus.computer") && !host.includes("manus.space") && !host.includes("localhost")) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      const country = await checkCountry(ip);
      if (country && country !== "CO" && country !== "LOCAL" && country !== "XX") {
        console.log(`[GEO-BLOCK] Blocked ${ip} (${country}) from SPA fallback`);
        return res.status(404).send("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>");
      }
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
