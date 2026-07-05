/**
 * Banned Page - Shown when user's IP is banned
 */
export default function Banned() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#141414] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Acceso Denegado</h1>
        <p className="text-gray-400 text-sm mb-6">
          Tu acceso ha sido restringido. Si crees que esto es un error, contacta al soporte técnico.
        </p>
        <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
          <p className="text-xs text-red-400/80">Código de error: 403 - IP restringida</p>
        </div>
      </div>
    </div>
  );
}
