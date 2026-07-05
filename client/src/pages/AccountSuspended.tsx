/**
 * Account Suspended Page - Portal Style (responsive)
 * Fondo completamente blanco, contenido centrado verticalmente
 */

import PageTransition from "@/components/PageTransition";
import BrandLogo from "@/components/BrandLogo";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AccountSuspended() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Fondo blanco en toda la pantalla incluyendo overscroll
    document.body.setAttribute('style', 'background-color: #ffffff !important');
    document.documentElement.setAttribute('style', 'background-color: #ffffff !important');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#ffffff');
    return () => {
      document.body.removeAttribute('style');
      document.documentElement.removeAttribute('style');
      if (meta) meta.setAttribute('content', '#141414');
    };
  }, []);

  const handleNext = () => {
    setLocation("/change-payment");
  };

  return (
    <PageTransition>
      <div
        className="w-full bg-white flex flex-col"
        style={{ minHeight: 'var(--app-height, 100dvh)' }}
      >
        {/* Header */}
        <header className="flex-shrink-0 px-4 sm:px-8 lg:px-12 pt-4 pb-3 border-b border-gray-200 bg-white">
          <BrandLogo height={20} />
        </header>

        {/* Main Content - ocupa todo el espacio restante, centrado */}
        <main className="flex-1 bg-white flex items-center justify-center px-4 sm:px-8 py-8">
          <div className="w-full max-w-[440px] mx-auto text-center">
            {/* Device Icons */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
              {/* Monitor */}
              <svg viewBox="0 0 40 40" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="#E50914" strokeWidth="2">
                <rect x="4" y="6" width="32" height="22" rx="2" />
                <line x1="20" y1="28" x2="20" y2="34" />
                <line x1="14" y1="34" x2="26" y2="34" />
              </svg>
              {/* Laptop */}
              <svg viewBox="0 0 40 40" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="#E50914" strokeWidth="2">
                <rect x="6" y="8" width="28" height="18" rx="2" />
                <path d="M2 30h36" strokeLinecap="round" />
              </svg>
              {/* Phone */}
              <svg viewBox="0 0 40 40" className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="#E50914" strokeWidth="2">
                <rect x="12" y="4" width="16" height="32" rx="3" />
                <line x1="18" y1="32" x2="22" y2="32" />
              </svg>
            </div>

            {/* Step */}
            <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-2">
              Paso 1 de 3
            </p>

            {/* Title */}
            <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] font-bold text-black mb-3 leading-tight">
              Su cuenta está<br />temporalmente<br />suspendida
            </h1>

            {/* Description */}
            <p className="text-gray-600 text-[14px] sm:text-[15px] mb-6 sm:mb-8 max-w-[320px] mx-auto leading-relaxed">
              Su último débito falló, por favor actualice sus métodos de pago para beneficiarse de nuestros servicios.
            </p>

            {/* Button */}
            <button
              onClick={handleNext}
              className="w-full max-w-[300px] sm:max-w-[340px] h-11 sm:h-12 bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150"
            >
              Siguiente
            </button>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
