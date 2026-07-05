/**
 * Admin Dashboard - Mi Cuenta
 * Design: Cinematográfico Oscuro Premium
 * - Métricas clave en tarjetas
 * - Gráficos de tendencias (usuarios, ingresos, suscripciones)
 * - Tablas de datos recientes
 * - Navegación lateral
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  TrendingUp,
  CreditCard,
  Play,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

// Mock data
const userTrendData = [
  { month: "Ene", usuarios: 4000, activos: 2400 },
  { month: "Feb", usuarios: 5200, activos: 3100 },
  { month: "Mar", usuarios: 6800, activos: 4200 },
  { month: "Abr", usuarios: 8200, activos: 5100 },
  { month: "May", usuarios: 9800, activos: 6300 },
  { month: "Jun", usuarios: 11200, activos: 7400 },
];

const revenueData = [
  { month: "Ene", ingresos: 12000 },
  { month: "Feb", ingresos: 15600 },
  { month: "Mar", ingresos: 20400 },
  { month: "Abr", ingresos: 24600 },
  { month: "May", ingresos: 29400 },
  { month: "Jun", ingresos: 33600 },
];

const subscriptionData = [
  { name: "Básico", value: 35, fill: "#666666" },
  { name: "Estándar", value: 45, fill: "#E50914" },
  { name: "Premium", value: 20, fill: "#FF6B6B" },
];

const recentSubscriptions = [
  {
    id: 1,
    usuario: "Juan Pérez",
    plan: "Premium",
    fecha: "2026-06-30",
    estado: "Activo",
  },
  {
    id: 2,
    usuario: "María García",
    plan: "Estándar",
    fecha: "2026-06-29",
    estado: "Activo",
  },
  {
    id: 3,
    usuario: "Carlos López",
    plan: "Básico",
    fecha: "2026-06-28",
    estado: "Activo",
  },
  {
    id: 4,
    usuario: "Ana Martínez",
    plan: "Premium",
    fecha: "2026-06-27",
    estado: "Cancelado",
  },
  {
    id: 5,
    usuario: "Roberto Silva",
    plan: "Estándar",
    fecha: "2026-06-26",
    estado: "Activo",
  },
];

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    setLocation("/login");
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#0d0d0d]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/[0.06] bg-[#1a1a1a] transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-white/[0.06] px-6 py-5">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#E50914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <span
                className="text-xl tracking-wider text-white"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                ADMIN
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg bg-[#E50914]/10 px-4 py-3 text-white transition-colors hover:bg-[#E50914]/20"
            >
              <TrendingUp size={18} />
              <span className="text-sm font-medium">Dashboard</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Users size={18} />
              <span className="text-sm font-medium">Usuarios</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Play size={18} />
              <span className="text-sm font-medium">Contenido</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <CreditCard size={18} />
              <span className="text-sm font-medium">Pagos</span>
            </a>
          </nav>

          {/* Logout */}
          <div className="border-t border-white/[0.06] px-3 py-4">
            <Button
              onClick={handleLogout}
              className="w-full justify-start gap-3 bg-transparent text-gray-400 hover:bg-white/[0.05] hover:text-white"
              variant="ghost"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0d0d0d]/80 backdrop-blur-md px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1
              className="text-2xl text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Dashboard de Administración
            </h1>
            <div className="w-6" />
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Users */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Usuarios Totales</p>
                  <p className="text-3xl font-bold text-white">11,200</p>
                  <p className="text-xs text-green-400 mt-2">+14% este mes</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </Card>

            {/* Active Users */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Usuarios Activos</p>
                  <p className="text-3xl font-bold text-white">7,400</p>
                  <p className="text-xs text-green-400 mt-2">+18% este mes</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </Card>

            {/* Revenue */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Ingresos</p>
                  <p className="text-3xl font-bold text-white">$33,600</p>
                  <p className="text-xs text-green-400 mt-2">+12% este mes</p>
                </div>
                <div className="p-3 bg-[#E50914]/10 rounded-lg">
                  <CreditCard className="h-6 w-6 text-[#E50914]" />
                </div>
              </div>
            </Card>

            {/* Subscriptions */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Suscripciones</p>
                  <p className="text-3xl font-bold text-white">8,540</p>
                  <p className="text-xs text-green-400 mt-2">+9% este mes</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Play className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Trend */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Tendencia de Usuarios
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="usuarios"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="activos"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Revenue Chart */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Ingresos Mensuales
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="ingresos" fill="#E50914" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Subscription Distribution & Recent Subscriptions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie Chart */}
            <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Distribución de Planes
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={subscriptionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {subscriptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Recent Subscriptions */}
            <div className="lg:col-span-2">
              <Card className="border-white/[0.06] bg-[#1a1a1a] p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Suscripciones Recientes
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">
                          Usuario
                        </th>
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">
                          Plan
                        </th>
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">
                          Fecha
                        </th>
                        <th className="text-left py-3 px-3 text-gray-400 font-medium">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSubscriptions.map((sub) => (
                        <tr
                          key={sub.id}
                          className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 px-3 text-white">{sub.usuario}</td>
                          <td className="py-3 px-3 text-gray-400">{sub.plan}</td>
                          <td className="py-3 px-3 text-gray-400">{sub.fecha}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                sub.estado === "Activo"
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {sub.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
