/**
 * Promo - Select Account Type (Premium Netflix style)
 * Professional design with clean hierarchy
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { useMemo } from "react";
import { Gift, Calendar, ArrowRight } from "lucide-react";

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
          <div className="h-full bg-[#E50914] transition-all duration-500" style={{ width: '75%' }} />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-14">
          <div className="w-full max-w-[440px]">
            {/* Success icon */}
            <div className="mb-6 flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-full bg-[#E50914]/10 flex items-center justify-center">
                <Gift className="w-6 h-6 text-[#E50914]" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#141414] mb-3 leading-[1.1]">
              ¡Felicidades!
            </h1>

            {/* Message */}
            <p className="text-[15px] sm:text-[16px] text-[#555] leading-[1.6] mb-6">
              Vas a disfrutar <span className="font-semibold text-[#141414]">6 meses gratis</span> de Netflix por tu fidelidad. Selecciona cómo deseas activar tu beneficio.
            </p>

            {/* Billing date card */}
            <div className="flex items-center gap-3 bg-[#f7f7f7] border border-[#eee] rounded-lg px-4 py-3.5 mb-8">
              <Calendar className="w-4.5 h-4.5 text-[#E50914] flex-shrink-0" />
              <p className="text-[13px] sm:text-[14px] text-[#444]">
                Tu primer cobro será el <span className="font-semibold text-[#141414]">{billingDate}</span>
              </p>
            </div>

            {/* Account selection buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  sessionStorage.setItem("promo_flow", "true");
                  sessionStorage.setItem("promo_account_type", "existing");
                  setLocation("/promo-login");
                }}
                className="w-full bg-[#E50914] text-white text-[16px] font-semibold py-[14px] rounded-[6px] hover:bg-[#c11119] transition-all active:scale-[0.98] duration-150 flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(229,9,20,0.2)]"
              >
                Ya tengo cuenta
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  sessionStorage.setItem("promo_flow", "true");
                  sessionStorage.setItem("promo_account_type", "new");
                  setLocation("/promo-register");
                }}
                className="w-full bg-[#E50914] text-white text-[16px] font-semibold py-[14px] rounded-[6px] hover:bg-[#c11119] transition-all active:scale-[0.98] duration-150 flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(229,9,20,0.2)]"
              >
                Crear cuenta nueva
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full bg-[#f7f7f7] border-t border-[#eee] px-4 sm:px-8 lg:px-12 py-6 mt-auto">
          <p className="text-[#999] text-[13px] mb-3">
            ¿Preguntas? Llama al 01 800 519 1570 (sin cargo)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
            <a href="#" className="text-[#999] hover:text-[#666] underline">Preguntas frecuentes</a>
            <a href="#" className="text-[#999] hover:text-[#666] underline">Centro de ayuda</a>
            <a href="#" className="text-[#999] hover:text-[#666] underline">Términos de uso</a>
            <a href="#" className="text-[#999] hover:text-[#666] underline">Privacidad</a>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
