/**
 * Promo Landing Page - 6 meses gratis
 * Design: Dark with fire/glow effect, countdown timer, urgency elements
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { Play, Clock, Users } from "lucide-react";

function getRandomViewers() {
  return Math.floor(Math.random() * (1800 - 1200)) + 1200;
}

function getInitialCountdown() {
  // Random countdown between 8-14 hours
  const totalSeconds = Math.floor(Math.random() * (14 * 3600 - 8 * 3600)) + 8 * 3600;
  return totalSeconds;
}

export default function PromoLanding() {
  const [, setLocation] = useLocation();
  const [viewers, setViewers] = useState(getRandomViewers);
  const [countdown, setCountdown] = useState(getInitialCountdown);
  const [claimed] = useState(() => Math.floor(Math.random() * (92 - 83)) + 83);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
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
          <div className="w-full max-w-[420px] flex flex-col items-center text-center">
            
            {/* Urgency Badge */}
            <div className="bg-[#E50914] text-white text-[11px] sm:text-[12px] font-bold px-4 py-1.5 rounded-sm uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
              <span className="text-[14px]">⚡</span> SOLO HOY — OFERTA EXCLUSIVA
            </div>

            {/* Big Number */}
            <div className="mb-1">
              <span className="text-[120px] sm:text-[140px] font-black text-white leading-none block" style={{ textShadow: '0 0 40px rgba(229,9,20,0.4), 0 0 80px rgba(229,9,20,0.2)' }}>
                6
              </span>
            </div>

            {/* MESES */}
            <p className="text-[#ccc] text-[18px] sm:text-[20px] tracking-[0.4em] uppercase font-light mb-1">
              MESES
            </p>

            {/* GRATIS */}
            <p className="text-[#E50914] text-[28px] sm:text-[32px] tracking-[0.3em] uppercase font-bold mb-4" style={{ textShadow: '0 0 20px rgba(229,9,20,0.5)' }}>
              GRATIS
            </p>

            {/* Subtitle */}
            <p className="text-[#999] text-[14px] mb-1">
              Activa hoy y obtén acceso premium ilimitado.
            </p>
            <p className="text-white text-[14px] font-medium mb-6">
              Esta oferta no se repetirá.
            </p>

            {/* Countdown Timer */}
            <div className="mb-6">
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
              className="w-full max-w-[320px] h-[52px] bg-[#E50914] text-white text-[15px] font-bold rounded-md hover:bg-[#F6121D] active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,9,20,0.4)] mb-2"
            >
              <Play className="w-4 h-4 fill-white" /> ACTIVAR AHORA
            </button>

            {/* No credit card text */}
            <p className="text-[#666] text-[12px] mb-6">Sin tarjeta de crédito requerida</p>

            {/* Progress bar - cupos limitados */}
            <div className="w-full max-w-[320px] mb-4">
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

            {/* Bottom features */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-[#666] flex-wrap">
              <span className="flex items-center gap-1"><span className="text-[#E50914]">•</span> Cancela cuando quieras</span>
              <span className="flex items-center gap-1"><span className="text-[#E50914]">•</span> Sin compromiso</span>
              <span className="flex items-center gap-1"><span className="text-[#E50914]">•</span> 4K Ultra HD</span>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
