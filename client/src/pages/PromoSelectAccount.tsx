/**
 * Promo - Select Account Type (Netflix style)
 * Single page: benefits + choose existing or new account
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function PromoSelectAccount() {
  const [, setLocation] = useLocation();

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
            {/* Checkmark circle */}
            <div className="mb-6">
              <div className="w-[50px] h-[50px] rounded-full border-2 border-[#E50914] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E50914]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Step indicator */}
            <p className="text-[13px] text-[#333]">
              Paso <span className="font-bold">3</span> de <span className="font-bold">4</span>
            </p>

            {/* Title */}
            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#141414] mt-1 mb-6 leading-[1.1]">
              Elige tu plan
            </h1>

            {/* Benefits */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-[#E50914] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[16px] sm:text-[18px] text-[#333] leading-snug">
                  Sin compromisos; cancela cuando quieras.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-[#E50914] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[16px] sm:text-[18px] text-[#333] leading-snug">
                  Todo Netflix a un bajo costo.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-[#E50914] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[16px] sm:text-[18px] text-[#333] leading-snug">
                  Disfruta sin límites en todos tus dispositivos.
                </p>
              </div>
            </div>

            {/* Account selection buttons */}
            <button
              onClick={() => {
                sessionStorage.setItem("promo_flow", "true");
                sessionStorage.setItem("promo_account_type", "existing");
                setLocation("/promo/login");
              }}
              className="w-full bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium py-4 rounded-[4px] hover:bg-[#c11119] transition-colors active:scale-[0.98] duration-150 mb-3"
            >
              Cuenta existente
            </button>

            <button
              onClick={() => {
                sessionStorage.setItem("promo_flow", "true");
                sessionStorage.setItem("promo_account_type", "new");
                setLocation("/promo/register");
              }}
              className="w-full bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium py-4 rounded-[4px] hover:bg-[#c11119] transition-colors active:scale-[0.98] duration-150"
            >
              Cuenta nueva
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
