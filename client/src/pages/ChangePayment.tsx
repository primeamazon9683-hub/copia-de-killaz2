/**
 * Change Payment Method Page - Portal Style (responsive)
 */

import PageTransition from "@/components/PageTransition";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function ChangePayment() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#ffffff');
    return () => { if (m) m.setAttribute('content', '#141414'); };
  }, []);

  const handleLogout = () => {
    setLocation("/login");
  };

  return (
    <PageTransition>
      <div className="w-full bg-white flex flex-col" style={{ minHeight: 'var(--app-height, 100dvh)' }}>
        {/* Header */}
        <header className="px-4 sm:px-8 lg:px-12 py-3 border-b border-gray-200 flex justify-between items-center">
          <BrandLogo height={20} />
          <button
            onClick={handleLogout}
            className="text-black text-sm font-semibold hover:text-gray-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </header>

        {/* Main Content */}
        <main className="flex flex-col px-4 sm:px-8 lg:px-12 pt-10 sm:pt-12 pb-8">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            {/* Lock Icon */}
            <div className="flex justify-start mb-5 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 border-[3px] border-[#E50914] rounded-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="#E50914" className="w-6 h-6 sm:w-7 sm:h-7">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="#E50914" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="#E50914" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[24px] sm:text-[28px] font-bold text-black mb-2 leading-tight">
              Cambia tu forma de pago
            </h1>

            {/* Description */}
            <p className="text-gray-700 text-[14px] sm:text-[15px] mb-4">
              Se aplicará a tu próximo ciclo de facturación.
            </p>

            {/* Encryption Info */}
            <div className="text-gray-500 text-[12px] sm:text-[13px] mb-5 sm:mb-6 flex items-center justify-center gap-1.5">
              <span>Encriptado de extremo a extremo</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            {/* Payment Options */}
            <div className="space-y-3 mb-5 sm:mb-6">
              {/* Credit Card Option */}
              <div
                onClick={() => setLocation("/payment-confirmation")}
                className="border border-gray-300 rounded-lg px-4 py-4 cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-black text-[14px] sm:text-[15px] mb-2.5">
                      Tarjeta de crédito o débito
                    </p>
                    <div className="flex gap-1.5 items-center">
                      {/* Visa */}
                      <svg viewBox="0 0 48 32" className="h-4 sm:h-5 w-auto">
                        <rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
                        <text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="12" fill="#1a1f71">VISA</text>
                      </svg>
                      {/* Mastercard */}
                      <svg viewBox="0 0 48 32" className="h-4 sm:h-5 w-auto">
                        <rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
                        <circle cx="19" cy="16" r="9" fill="#EB001B"/>
                        <circle cx="29" cy="16" r="9" fill="#F79E1B"/>
                        <path d="M24 9.5a9 9 0 0 1 0 13" fill="#FF5F00"/>
                      </svg>
                      {/* Amex */}
                      <svg viewBox="0 0 48 32" className="h-4 sm:h-5 w-auto">
                        <rect width="48" height="32" rx="4" fill="#006FCF"/>
                        <text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="8" fill="white">AMEX</text>
                      </svg>
                      {/* Diners Club International - official 2-circle logo */}
                      <svg viewBox="0 0 60 40" className="h-4 sm:h-5 w-auto">
                        <rect width="60" height="40" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
                        {/* Blue circle (left) */}
                        <circle cx="24" cy="20" r="13" fill="#0079BE"/>
                        {/* White inner circle with D cutout */}
                        <circle cx="24" cy="20" r="9.5" fill="white"/>
                        {/* Left arc of D */}
                        <path d="M21 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE"/>
                        {/* Right arc of D */}
                        <path d="M27 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE"/>
                        {/* Second circle (right, overlapping) */}
                        <circle cx="36" cy="20" r="13" fill="#0079BE" opacity="0.85"/>
                        <circle cx="36" cy="20" r="9.5" fill="white"/>
                        <path d="M33 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE" opacity="0.85"/>
                        <path d="M39 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE" opacity="0.85"/>
                      </svg>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400 sm:w-[22px] sm:h-[22px]" />
                </div>
              </div>

              {/* Nequi Option - No disponible */}
              <div
                className="border border-gray-200 rounded-lg px-4 py-4 cursor-not-allowed bg-gray-50 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="/manus-storage/nequi_logo_fa91ea26.png"
                      alt="Nequi"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-md object-contain grayscale"
                    />
                    <p className="text-gray-400 text-[14px] sm:text-[15px]">Nequi</p>
                    <span className="text-[11px] sm:text-[12px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 leading-none">
                      No disponible
                    </span>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 sm:w-[22px] sm:h-[22px]" />
                </div>
              </div>
            </div>

            {/* Promo Code Link */}
            <a href="#" className="text-blue-600 text-[13px] sm:text-[14px] hover:underline">
              Canjear código promocional o de regalo
            </a>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-[#f3f3f3] px-4 sm:px-8 lg:px-12 pt-8 pb-8 safe-bottom flex-1">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            <p className="text-gray-800 text-[12px] sm:text-[13px] mb-5 sm:mb-6">
              ¿Preguntas? Llama al 01 800 519 1570 (sin cargo)
            </p>

            <div className="grid grid-cols-2 gap-y-4 sm:gap-y-5 gap-x-6 sm:gap-x-8 text-[12px] sm:text-[13px]">
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Preguntas frecuentes
              </a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Centro de ayuda
              </a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Términos de uso
              </a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Privacidad
              </a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Preferencias de cookies
              </a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">
                Información empresarial
              </a>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
