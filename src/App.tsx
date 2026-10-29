/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  LayoutDashboard,
  Truck,
  Wallet,
  Menu,
  ShieldCheck,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { WeighingSection } from './components/WeighingSection';
import { PurchasesSection } from './components/PurchasesSection';
import { InventorySection } from './components/InventorySection';
import { ShipmentSection } from './components/ShipmentSection';
import { FactorySalesSection } from './components/FactorySalesSection';
import { CashSection } from './components/CashSection';
import { LoansDebtsSection } from './components/LoansDebtsSection';
import { ReportsSection } from './components/ReportsSection';
import { MasterDataSection } from './components/MasterDataSection';
import { AuditLogSection } from './components/AuditLogSection';
import { TicketPrintModal } from './components/TicketPrintModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { storage } from './lib/storage';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { UserProfile, WeighingTicket } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [printTicket, setPrintTicket] = useState<WeighingTicket | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 1. Session & Profile Initialization
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        storage.setCurrentUser(null as any);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Suppress Vite dev server WebSocket connection rejections in preview environment
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || '');
      if (reason.includes('WebSocket') || reason.includes('websocket') || reason.includes('vite')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // 2. Fetch Profile from public.profiles
  const fetchProfile = async (userId: string) => {
    console.log('[Auth] Fetching profile for user ID:', userId);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('[Auth] Profile fetch error details:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          userId
        });
        console.error('[Auth] Full Error Object:', JSON.stringify(error, null, 2));
        await supabase.auth.signOut();
        
        if (error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
          setAuthError('Database belum siap (Tabel profiles tidak ditemukan). Pastikan skrip SQL sudah dijalankan di Supabase.');
        } else if (error?.code === 'PGRST116') {
          setAuthError('Profil tidak ditemukan di tabel public.profiles. Pastikan email Anda sudah terdaftar.');
        } else {
          setAuthError(`Gagal mengambil profil: ${error?.message || 'Profil tidak ditemukan'}`);
        }
        return;
      }

      console.log('[Auth] Profile found:', profile);

      if (!profile.is_active) {
        console.warn('[Auth] Account is inactive:', profile.email);
        await supabase.auth.signOut();
        setAuthError('Akun Anda dinonaktifkan. Silakan hubungi Owner.');
        return;
      }

      if (profile.role !== 'OWNER' && profile.role !== 'ADMIN') {
        console.warn('[Auth] Invalid role:', profile.role);
        await supabase.auth.signOut();
        setAuthError(`Role "${profile.role}" tidak diizinkan mengakses aplikasi ini.`);
        return;
      }

      const user: UserProfile = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        phone: profile.phone,
        isActive: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };

      setCurrentUser(user);
      storage.setCurrentUser(user);
      setAuthError(null);
      console.log('[Auth] Login success for:', user.name, 'Role:', user.role);
    } catch (err: any) {
      console.error('[Auth] Fetch profile exception:', err);
      setAuthError(`Kesalahan Sistem: ${err.message || 'Gagal memvalidasi profil'}`);
      await supabase.auth.signOut();
    }
  };

  // 3. Handle Login
  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError(null);
    console.log('[Auth] Attempting login for:', loginEmail);

    try {
      console.log('[Auth] Supabase URL being used:', (supabase as any).supabaseUrl);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        console.error('[Auth] Supabase Auth Error:', {
          message: error.message,
          status: (error as any).status,
          name: error.name
        });
        console.error('[Auth] Full Auth Error Detail:', JSON.stringify(error, null, 2));
        
        if (error.message === 'Invalid login credentials') {
          setAuthError('Email atau password salah. Pastikan akun sudah dikonfirmasi di tab Auth Supabase.');
        } else if (error.message.includes('fetch') || error.message.includes('Network')) {
          setAuthError('Gagal terhubung ke Supabase. Periksa URL/Key atau koneksi internet.');
        } else if (error.message === 'Email not confirmed') {
          setAuthError('Email belum dikonfirmasi. Silakan cek kotak masuk email Anda atau matikan "Confirm Email" di Supabase Auth Settings.');
        } else {
          setAuthError(error.message);
        }
      } else {
        console.log('[Auth] Auth sign-in successful, user ID:', data.user?.id);
      }
    } catch (err) {
      console.error('[Auth] Unexpected login error:', err);
      setAuthError('Terjadi kesalahan tak terduga saat login.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 4. Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    storage.setCurrentUser(null as any);
    setActiveTab('dashboard');
  };

  // 5. Loading View
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-bold animate-pulse tracking-widest uppercase">Memeriksa Sesi...</p>
        </div>
      </div>
    );
  }

  // 6. Login View
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30">
              <Scale className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                RAM SUMBER REZEKI
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Sistem Manajemen Operasional & Keuangan
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 font-bold leading-relaxed">
                {authError}
              </p>
            </div>
          )}

          <form onSubmit={handleFormLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 ml-1">
                Username
              </label>
              <input
                type="email"
                placeholder="Username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                disabled={loginLoading}
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 ml-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                disabled={loginLoading}
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 group"
            >
              {loginLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ShieldCheck className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <p className="text-[10px] text-slate-400 font-medium">
              &copy; 2026 RAM Sumber Rezeki. Seluruh hak cipta dilindungi.
            </p>
          </div>
        </div>

        {/* Modal inside the same container so it shows even if not logged in */}
        {isSupabaseModalOpen && (
          <SupabaseConfigModal onClose={() => setIsSupabaseModalOpen(false)} />
        )}
      </div>
    );
  }

  // 7. Main Dashboard View (Authenticated)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      <div className="flex flex-1">
        {/* Sidebar Component */}
        <Sidebar
          currentRole={currentUser.role}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-6">
          {/* Top Navbar */}
          <Navbar
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeTab={activeTab}
          />

          {/* Mobile Header Bar for toggling sidebar */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center gap-2 text-xs font-bold"
            >
              <Menu className="w-4 h-4" />
              <span>Menu Navigasi</span>
            </button>

            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {currentUser.role}: {currentUser.name.split(' ')[0]}
            </span>
          </div>

          {/* Main View Router */}
          <main className="flex-1 p-3 sm:p-4 w-full max-w-none">
            {activeTab === 'dashboard' && (
              <Dashboard
                currentUser={currentUser}
                onNavigate={setActiveTab}
                onOpenTicketPrint={setPrintTicket}
              />
            )}

            {activeTab === 'weighing' && (
              <WeighingSection
                currentUser={currentUser}
                onOpenPrint={setPrintTicket}
                externalSearch={searchTerm}
              />
            )}

            {activeTab === 'purchases' && (
              <PurchasesSection
                currentUser={currentUser}
                onOpenPrint={setPrintTicket}
              />
            )}

            {activeTab === 'inventory' && (
              <InventorySection currentUser={currentUser} />
            )}

            {activeTab === 'shipments' && (
              <ShipmentSection currentUser={currentUser} />
            )}

            {activeTab === 'factory_sales' && (
              <FactorySalesSection currentUser={currentUser} />
            )}

            {activeTab === 'cash' && (
              <CashSection currentUser={currentUser} />
            )}

            {activeTab === 'loans' && (
              <LoansDebtsSection currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <ReportsSection currentUser={currentUser} />
            )}

            {activeTab === 'master_data' && (
              <MasterDataSection currentUser={currentUser} />
            )}

            {activeTab === 'audit_logs' && (
              <AuditLogSection currentUser={currentUser} />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Smartphone Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around py-2 px-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors ${
            activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('weighing')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors ${
            activeTab === 'weighing' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Timbang</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors ${
            activeTab === 'shipments' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Kirim PKS</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors ${
            activeTab === 'cash' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Kas</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg text-slate-500 hover:text-indigo-600"
        >
          <Menu className="w-4 h-4" />
          <span>Lainnya</span>
        </button>
      </nav>

      {/* Ticket Print Slip Modal */}
      {printTicket && (
        <TicketPrintModal
          ticket={printTicket}
          onClose={() => setPrintTicket(null)}
        />
      )}

      {/* Supabase Status Modal (Khusus Owner) */}
      {isSupabaseModalOpen && currentUser.role === 'OWNER' && (
        <SupabaseConfigModal onClose={() => setIsSupabaseModalOpen(false)} />
      )}
    </div>
  );
}
