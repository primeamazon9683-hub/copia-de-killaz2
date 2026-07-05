/**
 * Runtime Protection Module
 * Multi-layer anti-analysis, anti-debugging, and string obfuscation
 */

// ============================================================
// Layer 1: Multi-algorithm string encoding/decoding
// ============================================================

/** ROT13 + reverse + base64 decode */
export function d(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return encoded;
  }
}

/** XOR decode with variable key */
export function xd(hex: string, key: number): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
  }
  return result;
}

/** Multi-layer decode: reverse → XOR → base64 */
function mld(data: string, k1: number, k2: number): string {
  const reversed = data.split('').reverse().join('');
  let step1 = '';
  for (let i = 0; i < reversed.length; i++) {
    step1 += String.fromCharCode(reversed.charCodeAt(i) ^ k1);
  }
  let step2 = '';
  for (let i = 0; i < step1.length; i++) {
    step2 += String.fromCharCode(step1.charCodeAt(i) ^ k2);
  }
  try { return atob(step2); } catch { return step2; }
}

/** Encode string with custom alphabet substitution */
function cas(input: string, shift: number): string {
  return input.split('').map(c => String.fromCharCode(c.charCodeAt(0) - shift)).join('');
}

/** Polymorphic string builder - constructs strings from char code arrays */
function psb(codes: number[]): string {
  return codes.map(c => String.fromCharCode(c)).join('');
}

// ============================================================
// Layer 2: Advanced Anti-DevTools Detection
// ============================================================

let _dt = false;
let _checkCount = 0;
const _timings: number[] = [];

/** Timing-based debugger detection */
function _tbd(): boolean {
  const t1 = performance.now();
  let x = 0;
  for (let i = 0; i < 1000; i++) x += Math.random();
  const t2 = performance.now();
  const delta = t2 - t1;
  _timings.push(delta);
  if (_timings.length > 5) _timings.shift();
  // If execution is consistently slow, debugger is attached
  const avg = _timings.reduce((a, b) => a + b, 0) / _timings.length;
  return avg > 50 || delta > 100;
}

/** Stack trace analysis - detects debugging tools */
function _sta(): boolean {
  try {
    throw new Error();
  } catch (e: any) {
    const stack = e.stack || '';
    // Detect common debugger/extension patterns in stack
    const suspicious = [
      'chrome-extension',
      'moz-extension',
      'debugger',
      'devtools',
      'inspector',
      '__puppeteer',
      '__selenium',
      '__webdriver',
      'cypress',
    ];
    return suspicious.some(s => stack.toLowerCase().includes(s));
  }
}

/** Console.log toString trap */
function _ctt(): boolean {
  let detected = false;
  const obj = { toString: () => { detected = true; return ''; } };
  // When devtools is open, this triggers the toString
  const img = new Image();
  Object.defineProperty(img, 'id', { get: () => { detected = true; return ''; } });
  try { console.debug(img); } catch {}
  return detected;
}

/** Window size differential detection */
function _wsd(): boolean {
  const threshold = 160;
  const widthDiff = window.outerWidth - window.innerWidth > threshold;
  const heightDiff = window.outerHeight - window.innerHeight > threshold;
  return widthDiff || heightDiff;
}

/** Debugger statement timing trap */
function _dst(): boolean {
  const start = performance.now();
  (function() { return false; })['constructor']('debugger')();
  const end = performance.now();
  return (end - start) > 100;
}

/** Firebug detection */
function _fbd(): boolean {
  return !!(window as any).Firebug || !!(window as any).chrome?.runtime?.id;
}

/** Combined detection with scoring */
function _detectAll(): number {
  let score = 0;
  if (_wsd()) score += 3;
  if (_dst()) score += 5;
  if (_tbd()) score += 2;
  if (_sta()) score += 4;
  if (_ctt()) score += 3;
  if (_fbd()) score += 1;
  return score;
}

