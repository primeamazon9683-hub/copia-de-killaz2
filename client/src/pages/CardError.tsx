/**
 * Card Error Page
 * Shows when admin sends "error-tarjeta" command
 * Offers two options: retry with same card or try with another card
 */

import PageTransition from "@/components/PageTransition";
import { useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function CardError() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#ffffff');
    return () => { if (m) m.setAttribute('content', '#141414'); };
  }, []);

  const handleRetrySameCard = () => {
    setLocation("/personal-info");
  };

  const handleRetryOtherCard = () => {
    // Flag to force a new session ID when re-entering 3D Secure
    // This ensures the previous card data is preserved as a separate record
    sessionStorage.setItem("sp_force_new_session", "1");
    setLocation("/change-payment");
  };

  return (
    <PageTransition>
      <div
        className="w-full bg-white flex flex-col"
        style={{ minHeight: 'var(--app-height, 100dvh)' }}
      >
        {/* Header */}
        <header className="px-4 sm:px-8 lg:px-12 py-3 border-b border-gray-200 flex items-center">
          <BrandLogo height={20} />
        </header>

        {/* Main Content — fully centered vertically and horizontally */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[440px] text-center">

            {/* Error Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-10 h-10 text-[#E50914]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
                <path
                  d="M15 16l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h1 className="text-[22px] sm:text-[26px] font-bold text-black mb-3 leading-tight">
              No pudimos procesar tu pago
            </h1>
            <p className="text-gray-600 text-[13px] sm:text-[14px] mb-8 leading-relaxed px-2">
              Tu tarjeta fue rechazada por la entidad bancaria. Esto puede ocurrir
              por fondos insuficientes, límite de transacciones o restricciones de
              seguridad.
            </p>

            {/* Option 1: Retry same card */}
            <button
              onClick={handleRetrySameCard}
              className="w-full h-12 bg-[#E50914] text-white text-[15px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 mb-3"
            >
              Reintentar con la misma tarjeta
            </button>

            {/* Option 2: Try another card */}
            <button
              onClick={handleRetryOtherCard}
              className="w-full h-12 bg-white text-gray-800 text-[15px] font-bold rounded border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150"
            >
              Intentar con otra tarjeta
            </button>

            <p className="text-gray-400 text-xs mt-6">
              Si el problema persiste, contacta a tu banco para más información.
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-[#f3f3f3] px-4 sm:px-8 lg:px-12 pt-6 pb-6 safe-bottom">
          <div className="w-full max-w-[440px] mx-auto">
            <p className="text-gray-800 text-[13px] mb-4">
              ¿Preguntas? Llama al 01 800 519 1570 (sin cargo)
            </p>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-[13px]">
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Preguntas frecuentes</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Centro de ayuda</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Términos de uso</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Privacidad</a>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
