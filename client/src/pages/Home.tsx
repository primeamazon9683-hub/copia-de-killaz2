/**
 * Home Page - Service Portal
 * Generic landing that redirects to login
 */

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  // Redirect immediately to login
  useEffect(() => {
    setLocation("/login");
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="animate-pulse text-white text-sm">Cargando...</div>
    </div>
  );
}
