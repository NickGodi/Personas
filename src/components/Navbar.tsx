import React, { useEffect, useRef, useState } from 'react';
import { User, NotificationItem, TestRole } from '../types';
import { displayLogin } from '../utils/userIdentity';
import mascotAvatar from '../assets/images/personas_duck_mascot_1793729518059.jpg';
import { 
  Bell, 
  Check,
  CheckCheck,
  ChevronDown,
  Crown, 
  LogIn, 
  LogOut,
  Moon, 
  Sun, 
  ShieldCheck, 
  UserCheck,
  Trash2,
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  creatorUser: User;
  isImpersonating: boolean;
  onStopImpersonating: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenLoginModal: () => void;
  onOpenProfileModal: () => void;
  onLogout: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteAllNotifications: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onTestRole: (role: TestRole) => void;
  isCaptainPreview?: boolean;
  canTestRoles: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  creatorUser,
  isImpersonating,
  onStopImpersonating,
  activeTab,
  setActiveTab,
  onOpenLoginModal,
  onOpenProfileModal,
  onLogout,
  notifications,
  onMarkNotificationRead,
  onDeleteNotification,
  onMarkAllNotificationsRead,
  onDeleteAllNotifications,
  theme,
  onToggleTheme,
  onTestRole,
  canTestRoles,
  isCaptainPreview = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleTester, setShowRoleTester] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const roleTesterRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = notifications.filter((n) => !n.read);
  useEffect(() => {
    if (!showNotifications) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        onMarkAllNotificationsRead();
        setShowNotifications(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMarkAllNotificationsRead();
        setShowNotifications(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showNotifications, onMarkAllNotificationsRead]);
  useEffect(() => {
    if (!showRoleTester) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!roleTesterRef.current?.contains(event.target as Node)) setShowRoleTester(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowRoleTester(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showRoleTester]);
  useEffect(() => {
    if (!showAccountMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setShowAccountMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAccountMenu(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showAccountMenu]);
  const navLinks = [
    { id: 'cards', label: 'Jogadores' },
    { id: 'voting', label: 'Média' },
    { id: 'roulette', label: 'Cartas' },
    { id: 'teams', label: 'Times' },
    { id: 'statistics', label: 'Estatísticas' },
    { id: 'rules', label: 'Regras' },
  ];

  const canOpenCreatorPanel = currentUser?.id === creatorUser.id && !isImpersonating;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#0B0E14]/90 border-b border-red-950/60 dark:bg-[#0B0E14]/90 dark:border-red-950/60 light:bg-white/95 light:border-slate-200">
      {/* Impersonation Notice Bar */}
      {isImpersonating && currentUser && (
        <div className="bg-amber-500 text-black px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>
              Você está mexendo na conta de <strong>{currentUser.name} ({displayLogin(currentUser.handle)})</strong> com permissões de Criador.
            </span>
          </div>
          <button
            onClick={onStopImpersonating}
            className="px-2.5 py-0.5 rounded bg-black text-amber-300 hover:text-white font-mono text-[11px] transition-colors"
          >
            Voltar para o Criador ({displayLogin(creatorUser.handle)})
          </button>
        </div>
      )}

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 md:gap-8 h-16">
        {/* Zone 1: Brand Zone */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('cards');
          }}
          className="flex items-center gap-2.5 text-xl font-display font-black tracking-tight text-white dark:text-white light:text-slate-900 whitespace-nowrap shrink-0 group"
        >
          {/* Mascot in brand mark */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-amber-400 group-hover:scale-110 transition-transform">
            <img
              src={mascotAvatar}
              alt="Personas Duckling"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-400 bg-clip-text text-transparent">
            PERSONAS
          </span>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs font-bold tracking-wide uppercase">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  isActive
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          {canOpenCreatorPanel && (
            <button
              type="button"
              onClick={() => setActiveTab('creator')}
              aria-current={activeTab === 'creator' ? 'page' : undefined}
              className={`whitespace-nowrap shrink-0 flex items-center gap-1 py-1 font-bold ${
                activeTab === 'creator'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              Painel Criador
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quick Role Tester Toggle */}
          {canTestRoles && <div className="relative" ref={roleTesterRef}>
            <button
              type="button"
              onClick={() => setShowRoleTester(!showRoleTester)}
              aria-expanded={showRoleTester}
              aria-label={`Testar outro cargo. Cargo atual: ${isCaptainPreview ? 'capitão' : currentUser?.role || 'Visitante'}`}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
              title="Testar como outros cargos"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Cargo: {isCaptainPreview ? 'capitão' : currentUser?.role || 'Visitante'}</span>
            </button>

            {showRoleTester && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl p-2 z-50 text-xs">
                <span className="text-[10px] font-mono text-slate-400 block px-2 py-1 uppercase font-bold border-b border-slate-800 mb-1">
                  Simular Cargo:
                </span>
                {(['criador', 'capitão', 'jogador', 'visitante'] as TestRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onTestRole(r);
                      setShowRoleTester(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                      (r === 'capitão' ? isCaptainPreview : !isCaptainPreview && currentUser?.role === r)
                        ? 'bg-red-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>}

          {/* Theme Switch */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={`Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                onMarkAllNotificationsRead();
                setShowNotifications((open) => !open);
              }}
              aria-label={`Notificações${unreadNotifications.length ? `, ${unreadNotifications.length} não lidas` : ''}`}
              aria-expanded={showNotifications}
              className="relative p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Notificações do Sistema"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white font-mono font-bold text-[9px] flex items-center justify-center animate-pulse">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-3 z-50 text-xs">
                <div className="pb-2 border-b border-slate-800">
                  <div className="font-bold text-white">Notificações ({notifications.length})</div>
                  {notifications.length > 0 && (
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      {unreadNotifications.length > 0 ? (
                        <button
                          type="button"
                          onClick={onMarkAllNotificationsRead}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-amber-300 hover:bg-slate-800"
                        >
                          <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
                        </button>
                      ) : <span className="text-[10px] text-slate-500">Todas lidas</span>}
                      <button
                        type="button"
                        onClick={onDeleteAllNotifications}
                        aria-label="Excluir todas as notificações"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-red-300 hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir todas
                      </button>
                    </div>
                  )}
                </div>

                <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Sem notificações no momento.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2 rounded-xl border transition-colors ${
                          n.read
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                            : 'bg-red-950/40 border-red-800/60 text-white'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between gap-2 text-[11px]">
                          <span>{n.title}</span>
                          <span className="shrink-0 text-[9px] font-mono text-slate-500">{n.createdAt}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">{n.message}</p>
                        <div className="mt-2 flex items-center justify-end gap-1 border-t border-white/5 pt-1.5">
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => onMarkNotificationRead(n.id)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-950/50"
                            >
                              <Check className="h-3 w-3" /> Marcar como lida
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteNotification(n.id)}
                            aria-label={`Excluir notificação: ${n.title}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-red-300 hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile or Login */}
          {currentUser ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setShowAccountMenu((open) => !open)}
                aria-label={`Menu da conta de ${currentUser.name}`}
                aria-haspopup="menu"
                aria-expanded={showAccountMenu}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold transition-all"
              >
                <img
                  src={currentUser.avatar}
                  alt=""
                  className="w-7 h-7 rounded-lg object-cover border border-red-500/60"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold leading-none">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{displayLogin(currentUser.handle)}</div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
              </button>
              {showAccountMenu && (
                <div
                  role="menu"
                  aria-label="Opções da conta"
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl shadow-black/50 z-50"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onOpenProfileModal();
                    }}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Meu perfil
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-300 hover:bg-red-950/60 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-950 transition-all whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
      <nav aria-label="Navegação principal" className="mobile-nav lg:hidden">
        {navLinks.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveTab(link.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`mobile-nav__item ${isActive ? 'is-active' : ''}`}
            >
              {link.label}
            </button>
          );
        })}
        {canOpenCreatorPanel && (
          <button
            type="button"
            onClick={() => setActiveTab('creator')}
            aria-current={activeTab === 'creator' ? 'page' : undefined}
            className={`mobile-nav__item ${activeTab === 'creator' ? 'is-active' : ''}`}
          >
            <Crown className="h-3.5 w-3.5" /> Painel Criador
          </button>
        )}
      </nav>
    </header>
  );
};
