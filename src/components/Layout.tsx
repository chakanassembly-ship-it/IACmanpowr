import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Settings, LogOut, Menu, X, 
  Factory, User, Shield, ChevronRight, Activity, Circle, 
  Sparkles, Zap, BarChart3, Users, Clock, Calendar, Sun, Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isHr, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, show: true, description: 'Analytics & Overview' },
    { name: 'Data Entry', path: '/entry', icon: ClipboardList, show: isSupervisor, description: 'Manpower Recording' },
    { name: 'Reports', path: '/reports', icon: BarChart3, show: isHr, description: 'Data Intelligence' },
    { name: 'Administration', path: '/admin', icon: Settings, show: isAdmin, description: 'System Control' },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'from-purple-500 to-purple-600';
      case 'hr': return 'from-blue-500 to-indigo-600';
      case 'supervisor': return 'from-emerald-500 to-teal-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'hr': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'supervisor': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex">
      
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl relative`}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 z-10 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={12} className={`text-slate-400 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Logo Section */}
        <div className={`p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-30"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Factory size={20} />
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex-1">
                <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  IACMANPOWER
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Live System</p>
                </div>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-all active:scale-90"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
            </button>
          )}
        </div>

        {/* User Profile Section */}
        <div className={`p-5 ${isCollapsed ? 'px-3' : ''} border-b border-slate-100 dark:border-slate-800`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getRoleColor(profile?.role || 'supervisor')} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></div>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                  {profile?.name || 'User'}
                </p>
                <div className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${getRoleBadgeColor(profile?.role || 'supervisor')}`}>
                  {profile?.role || 'supervisor'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1.5">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-blue-500' : 'group-hover:text-blue-400'} />
                {!isCollapsed && (
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    <p className="text-[10px] text-slate-400">{item.description}</p>
                  </div>
                )}
                {isActive && !isCollapsed && (
                  <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className={`p-5 ${isCollapsed ? 'px-3' : ''} border-t border-slate-100 dark:border-slate-800`}>
          <button
            onClick={handleLogout}
            className={`group relative w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Factory size="16" />
            </div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              IACMANPOWER
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              {theme === 'dark' ? <Sun size="20" className="text-amber-400" /> : <Moon size="20" />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              {isMobileMenuOpen ? <X size="20" /> : <Menu size="20" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ type: 'spring', damping: 20 }}
            className="md:hidden fixed inset-0 top-[57px] z-40 bg-white dark:bg-slate-900 shadow-xl"
          >
            <div className="flex flex-col h-full">
              {/* User Profile */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getRoleColor(profile?.role || 'supervisor')} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile?.name || 'User'}
                    </p>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                    <div className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mt-1 ${getRoleBadgeColor(profile?.role || 'supervisor')}`}>
                      {profile?.role || 'supervisor'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 py-4 px-4 space-y-2">
                {navItems.filter(item => item.show).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                      location.pathname === item.path
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <item.icon size={20} />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[10px] opacity-70">{item.description}</div>
                    </div>
                  </Link>
                ))}
              </nav>

              {/* Logout Button */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-medium transition-colors"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-[57px] md:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}