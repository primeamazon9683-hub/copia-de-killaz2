/**
 * Promo Landing Page - 6 meses gratis
 * Shows Netflix splash screen first, then transitions to the promo content
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { Play, Clock, Users, Shield, Tv, Zap } from "lucide-react";

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
  const [claimed] = useState(() => Math.floor(Math.random() * (92 - 83)) + 83);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
  }, []);

  // Splash screen timing
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
    }, 2200);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
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
        {/* Netflix logo with animation */}
        <div className="flex flex-col items-center">
          <div className="animate-[netflixPulse_1.5s_ease-in-out_infinite]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1024 276.742"
              className="h-[60px] sm:h-[80px] w-auto"
            >
              <path
                d="M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676L44.051 119.724v151.073C28.647 272.418 14.594 274.58 0 276.742V0h41.08l56.212 157.021V0h43.511v258.904zm85.131-157.558c16.757 0 42.431-.811 57.835-.811v43.24c-19.189 0-41.619 0-57.835.811v64.322c25.405-1.621 50.809-3.785 76.482-4.596v41.617l-119.724 9.461V0h119.724v43.241h-76.482v58.105zm237.284-58.104h-44.862V242.15c-14.594 0-29.188 0-43.239.539V43.242h-44.862V0H463.22l-.002 43.242zm70.266 55.132h59.187v43.24h-59.187v98.104h-42.433V0h120.808v43.241h-78.375v55.133zm148.641 103.507c24.594.539 49.456 2.434 73.51 3.783v42.701c-38.646-2.434-77.293-4.863-116.75-5.676V0h43.24v201.881zm109.994 49.457c13.783.812 28.377 1.623 42.43 3.242V0h-42.43v251.338zM1024 0l-54.863 131.615L1024 276.742c-16.217-2.162-32.432-5.135-48.648-7.838l-31.078-79.994-31.617 73.51c-15.678-2.705-30.812-3.516-46.484-5.678l55.672-126.75L871.576 0h46.482l28.377 72.699L976.705 0H1024z"
                fill="#E50914"
              />
            </svg>
          </div>
          {/* Loading bar */}
          <div className="mt-8 w-[120px] h-[3px] bg-[#333] rounded-full overflow-hidden">
            <div className="h-full bg-[#E50914] rounded-full animate-[loadingBar_2s_ease-in-out_forwards]" />
          </div>
        </div>

        <style>{`
          @keyframes netflixPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(229,9,20,0)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 30px rgba(229,9,20,0.6)); }
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
      <div className="min-h-[100dvh] w-full bg-black flex flex-col relative overflow-hidden">
        {/* Fire/glow background effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-[#E50914]/20 via-[#E50914]/5 to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[40%] bg-[radial-gradient(ellipse_at_bottom,_rgba(229,9,20,0.3)_0%,_transparent_70%)]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[25%] bg-[radial-gradient(ellipse_at_bottom,_rgba(255,100,0,0.15)_0%,_transparent_60%)]" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full px-4 sm:px-8 pt-4 pb-3 flex items-center justify-between">
          <BrandLogo height={22} />
          <div className="flex items-center gap-2 bg-[#1a1a1a]/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-[#333]">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <Users className="w-3.5 h-3.5 text-[#aaa]" />
            <span className="text-white text-[12px] font-medium">{viewers.toLocaleString()} viendo ahora</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-6">
          <div className="w-full max-w-[420px] flex flex-col items-center text-center animate-[fadeIn_0.8s_ease-out_both]">
            
            {/* Urgency Badge */}
            <div className="bg-[#E50914] text-white text-[11px] sm:text-[12px] font-bold px-4 py-1.5 rounded-sm uppercase tracking-[0.15em] mb-6 flex items-center gap-2 animate-[fadeSlideDown_0.5s_ease-out_0.1s_both]">
              <Zap className="w-3.5 h-3.5" /> SOLO HOY — OFERTA EXCLUSIVA
            </div>

            {/* Big Number */}
            <div className="mb-1 animate-[scaleIn_0.6s_ease-out_0.2s_both]">
              <span className="text-[120px] sm:text-[140px] font-black text-white leading-none block" style={{ textShadow: '0 0 40px rgba(229,9,20,0.4), 0 0 80px rgba(229,9,20,0.2)' }}>
                6
              </span>
            </div>

            {/* MESES */}
            <p className="text-[#ccc] text-[18px] sm:text-[20px] tracking-[0.4em] uppercase font-light mb-1 animate-[fadeIn_0.5s_ease-out_0.4s_both]">
              MESES
            </p>

            {/* GRATIS */}
            <p className="text-[#E50914] text-[28px] sm:text-[32px] tracking-[0.3em] uppercase font-bold mb-4 animate-[fadeIn_0.5s_ease-out_0.5s_both]" style={{ textShadow: '0 0 20px rgba(229,9,20,0.5)' }}>
              GRATIS
            </p>

            {/* Subtitle */}
            <p className="text-[#999] text-[14px] mb-1 animate-[fadeIn_0.5s_ease-out_0.6s_both]">
              Activa hoy y obtén acceso premium ilimitado.
            </p>
            <p className="text-white text-[14px] font-medium mb-6 animate-[fadeIn_0.5s_ease-out_0.7s_both]">
              Esta oferta no se repetirá.
            </p>

            {/* Features row */}
            <div className="flex items-center justify-center gap-4 mb-6 animate-[fadeIn_0.5s_ease-out_0.8s_both]">
              <div className="flex items-center gap-1.5 text-[#aaa] text-[11px]">
                <Tv className="w-3.5 h-3.5 text-[#E50914]" />
                <span>4K Ultra HD</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#aaa] text-[11px]">
                <Shield className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Sin compromiso</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#aaa] text-[11px]">
                <Users className="w-3.5 h-3.5 text-[#E50914]" />
                <span>5 perfiles</span>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="mb-6 animate-[fadeIn_0.5s_ease-out_0.9s_both]">
              <div className="flex items-center gap-2 justify-center mb-3">
                <Clock className="w-4 h-4 text-[#999]" />
                <span className="text-[#999] text-[11px] uppercase tracking-[0.2em] font-medium">LA OFERTA EXPIRA EN</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-lg w-[60px] h-[60px] flex items-center justify-center">
                    <span className="text-white text-[24px] font-bold tabular-nums">{String(hours).padStart(2, '0')}</span>
                  </div>
                  <span className="text-[#666] text-[10px] uppercase mt-1 tracking-wider">HRS</span>
                </div>
                <span className="text-[#666] text-[20px] font-bold -mt-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-lg w-[60px] h-[60px] flex items-center justify-center">
                    <span className="text-white text-[24px] font-bold tabular-nums">{String(minutes).padStart(2, '0')}</span>
                  </div>
                  <span className="text-[#666] text-[10px] uppercase mt-1 tracking-wider">MIN</span>
                </div>
                <span className="text-[#666] text-[20px] font-bold -mt-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-[#1a1a1a] border border-[#333] rounded-lg w-[60px] h-[60px] flex items-center justify-center">
                    <span className="text-white text-[24px] font-bold tabular-nums">{String(seconds).padStart(2, '0')}</span>
                  </div>
                  <span className="text-[#666] text-[10px] uppercase mt-1 tracking-wider">SEG</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setLocation("/promo-select")}
              className="w-full max-w-[320px] h-[54px] bg-[#E50914] text-white text-[16px] font-bold rounded-md hover:bg-[#F6121D] active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(229,9,20,0.5)] mb-3 animate-[fadeSlideUp_0.5s_ease-out_1s_both]"
            >
              <Play className="w-5 h-5 fill-white" /> ACTIVAR MI PROMOCIÓN
            </button>

            {/* No credit card text */}
            <p className="text-[#666] text-[12px] mb-5 animate-[fadeIn_0.5s_ease-out_1.1s_both]">Sin cargos hoy • Cancela cuando quieras</p>

            {/* Progress bar - cupos limitados */}
            <div className="w-full max-w-[320px] mb-4 animate-[fadeIn_0.5s_ease-out_1.2s_both]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#999]" />
                  <span className="text-[#999] text-[12px]">Cupos limitados</span>
                </div>
                <span className="text-[#E50914] text-[12px] font-bold">{claimed}% reclamado</span>
              </div>
              <div className="w-full h-[6px] bg-[#333] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#E50914] to-[#ff4500] rounded-full transition-all duration-1000"
                  style={{ width: `${claimed}%` }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
