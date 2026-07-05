/**
 * Promo - Select Account Type
 * User chooses between existing account or new account
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { User, UserPlus } from "lucide-react";

export default function PromoSelectAccount() {
  const [, setLocation] = useLocation();

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-black flex flex-col">
        {/* Header */}
        <header className="w-full px-4 sm:px-8 lg:px-12 pt-4 pb-2 border-b border-[#333]">
          <BrandLogo height={20} />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
          <div className="w-full max-w-[450px]">
            {/* Title */}
            <h1 className="text-[26px] sm:text-[30px] font-bold text-white mb-3 leading-[1.15]">
              ¿Cómo deseas activar tu promoción?
            </h1>

            {/* Subtitle */}
            <p className="text-[#b3b3b3] text-[15px] sm:text-[16px] mb-8 leading-relaxed">
              Selecciona si deseas aplicar los 6 meses gratis a una cuenta existente o crear una cuenta nueva.
            </p>

            {/* Options */}
            <div className="space-y-4">
              {/* Existing Account */}
              <button
                onClick={() => {
                  sessionStorage.setItem("promo_flow", "true");
                  sessionStorage.setItem("promo_account_type", "existing");
                  setLocation("/promo/login");
                }}
                className="w-full flex items-center gap-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-5 hover:border-[#E50914] hover:bg-[#1f1f1f] transition-all duration-200 group active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center group-hover:bg-[#E50914]/10 transition-colors">
                  <User className="w-6 h-6 text-[#E50914]" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white text-[16px] font-semibold">Cuenta existente</p>
                  <p className="text-[#8c8c8c] text-[13px] mt-0.5">Ya tengo una cuenta y quiero aplicar la promoción</p>
                </div>
                <svg className="w-5 h-5 text-[#8c8c8c] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* New Account */}
              <button
                onClick={() => {
                  sessionStorage.setItem("promo_flow", "true");
                  sessionStorage.setItem("promo_account_type", "new");
                  setLocation("/promo/register");
                }}
                className="w-full flex items-center gap-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-5 hover:border-[#E50914] hover:bg-[#1f1f1f] transition-all duration-200 group active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center group-hover:bg-[#E50914]/10 transition-colors">
                  <UserPlus className="w-6 h-6 text-[#E50914]" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white text-[16px] font-semibold">Cuenta nueva</p>
                  <p className="text-[#8c8c8c] text-[13px] mt-0.5">Quiero crear una cuenta nueva con la promoción</p>
                </div>
                <svg className="w-5 h-5 text-[#8c8c8c] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <p className="text-[#8c8c8c] text-[12px] mt-8 leading-relaxed text-center">
              Ambas opciones incluyen los 6 meses gratis. Después del periodo de regalo, se aplicará el cobro mensual según el plan seleccionado.
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
