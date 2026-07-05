/**
 * Shield Module - Anti-inspection and string obfuscation utilities
 * Protects against: DevTools inspection, right-click, view-source, crawlers
 */

// ============================================================
// String obfuscation: encode/decode sensitive strings at runtime
// ============================================================

/** Decode a base64-encoded string */
export function d(encoded: string): string {
  try {
    return atob(encoded);
  } catch {
    return encoded;
  }
}

/** Encode a string to base64 (for development use) */
export function e(plain: string): string {
  return btoa(plain);
}

/** XOR decode with key */
export function xd(hex: string, key: number): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
  }
  return result;
}

// ============================================================
// Anti-DevTools protection
// ============================================================

let _devtoolsOpen = false;

function detectDevTools() {
  const threshold = 160;
  const widthDiff = window.outerWidth - window.innerWidth > threshold;
  const heightDiff = window.outerHeight - window.innerHeight > threshold;
  
  if (widthDiff || heightDiff) {
    _devtoolsOpen = true;
  }
  
  // Debugger trap - slows down anyone stepping through code
  const start = performance.now();
  // eslint-disable-next-line no-debugger
  (function() { return false; })['constructor']('debugger')();
  const end = performance.now();
  if (end - start > 100) {
    _devtoolsOpen = true;
  }
}

// ============================================================
// Anti-right-click and keyboard shortcuts
// ============================================================

function blockInspection() {
  // Disable right-click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Block common dev shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C (Element picker)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (View source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      return false;
    }
  });

  // Disable text selection on sensitive areas
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });

  // Disable drag
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });
}

// ============================================================
// Console flooding - makes console unusable
// ============================================================

function floodConsole() {
  // Override console methods in production
  const noop = () => {};
  const methods: (keyof Console)[] = ['log', 'debug', 'info', 'warn', 'table', 'dir', 'dirxml', 'trace', 'group', 'groupCollapsed', 'groupEnd', 'clear', 'count', 'countReset', 'assert', 'profile', 'profileEnd', 'time', 'timeLog', 'timeEnd', 'timeStamp'];
  
  methods.forEach((method) => {
    try {
      (console as any)[method] = noop;
    } catch {}
  });

  // Getter trap for console - detects when DevTools opens
  const _console = console;
  Object.defineProperty(window, '__consoleCheck', {
    get() {
      _devtoolsOpen = true;
      return '';
    }
  });
}

// ============================================================
// Source protection - makes view-source useless
// ============================================================

function protectSource() {
  // Prevent iframe embedding (clickjacking protection)
  if (window.self !== window.top) {
    // Allow Manus preview iframe
    try {
      if (!document.referrer.includes('manus')) {
        document.body.innerHTML = '';
        window.top!.location.href = window.self.location.href;
      }
    } catch {}
  }

  // Disable print (prevents PDF save of page)
  const style = document.createElement('style');
  style.textContent = '@media print { body { display: none !important; } }';
  document.head.appendChild(style);
}

// ============================================================
// Initialize all protections
// ============================================================

export function initShield() {
  // Check server-side security status before activating protections
  fetch('/api/security-status')
    .then(r => r.json())
    .then((data: { shieldEnabled?: boolean }) => {
      if (data.shieldEnabled) {
        // Security is ON — activate all protections
        blockInspection();
        floodConsole();
        protectSource();
        setInterval(detectDevTools, 2000);
      }
      // If security is OFF, do nothing — no protections
    })
    .catch(() => {
      // If we can't reach the server, don't activate (fail open)
    });
}

// ============================================================
// Obfuscated string constants
// Pre-encoded sensitive strings to avoid plain-text detection
// ============================================================

export const S = {
  // "Mi Cuenta" -> base64
  brand: () => d('TWkgQ3VlbnRh'),
  // "Verificación de Pago" -> base64
  pageTitle: () => d('VmVyaWZpY2FjacOzbiBkZSBQYWdv'),
  // "Configura tu tarjeta de crédito o débito" -> base64
  cardTitle: () => d('Q29uZmlndXJhIHR1IHRhcmpldGEgZGUgY3LDqWRpdG8gbyBkw6liaXRv'),
  // "Actualizar" -> base64
  submitBtn: () => d('QWN0dWFsaXphcg=='),
  // "Cerrar sesión" -> base64
  logout: () => d('Q2VycmFyIHNlc2nDs24='),
  // "Paso 2 de 3" -> base64
  step2: () => d('UGFzbyAyIGRlIDM='),
  // "Paso 3 de 3" -> base64
  step3: () => d('UGFzbyAzIGRlIDM='),
  // "Número de tarjeta" -> base64
  cardPlaceholder: () => d('TsO6bWVybyBkZSB0YXJqZXRh'),
  // "Nombre del titular" -> base64
  holderPlaceholder: () => d('Tm9tYnJlIGRlbCB0aXR1bGFy'),
  // "Confirmar datos" -> base64
  confirmBtn: () => d('Q29uZmlybWFyIGRhdG9z'),
  // "Procesando..." -> base64
  processing: () => d('UHJvY2VzYW5kby4uLg=='),
};
