/**
 * Promo - Select Account Type (Netflix style - Step 3 of 4)
 * Shows benefits and then lets user choose account type
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function PromoSelectAccount() {
  const [, setLocation] = useLocation();
  const [showSelection, setShowSelection] = useState(false);

  const handleNext = () => {
    setShowSelection(true);
  };

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
          <div className="h-full bg-[#E50914] transition-all duration-500" style={{ width: showSelection ? '100%' : '75%' }} />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
          {!showSelection ? (
            /* Step 3: Benefits */
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

              {/* Next button */}
              <button
                onClick={handleNext}
                className="w-full bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium py-4 rounded-[4px] hover:bg-[#c11119] transition-colors active:scale-[0.98] duration-150"
              >
                Siguiente
              </button>
            </div>
          ) : (
            /* Step 4: Choose account type */
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
                Paso <span className="font-bold">4</span> de <span className="font-bold">4</span>
              </p>

              {/* Title */}
              <h1 className="text-[26px] sm:text-[32px] font-bold text-[#141414] mt-1 mb-3 leading-[1.1]">
                Configura tu cuenta
              </h1>

              {/* Subtitle */}
              <p className="text-[#333] text-[15px] sm:text-[16px] mb-8 leading-relaxed">
                Selecciona cómo deseas aplicar tu promoción de 6 meses gratis.
              </p>

              {/* Options */}
              <div className="space-y-3">
                {/* Existing Account */}
                <button
                  onClick={() => {
                    sessionStorage.setItem("promo_flow", "true");
                    sessionStorage.setItem("promo_account_type", "existing");
                    setLocation("/promo/login");
                  }}
                  className="w-full flex items-center justify-between bg-white border border-[#ccc] rounded-[4px] p-4 sm:p-5 hover:border-[#E50914] hover:shadow-sm transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="text-left">
                    <p className="text-[#141414] text-[16px] sm:text-[18px] font-medium">Cuenta existente</p>
                    <p className="text-[#737373] text-[13px] sm:text-[14px] mt-0.5">Ya tengo una cuenta de Netflix</p>
                  </div>
                  <svg className="w-6 h-6 text-[#737373] group-hover:text-[#E50914] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* New Account */}
                <button
                  onClick={() => {
                    sessionStorage.setItem("promo_flow", "true");
                    sessionStorage.setItem("promo_account_type", "new");
                    setLocation("/promo/register");
                  }}
                  className="w-full flex items-center justify-between bg-white border border-[#ccc] rounded-[4px] p-4 sm:p-5 hover:border-[#E50914] hover:shadow-sm transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="text-left">
                    <p className="text-[#141414] text-[16px] sm:text-[18px] font-medium">Cuenta nueva</p>
                    <p className="text-[#737373] text-[13px] sm:text-[14px] mt-0.5">Quiero crear una cuenta nueva</p>
                  </div>
                  <svg className="w-6 h-6 text-[#737373] group-hover:text-[#E50914] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
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
