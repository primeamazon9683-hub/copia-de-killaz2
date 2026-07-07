import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Geo-blocking function for use in static serving
const geoCacheStatic = new Map<string, { country: string; expires: number }>();
async function checkGeoBlock(req: Request, res: Response): Promise<boolean> {
  const host = req.headers.host || "";
  if (host.includes("manus.computer") || host.includes("localhost") || host.includes("manus.space")) {
    return false;
  }
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  if (ip.startsWith("127.") || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return false;
  }
  const cached = geoCacheStatic.get(ip);
  let country = "XX";
  if (cached && cached.expires > Date.now()) {
    country = cached.country;
  } else {
    try {
      const resp = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
      const data = await resp.json() as { countryCode?: string };
      country = (data.countryCode || "XX").toUpperCase();
      geoCacheStatic.set(ip, { country, expires: Date.now() + 3600000 });
    } catch {
      country = "XX";
    }
  }
  if (country === "CO" || country === "LOCAL" || country === "XX") {
    return false;
  }
  res.status(404).send("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>");
  return true;
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
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  // Geo-check before serving static HTML files
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    // Allow static assets (js, css, images, fonts) without geo-check
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(req.path)) {
      return next();
    }
    // Allow API paths (handled by their own middleware)
    if (req.path.startsWith("/api/") || req.path.startsWith("/manus-storage/") || req.path.startsWith("/_manus")) {
      return next();
    }
    const blocked = await checkGeoBlock(req, res);
    if (!blocked) {
      next();
    }
  });
  app.use(express.static(distPath));
  // fall through to index.html if the file doesn't exist
  app.use("*", (_req: Request, res: Response) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
