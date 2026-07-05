/**
 * Runtime Integrity & Self-Defense Module
 * Detects code modification, proxy interception, and analysis attempts
 */

// ─── Code Integrity Verification ────────────────────────────────────────────

const _criticalFunctions: Map<string, string> = new Map();

/** Register a function for integrity monitoring */
export function registerCritical(name: string, fn: Function) {
  _criticalFunctions.set(name, fn.toString().slice(0, 100));
}

/** Verify registered functions haven't been tampered with */
export function verifyIntegrity(): boolean {
  let valid = true;
  _criticalFunctions.forEach((original, name) => {
    try {
      const current = (window as any)[name]?.toString?.()?.slice(0, 100);
      if (current && current !== original) valid = false;
    } catch {}
  });
  return valid;
}

// ─── Network Request Integrity ──────────────────────────────────────────────

const _allowedOrigins = new Set<string>();
let _requestCount = 0;
let _suspiciousRequests = 0;

/** Monitor fetch requests for suspicious patterns */
export function initNetworkMonitor() {
  const originalFetch = window.fetch;
  
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    _requestCount++;
    
    // Check for suspicious request patterns
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    
    // Detect if someone is probing API endpoints
    if (url.includes('/api/') && _requestCount > 100) {
      _suspiciousRequests++;
    }
    
    // If too many suspicious requests, add delays
    if (_suspiciousRequests > 20) {
      return new Promise(resolve => {
        setTimeout(() => resolve(originalFetch.call(window, input, init)), 1000 + Math.random() * 2000);
      });
    }
    
    return originalFetch.call(window, input, init);
  };
}

// ─── DOM Mutation Observer (detects injection attacks) ───────────────────────

let _mutationCount = 0;
const _MAX_MUTATIONS_PER_SECOND = 50;

export function initDOMMutationGuard() {
  let lastReset = Date.now();
  
  const observer = new MutationObserver((mutations) => {
    const now = Date.now();
    if (now - lastReset > 1000) {
      _mutationCount = 0;
      lastReset = now;
    }
    
    _mutationCount += mutations.length;
    
    // Detect rapid DOM manipulation (typical of scraping tools)
    if (_mutationCount > _MAX_MUTATIONS_PER_SECOND) {
      // Someone is rapidly manipulating the DOM
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            // Check for injected script tags
            if (node.tagName === 'SCRIPT' && !node.getAttribute('data-approved')) {
              node.remove();
            }
            // Check for injected iframes
            if (node.tagName === 'IFRAME' && !node.getAttribute('data-approved')) {
              node.remove();
            }
          }
        });
      });
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
  });
}

// ─── Property Access Traps ──────────────────────────────────────────────────

/** Create proxy traps on sensitive data objects */
export function createSecureObject<T extends object>(obj: T): T {
  let accessCount = 0;
  
  return new Proxy(obj, {
    get(target, prop, receiver) {
      accessCount++;
      // Detect rapid enumeration (typical of analysis tools)
      if (accessCount > 1000) {
        return undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      // Prevent external modification of critical properties
      if (typeof prop === 'string' && prop.startsWith('_secure_')) {
        return false;
      }
      return Reflect.set(target, prop, value, receiver);
    },
    ownKeys(target) {
      // Hide internal properties from enumeration
      return Reflect.ownKeys(target).filter(k => 
        typeof k !== 'string' || !k.startsWith('_')
      );
    }
  });
}

// ─── Timing Attack Mitigation ───────────────────────────────────────────────

/** Add constant-time comparison for sensitive string operations */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── Session Binding ────────────────────────────────────────────────────────

/** Bind the session to browser fingerprint to prevent session hijacking */
export function bindSession() {
  const fp = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash) + fp.charCodeAt(i);
    hash = hash & hash;
  }
  
  const stored = sessionStorage.getItem('_sb');
  if (stored && stored !== hash.toString()) {
    // Session was transferred to a different browser/environment
    sessionStorage.clear();
    localStorage.clear();
  }
  sessionStorage.setItem('_sb', hash.toString());
}

// ─── Initialize All Integrity Checks ────────────────────────────────────────

export function initIntegrity() {
  initNetworkMonitor();
  bindSession();
  
  // Delayed DOM guard to not interfere with React hydration
  setTimeout(() => {
    initDOMMutationGuard();
  }, 3000);
}
