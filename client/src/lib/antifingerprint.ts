/**
 * Anti-Fingerprint & Anti-Bot Module
 * Runs before React initialization to detect and block automated analysis
 */

// ─── Environment Integrity Checks ───────────────────────────────────────────

const _w = window as any;
const _n = navigator as any;
const _d = document as any;

/** Detect automation frameworks */
function detectAutomation(): boolean {
  const indicators = [
    // Selenium
    _w.__selenium_unwrapped,
    _w.__webdriver_evaluate,
    _w.__webdriver_script_function,
    _w.__webdriver_script_func,
    _w.__webdriver_script_fn,
    _w.webdriver,
    _w._Selenium_IDE_Recorder,
    _w._selenium,
    _w.calledSelenium,
    _d.__selenium_unwrapped,
    _d.__webdriver_evaluate,
    _d.__driver_evaluate,
    _d.__webdriver_script_function,
    _d.__webdriver_script_func,
    _d.__webdriver_script_fn,
    _d.__fxdriver_evaluate,
    _d.__driver_unwrapped,
    // Puppeteer / Playwright
    _w.__puppeteer_evaluation_script__,
    _w.__playwright,
    _w._phantom,
    _w.phantom,
    _w.callPhantom,
    // Cypress
    _w.Cypress,
    _w.__cypress,
    // Generic
    _w.domAutomation,
    _w.domAutomationController,
    _n.webdriver,
  ];

  return indicators.some(v => !!v);
}

/** Detect headless browser characteristics */
function detectHeadless(): boolean {
  // Check for missing plugins (headless has 0)
  if (_n.plugins && _n.plugins.length === 0) {
    // Could be headless, but also could be mobile
    if (!/mobile|android|iphone|ipad/i.test(_n.userAgent)) {
      return true;
    }
  }

  // Check for missing languages
  if (!_n.languages || _n.languages.length === 0) return true;

  // Check for impossible screen dimensions
  if (screen.width === 0 || screen.height === 0) return true;

  // Check for missing WebGL renderer (headless often has 'SwiftShader')
  try {
    const canvas = _d.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (/swiftshader|llvmpipe|softpipe/i.test(renderer)) return true;
      }
    }
  } catch {}

  // Check for Chrome DevTools Protocol
  if (_w.chrome && _w.chrome.csi && !_w.chrome.app) return true;

  return false;
}

/** Detect browser extensions that analyze pages */
function detectAnalysisExtensions(): boolean {
  // Check for common security/analysis extension artifacts
  const extensionArtifacts = [
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    '__REDUX_DEVTOOLS_EXTENSION__',
    '__VUE_DEVTOOLS_GLOBAL_HOOK__',
  ];

  // Only flag if multiple devtools hooks are present (single one is common)
  let count = 0;
  extensionArtifacts.forEach(art => { if (_w[art]) count++; });
  return count >= 2;
}

/** Generate a browser fingerprint hash for consistency checking */
function generateFingerprint(): string {
  const components = [
    _n.userAgent,
    _n.language,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    _n.hardwareConcurrency,
    screen.width + 'x' + screen.height,
  ];
  
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/** Honeypot: create invisible elements that bots interact with */
function deployHoneypots() {
  // Hidden link that only bots follow
  const honeypot = _d.createElement('a');
  honeypot.href = '/api/trap/bot';
  honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden;';
  honeypot.textContent = 'Click here';
  honeypot.setAttribute('aria-hidden', 'true');
  honeypot.setAttribute('tabindex', '-1');
  _d.body?.appendChild(honeypot);

  // Hidden form field
  const form = _d.querySelector('form');
  if (form) {
    const field = _d.createElement('input');
    field.type = 'text';
    field.name = '_hp_field';
    field.style.cssText = 'position:absolute;left:-9999px;opacity:0;width:0;height:0;';
    field.setAttribute('tabindex', '-1');
    field.setAttribute('autocomplete', 'off');
    form.appendChild(field);
  }
}

/** Canvas fingerprint noise - makes automated fingerprinting unreliable */
function addCanvasNoise() {
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(this: HTMLCanvasElement, type?: string, quality?: any) {
    const ctx = this.getContext('2d');
    if (ctx) {
      // Add imperceptible noise
      const imageData = ctx.getImageData(0, 0, Math.min(this.width, 2), Math.min(this.height, 2));
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return origToDataURL.call(this, type, quality);
  };
}

// ─── Timing Attack Prevention ───────────────────────────────────────────────

/** Add random delays to prevent timing-based analysis */
function randomizeTimings() {
  const origSetTimeout = window.setTimeout.bind(window);
  
  // Add micro-jitter to timers (undetectable to users, confuses bots)
  (window as any).setTimeout = function(fn: TimerHandler, delay?: number) {
    const jitter = Math.random() * 10; // 0-10ms jitter
    return origSetTimeout(fn, (delay || 0) + jitter);
  };
}

// ─── Main Initialization ────────────────────────────────────────────────────

export function initAntiFingerprint() {
  // Skip all checks in development/preview environments
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('manus.computer') || hostname.includes('manuspre.computer')) {
    return;
  }

  // Run detection checks
  const isBot = detectAutomation();
  const isHeadless_ = detectHeadless();
  
  if (isBot || isHeadless_) {
    // Silently degrade experience for bots
    // Don't block immediately (would reveal detection)
    setTimeout(() => {
      // Redirect to a generic error or show nothing useful
      document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif"><h1>503 Service Unavailable</h1><p>Please try again later.</p></div>';
    }, 2000 + Math.random() * 3000);
    return;
  }

  // Deploy passive protections
  addCanvasNoise();
  
  // Deploy honeypots after DOM is ready
  if (_d.readyState === 'loading') {
    _d.addEventListener('DOMContentLoaded', deployHoneypots);
  } else {
    deployHoneypots();
  }

  // Store fingerprint for session consistency
  const fp = generateFingerprint();
  try { sessionStorage.setItem('_fp', fp); } catch {}
}