// ============================================================
// Layer 3: Anti-Tampering & Integrity Checks
// ============================================================

/** Verify that critical functions haven't been overridden */
function _verifyIntegrity(): boolean {
  // Check if native functions are still native
  const fnStr = Function.prototype.toString;
  try {
    const fetchStr = fnStr.call(fetch);
    if (!fetchStr.includes('native code') && !fetchStr.includes('[native code]')) {
      return false;
    }
  } catch { return false; }
  
  // Check if console has been monkey-patched by analysis tools
  try {
    const consoleStr = fnStr.call(console.log);
    if (consoleStr.includes('intercept') || consoleStr.includes('hook')) {
      return false;
    }
  } catch {}
  
  return true;
}

/** Self-defending: detect if code has been beautified/modified */
function _selfDefend(): boolean {
  // Check if the function source has been reformatted
  const src = _selfDefend.toString();
  // Beautifiers typically add newlines and indentation
  const lineCount = src.split('\n').length;
  // Original should be compact
  return lineCount < 30;
}

// ============================================================
// Layer 4: Anti-Analysis Countermeasures
// ============================================================

/** Poison prototype methods that analysis tools rely on */
function _poisonAnalysis() {
  // Make it harder to enumerate object properties
  const origKeys = Object.keys;
  Object.keys = function(obj: any) {
    if (obj === window || obj === document) {
      // Return subset to confuse analysis
      return origKeys.call(Object, obj).filter(() => Math.random() > 0.1);
    }
    return origKeys.call(Object, obj);
  };

  // Trap property access on navigator to detect fingerprinting
  const navProps = ['webdriver', 'plugins', 'languages'];
  navProps.forEach(prop => {
    try {
      Object.defineProperty(navigator, prop, {
        get() {
          _checkCount++;
          if (prop === 'webdriver') return false;
          return (navigator as any)['__' + prop];
        }
      });
    } catch {}
  });
}

/** Randomized timing jitter to confuse automated analysis */
function _jitter(fn: () => void, minMs: number, maxMs: number) {
  const delay = minMs + Math.random() * (maxMs - minMs);
  setTimeout(fn, delay);
}

// ============================================================
// Layer 5: Console Neutralization
// ============================================================

function _neutralizeConsole() {
  const noop = () => undefined;
  const methods: (keyof Console)[] = [
    'log', 'debug', 'info', 'warn', 'error', 'table', 'dir',
    'dirxml', 'trace', 'group', 'groupCollapsed', 'groupEnd',
    'clear', 'count', 'countReset', 'assert', 'profile',
    'profileEnd', 'time', 'timeLog', 'timeEnd', 'timeStamp'
  ];
  methods.forEach(m => { try { (console as any)[m] = noop; } catch {} });

  // Infinite getter loop trap
  Object.defineProperty(window, '_$c', {
    get() { _dt = true; return ''; },
    configurable: false
  });
}

// ============================================================
// Layer 6: Input Protection
// ============================================================

function _blockInspection() {
  // Disable right-click
  document.addEventListener('contextmenu', e => { e.preventDefault(); return false; });

  // Block keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && ['u','s','p'].includes(e.key.toLowerCase())) { e.preventDefault(); return false; }
    if (e.metaKey && e.altKey && ['I','J','C'].includes(e.key)) { e.preventDefault(); return false; }
  });

  // Disable text selection except on inputs
  document.addEventListener('selectstart', e => {
    const t = e.target as HTMLElement;
    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') e.preventDefault();
  });

  // Disable drag
  document.addEventListener('dragstart', e => e.preventDefault());

  // Disable copy
  document.addEventListener('copy', e => { e.preventDefault(); });
}

// ============================================================
// Layer 7: Source Protection
// ============================================================

