import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import DataEntry from './components/DataEntry';
import Admin from './components/Admin';
import Reports from './components/Reports';
import Login from './components/Login';
import { Toaster } from './components/ui/sonner';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from './components/ui/button';
import { retryFirestore } from './lib/firebase';

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: 'admin' | 'hr' | 'supervisor' }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/20 animate-bounce">
          <div className="w-8 h-8 rounded-lg border-4 border-white border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <p className="font-black text-2xl uppercase italic tracking-tighter">Initializing</p>
          <div className="flex items-center gap-1.5 justify-center opacity-50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-mono tracking-widest uppercase">PlantFlow Core v2.0</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole === 'admin' && profile?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  if (requiredRole === 'hr' && profile?.role !== 'hr' && profile?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  if (requiredRole === 'supervisor' && (profile?.role !== 'supervisor' && profile?.role !== 'hr' && profile?.role !== 'admin')) {
    return <Navigate to="/" />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  const [connError, setConnError] = useState<{ message: string; domain: string } | null>(null);

  useEffect(() => {
    const handleConnError = (e: any) => {
      setConnError(e.detail);
    };
    window.addEventListener('firebase-connection-error', handleConnError as EventListener);
    return () => window.removeEventListener('firebase-connection-error', handleConnError as EventListener);
  }, []);

  return (
    <AuthProvider>
      {connError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="w-full max-w-lg bg-card border-2 border-destructive/50 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="bg-destructive p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full animate-pulse">
                <AlertCircle className="text-white" size={32} />
              </div>
              <h2 className="text-white font-black uppercase italic tracking-tighter text-2xl">Signal Lost</h2>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <p className="text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">
                  {connError.message}
                </p>
                
                <div className="p-4 bg-muted rounded-xl space-y-2 border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Local Signal Context</p>
                  <p className="font-mono text-xs break-all opacity-80">{connError.domain}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
                  className="rounded-xl h-12 border-2 hover:bg-muted font-bold flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  Firebase Console
                </Button>
                <Button 
                  onClick={retryFirestore}
                  className="rounded-xl h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase italic shadow-xl shadow-primary/20 flex items-center gap-2 animate-bounce hover:animate-none"
                >
                  <RefreshCw size={16} />
                  Retry Protocol
                </Button>
              </div>
              
              <button 
                onClick={() => setConnError(null)}
                className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors py-2"
              >
                Dismiss to Offline Cache Mode
              </button>
            </div>
          </div>
        </div>
      )}

      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          
          <Route path="/entry" element={
            <PrivateRoute requiredRole="supervisor">
              <DataEntry />
            </PrivateRoute>
          } />
          
          <Route path="/admin" element={
            <PrivateRoute requiredRole="admin">
              <Admin />
            </PrivateRoute>
          } />
          
          <Route path="/reports" element={
            <PrivateRoute requiredRole="hr">
              <Reports />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
