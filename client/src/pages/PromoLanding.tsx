/**
 * Promo Landing Page - 6 meses gratis por fidelidad
 * Explains the offer and leads to account selection
 */

import PageTransition from "@/components/PageTransition";
import { useLocation } from "wouter";
import { useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";
import { Gift, CheckCircle, Shield, CreditCard } from "lucide-react";

export default function PromoLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-black flex flex-col">
        {/* Header */}
        <header className="w-full px-4 sm:px-8 lg:px-12 pt-4 pb-2 border-b border-[#333]">
          <BrandLogo height={20} />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12">
          <div className="w-full max-w-[500px]">
            {/* Promo Badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#E50914] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Oferta exclusiva
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[26px] sm:text-[32px] font-bold text-white mb-3 leading-[1.15]">
              ¡6 meses gratis por tu fidelidad!
            </h1>

            {/* Subtitle */}
            <p className="text-[#b3b3b3] text-[15px] sm:text-[16px] mb-6 leading-relaxed">
              Como agradecimiento por ser parte de nuestra comunidad, te regalamos <span className="text-white font-semibold">6 meses completamente gratis</span>. No se realizará ningún cobro hasta que finalice tu periodo de regalo.
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
                <Gift className="w-5 h-5 text-[#E50914] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-[14px] font-medium">6 meses sin costo</p>
                  <p className="text-[#8c8c8c] text-[13px]">Disfruta de todo el contenido sin pagar nada durante 6 meses completos.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
                <CreditCard className="w-5 h-5 text-[#E50914] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-[14px] font-medium">Se empezará a cobrar en 6 meses</p>
                  <p className="text-[#8c8c8c] text-[13px]">Solo necesitamos verificar tu método de pago. No se realizará ningún cargo hoy.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
                <Shield className="w-5 h-5 text-[#E50914] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-[14px] font-medium">Cancela cuando quieras</p>
                  <p className="text-[#8c8c8c] text-[13px]">Puedes cancelar en cualquier momento antes de que se active el cobro.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
                <CheckCircle className="w-5 h-5 text-[#E50914] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-[14px] font-medium">Acceso completo</p>
                  <p className="text-[#8c8c8c] text-[13px]">Películas, series, documentales y contenido exclusivo en todos tus dispositivos.</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setLocation("/promo/select-account")}
              className="w-full h-[50px] bg-[#E50914] text-white text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150"
            >
              Continuar
            </button>

            {/* Fine print */}
            <p className="text-[#8c8c8c] text-[11px] mt-4 leading-relaxed text-center">
              Al continuar, aceptas los Términos de uso y confirmas que has leído la Declaración de privacidad. La oferta es válida para cuentas nuevas y existentes. El cobro se activará automáticamente después de los 6 meses de regalo.
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