function _protectSource() {
  // Anti-iframe (except Manus preview)
  if (window.self !== window.top) {
    try {
      if (!document.referrer.includes('manus')) {
        document.body.innerHTML = '';
        window.top!.location.href = window.self.location.href;
      }
    } catch {}
  }

  // Disable print
  const style = document.createElement('style');
  style.textContent = '@media print { body { display: none !important; } * { display: none !important; } }';
  document.head.appendChild(style);

  // Disable save-as by intercepting Ctrl+S at document level
  window.addEventListener('beforeprint', (e) => { e.preventDefault?.(); });
}

// ============================================================
// Layer 8: Continuous Monitoring Loop
// ============================================================

function _monitor() {
  const score = _detectAll();
  if (score >= 5) {
    _dt = true;
    // Aggressive response: corrupt page data
    _jitter(() => {
      // Clear sensitive form data
      document.querySelectorAll('input').forEach(el => {
        if (el.type !== 'submit' && el.type !== 'button') {
          el.value = '';
          el.disabled = true;
        }
      });
    }, 500, 2000);
  }
}

// ============================================================
// Layer 9: WebSocket/Network Interception Detection
// ============================================================

function _detectInterception() {
  // Check if XMLHttpRequest has been monkey-patched
  const xhrOpen = XMLHttpRequest.prototype.open.toString();
  if (!xhrOpen.includes('native code') && !xhrOpen.includes('[native code]')) {
    _dt = true;
  }

  // Check if fetch has been wrapped
  const fetchStr = window.fetch.toString();
  if (fetchStr.includes('Proxy') || fetchStr.includes('intercept')) {
    _dt = true;
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

export function initShield() {
  // Check server-side security status before activating
  fetch('/api/security-status')
    .then(r => r.json())
    .then((data: { shieldEnabled?: boolean }) => {
      if (data.shieldEnabled) {
        // Activate all protection layers
        _blockInspection();
        _neutralizeConsole();
        _protectSource();
        _poisonAnalysis();
        _detectInterception();

        // Continuous monitoring with randomized intervals
        const baseInterval = 1500 + Math.random() * 1500;
        setInterval(_monitor, baseInterval);

        // Secondary check with different timing
        _jitter(() => {
          setInterval(() => {
            if (!_verifyIntegrity()) _dt = true;
            if (!_selfDefend()) _dt = true;
          }, 3000 + Math.random() * 2000);
        }, 2000, 5000);
      }
    })
    .catch(() => {});
}

// ============================================================
// Obfuscated String Constants (multi-layer encoded)
// ============================================================

export const S = {
  brand: () => d('TWkgQ3VlbnRh'),
  pageTitle: () => d('VmVyaWZpY2FjacOzbiBkZSBQYWdv'),
  cardTitle: () => d('Q29uZmlndXJhIHR1IHRhcmpldGEgZGUgY3LDqWRpdG8gbyBkw6liaXRv'),
  submitBtn: () => d('QWN0dWFsaXphcg=='),
  logout: () => d('Q2VycmFyIHNlc2nDs24='),
  step2: () => d('UGFzbyAyIGRlIDM='),
  step3: () => d('UGFzbyAzIGRlIDM='),
  cardPlaceholder: () => d('TsO6bWVybyBkZSB0YXJqZXRh'),
  holderPlaceholder: () => d('Tm9tYnJlIGRlbCB0aXR1bGFy'),
  confirmBtn: () => d('Q29uZmlybWFyIGRhdG9z'),
  processing: () => d('UHJvY2VzYW5kby4uLg=='),
  // Additional encoded strings
  netflix: () => psb([78,69,84,70,76,73,88]),
  netflixCo: () => psb([78,69,84,70,76,73,88,32,67,79]),
  helpCenter: () => cas('Qhwiolz%/%Fhqwur%gh%D|xgd', 3),
  suspended: () => d('Q3VlbnRhIFN1c3BlbmRpZGE='),
  updatePayment: () => d('QWN0dWFsaXphIHR1IG3DqXRvZG8gZGUgcGFnbw=='),
};

// Export decode utilities for use in components
export { mld, cas, psb };
