import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import obfuscatorPlugin from "rollup-plugin-obfuscator";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

/**
 * Plugin que ofusca el HTML de producción para reducir similitud con clones conocidos:
 * - Inyecta comentarios de ruido genéricos
 * - Añade meta tags neutrales
 * - Agrega elementos invisibles de ruido en el body
 * - Cambia atributos del html/body para parecer un portal genérico
 */
function vitePluginHtmlObfuscate(): Plugin {
  const noiseComments = [
    '<!-- App Engine v3.2.1 - Build ' + Date.now().toString(36) + ' -->',
    '<!-- Service Worker Registration Module -->',
    '<!-- Progressive Web Application Shell -->',
    '<!-- Content Delivery Optimization Layer -->',
    '<!-- Dynamic Resource Loader v2.8 -->',
  ];
  return {
    name: 'html-obfuscate',
    transformIndexHtml(html: string) {
      // Only in production build
      if (process.env.NODE_ENV !== 'production') return html;
      // Inject multiple noise comments
      const comments = noiseComments.sort(() => Math.random() - 0.5).slice(0, 2).join('\n');
      html = html.replace('<!doctype html>', `<!doctype html>\n${comments}`);
      // Add misleading data attributes
      html = html.replace('<html lang="es">', `<html lang="es" data-app="pwa-shell" data-build="${Date.now().toString(36)}" data-env="production" data-cdn="cf">`);
      // Add noise meta tags
      const metaNoise = `<meta name="generator" content="Next.js">\n` +
        `<meta name="application-name" content="ServicePortal">\n` +
        `<meta name="theme-color" content="#000000">\n` +
        `<meta http-equiv="X-DNS-Prefetch-Control" content="on">\n`;
      html = html.replace('</head>', `${metaNoise}</head>`);
      // Add invisible noise elements with realistic structure
      const noiseEl = `<div aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" id="_sw_${Math.random().toString(36).slice(2,8)}" data-manifest="/manifest.json"></div>\n` +
        `<noscript><div class="noscript-warning">JavaScript is required</div></noscript>\n` +
        `<div id="_analytics_${Math.random().toString(36).slice(2,6)}" style="display:none" data-gtm=""></div>\n`;
      html = html.replace('</body>', `${noiseEl}</body>`);
      return html;
    },
  };
}

/**
 * Plugin that adds decoy/noise code to production bundles
 * Injects realistic-looking but non-functional code patterns
 */
function vitePluginCodeNoise(): Plugin {
  return {
    name: 'code-noise',
    transform(code: string, id: string) {
      if (process.env.NODE_ENV !== 'production') return null;
      if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return null;
      if (id.includes('node_modules')) return null;
      
      // Add noise variable declarations at the top of each module
      const noiseVars = [
        `const _$h${Math.random().toString(36).slice(2,6)} = typeof window !== 'undefined' ? window.crypto?.getRandomValues(new Uint8Array(16)) : null;`,
        `const _$v${Math.random().toString(36).slice(2,6)} = Date.now() ^ 0x${Math.floor(Math.random()*0xFFFF).toString(16)};`,
        `const _$m${Math.random().toString(36).slice(2,6)} = (function(){try{return !!(new Function('return this')());}catch(e){return false;}})();`,
      ];
      
      // Only add to ~40% of files to avoid patterns
      if (Math.random() > 0.4) return null;
      
      const noise = noiseVars[Math.floor(Math.random() * noiseVars.length)];
      return { code: noise + '\n' + code, map: null };
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginHtmlObfuscate(), vitePluginCodeNoise()];

// Production-only obfuscation plugin (applied during build)
const buildPlugins = process.env.NODE_ENV === 'production' ? [
  obfuscatorPlugin({
    options: {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.9,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.5,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      selfDefending: true,
      splitStrings: true,
      splitStringsChunkLength: 2,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.9,
      stringArrayEncoding: ['base64', 'rc4'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 5,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 6,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 1,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
      numbersToExpressions: true,
      simplify: true,
      disableConsoleOutput: true,
      debugProtection: true,
      debugProtectionInterval: 2000,
      ignoreImports: true,
    },
  }),
] : [];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Maximum obfuscation with Terser
    minify: "terser",
    terserOptions: {
      compress: {
        // Aggressive dead code elimination
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug", "console.warn"],
        unsafe: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        sequences: true,
        booleans: true,
        conditionals: true,
        dead_code: true,
        evaluate: true,
        if_return: true,
        join_vars: true,
        loops: true,
        unused: true,
        toplevel: true,
        hoist_funs: true,
        hoist_vars: false,
        negate_iife: true,
        reduce_vars: true,
        collapse_vars: true,
        inline: 3,
      },
      mangle: {
        // Rename all variables, properties, and functions to short names
        toplevel: true,
        eval: true,
        properties: {
          // Mangle property names (breaks some code — use carefully)
          regex: /^_/, // Only mangle underscore-prefixed properties
        },
      },
      format: {
        // Remove all comments including license headers
        comments: false,
        // Compact output
        beautify: false,
        // Wrap in IIFE for extra isolation
        wrap_iife: true,
      },
    },
    rollupOptions: {
      plugins: buildPlugins,
      output: {
        // Randomize chunk names to prevent reverse engineering
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash].[ext]",
        // Compact output
        compact: true,
        // Minimize exports
        exports: "auto",
      },
    },
    // Disable source maps in production (never expose source)
    sourcemap: false,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
