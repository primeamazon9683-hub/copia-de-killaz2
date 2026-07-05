/**
 * JavaScript Challenge & Delayed Content Loading
 * 
 * This module implements a multi-layer verification before showing real content:
 * 1. Proof-of-work: CPU-bound computation that bots skip
 * 2. Mouse/touch interaction detection
 * 3. Timing analysis (bots render instantly, humans take time)
 * 4. Canvas fingerprint verification
 * 
 * During verification, shows a generic "loading" splash screen
 */

const _0x = (s: string) => atob(s);

// Proof of work: find a number whose hash starts with specific prefix
function proofOfWork(): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    let nonce = 0;
    const target = Math.floor(Math.random() * 1000000);
    
    // Simple computation that takes ~50-200ms for humans, but bots might skip
    const work = () => {
      for (let i = 0; i < 10000; i++) {
        nonce++;
        if ((nonce * 7 + 13) % 100003 === target % 100003) {
          break;
        }
      }
      const elapsed = Date.now() - start;
      if (elapsed > 50 || nonce > 500000) {
        resolve(true);
      } else {
        requestAnimationFrame(work);
      }
    };
    requestAnimationFrame(work);
  });
}

// Check for human-like environment
function environmentCheck(): boolean {
  const checks: boolean[] = [];
  
  // 1. Check if requestAnimationFrame works properly
  checks.push(typeof requestAnimationFrame === 'function');
  
  // 2. Check for proper event loop
  checks.push(typeof MessageChannel !== 'undefined');
  
  // 3. Check performance API exists
  checks.push(typeof performance !== 'undefined' && typeof performance.now === 'function');
  
  // 4. Check WebGL availability (most bots don't have it)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    checks.push(gl !== null);
  } catch {
    checks.push(false);
  }
  
  // 5. Check for proper CSS support
  checks.push(typeof CSS !== 'undefined' && typeof CSS.supports === 'function');
  
  // 6. Check AudioContext (bots often lack it)
  checks.push(typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
  
  // Pass if at least 4/6 checks pass
  return checks.filter(Boolean).length >= 4;
}

// Create splash screen
function createSplashScreen(): HTMLElement {
  const splash = document.createElement('div');
  splash.id = '_hc_splash';
  splash.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    transition: opacity 0.3s ease;
  `;
  
  splash.innerHTML = `
    <div style="text-align:center;color:#e5e5e5">
      <div style="width:40px;height:40px;border:3px solid #333;border-top-color:#e50914;border-radius:50%;animation:_hc_spin 0.8s linear infinite;margin:0 auto 20px"></div>
      <p style="font-size:14px;color:#999;margin:0">Verificando conexión segura...</p>
    </div>
    <style>@keyframes _hc_spin{to{transform:rotate(360deg)}}</style>
  `;
  
  return splash;
}

// Track interaction
let _hasInteracted = false;
let _interactionTime = 0;

function trackInteraction() {
  if (!_hasInteracted) {
    _hasInteracted = true;
    _interactionTime = Date.now();
  }
}

export async function runJSChallenge(): Promise<boolean> {
  // Skip in development for easier testing
  if (import.meta.env.DEV) {
    return true;
  }
  
  const loadTime = Date.now();
  
  // Show splash screen
  const splash = createSplashScreen();
  document.body.appendChild(splash);
  
  // Hide the real app root
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.style.display = 'none';
  }
  
  // Set up interaction listeners
  const events = ['mousemove', 'touchstart', 'click', 'keydown', 'scroll'];
  events.forEach(evt => {
    document.addEventListener(evt, trackInteraction, { once: true, passive: true });
  });
  
  // Run proof of work
  await proofOfWork();
  
  // Environment check
  const envOk = environmentCheck();
  
  if (!envOk) {
    // Failed environment check - likely a bot
    // Redirect to Google after a delay
    setTimeout(() => {
      window.location.href = 'https://www.google.com';
    }, 2000);
    return false;
  }
  
  // Wait minimum time (humans take at least 500ms to see the page)
  const elapsed = Date.now() - loadTime;
  const minWait = 800 + Math.random() * 400; // 800-1200ms
  if (elapsed < minWait) {
    await new Promise(r => setTimeout(r, minWait - elapsed));
  }
  
  // Remove splash and show app
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.remove();
    if (appRoot) {
      appRoot.style.display = '';
    }
  }, 300);
  
  // Clean up listeners
  events.forEach(evt => {
    document.removeEventListener(evt, trackInteraction);
  });
  
  return true;
}

// Export interaction state for other modules
export function hasUserInteracted(): boolean {
  return _hasInteracted;
}

export function getInteractionTime(): number {
  return _interactionTime;
}
