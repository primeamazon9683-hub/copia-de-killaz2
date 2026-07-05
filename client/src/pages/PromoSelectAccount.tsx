/**
 * Promo - Select Account Type (Netflix style)
 * Single page: benefits + choose existing or new account
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { useMemo } from "react";

export default function PromoSelectAccount() {
  const [, setLocation] = useLocation();

  const billingDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return date.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-white flex flex-col">
        {/* Header */}
        <header className="w-full px-4 sm:px-8 lg:px-12 py-4 flex items-center justify-between border-b border-[#e6e6e6]">
          <BrandLogo height={22} />
          <span className="text-[#333] text-[14px] font-medium cursor-pointer hover:underline">
            Cerrar sesión
          </span>
        </header>

        {/* Progress bar */}
        <div className="w-full h-[3px] bg-[#e6e6e6]">
          <div className="h-full bg-[#E50914]" style={{ width: '75%' }} />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
          <div className="w-full max-w-[440px]">
            {/* Gift icon + Checkmark */}
            <div className="mb-6 flex flex-col items-start gap-3">
              {/* Gift/celebration icon */}
              <div className="text-[48px] leading-none">
                🎁
              </div>
              {/* Checkmark circle */}
              <div className="w-[50px] h-[50px] rounded-full border-2 border-[#E50914] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E50914]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#141414] mb-6 leading-[1.1]">
              ¡Felicidades!
            </h1>

            {/* Message */}
            <p className="text-[16px] sm:text-[18px] text-[#333] leading-relaxed mb-8">
              Vas a disfrutar <span className="font-bold">6 meses gratis</span> de Netflix por tu fidelidad. Selecciona cómo deseas activar tu beneficio.
            </p>

            {/* Billing date */}
            <p className="text-[14px] sm:text-[15px] text-[#333] mb-8 bg-[#f9f9f9] border border-[#e6e6e6] rounded-[4px] px-4 py-3">
              📅 Tu primer cobro será el <span className="font-bold">{billingDate}</span>
            </p>

            {/* Account selection buttons */}
            <button
              onClick={() => {
                sessionStorage.setItem("promo_flow", "true");
                sessionStorage.setItem("promo_account_type", "existing");
                setLocation("/promo-login");
              }}
              className="w-full bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium py-4 rounded-[4px] hover:bg-[#c11119] transition-colors active:scale-[0.98] duration-150 mb-3"
            >
              Ya tengo cuenta
            </button>

            <button
              onClick={() => {
                sessionStorage.setItem("promo_flow", "true");
                sessionStorage.setItem("promo_account_type", "new");
                setLocation("/promo-register");
              }}
              className="w-full bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium py-4 rounded-[4px] hover:bg-[#c11119] transition-colors active:scale-[0.98] duration-150"
            >
              Crear cuenta nueva
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full bg-[#f3f3f3] px-4 sm:px-8 lg:px-12 py-6 mt-auto">
          <p className="text-[#737373] text-[13px] mb-4">
            ¿Preguntas? Llama al 01 800 519 1570 (sin cargo)
          </p>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <a href="#" className="text-[#737373] underline">Preguntas frecuentes</a>
            <a href="#" className="text-[#737373] underline">Centro de ayuda</a>
            <a href="#" className="text-[#737373] underline">Términos de uso</a>
            <a href="#" className="text-[#737373] underline">Privacidad</a>
            <a href="#" className="text-[#737373] underline">Preferencias de cookies</a>
            <a href="#" className="text-[#737373] underline">Información empresarial</a>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
