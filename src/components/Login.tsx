import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Factory, Mail, Lock, UserPlus, LogIn, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<{message: string, domain: string} | null>(null);

  React.useEffect(() => {
    const handleConnectionError = (e: any) => {
      setConnectionError(e.detail);
    };
    window.addEventListener('firebase-connection-error', handleConnectionError);
    return () => window.removeEventListener('firebase-connection-error', handleConnectionError);
  }, []);

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      toast.error('Email and Password are required');
      setLoading(false);
      return;
    }

    try {
      // Map Login ID to Email format (e.g., Z101 -> z101@iac.com)
      let firebaseEmail = cleanEmail;
      if (cleanEmail.toLowerCase() === 'admin') {
        firebaseEmail = 'chakanassembly@gmail.com';
      } else if (!cleanEmail.includes('@')) {
        firebaseEmail = `${cleanEmail.toLowerCase()}@iac.com`;
      }

      // Standard Sign-in
      await signInWithEmailAndPassword(auth, firebaseEmail, cleanPassword);
      toast.success('Access Protocol Verified');
      navigate('/');
    } catch (err: any) {
      console.error("Login Error:", err.code, err.message);
      let message = `SYSTEM ERROR: ${err.message}`;

      // Recalculate context inside catch
      const currentFirebaseEmail = cleanEmail.toLowerCase() === 'admin' ? 'chakanassembly@gmail.com' : (!cleanEmail.includes('@') ? `${cleanEmail.toLowerCase()}@iac.com` : cleanEmail);
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        const isAdminEmail = currentFirebaseEmail === 'chakanassembly@gmail.com';
        
        // Treat as potentially missing account for admin
        if (isAdminEmail) {
          const tryEnroll = window.confirm(`Access Failed (${err.code}). If this is the first time or password was lost, would you like to (re)initialize the Admin Account?`);
          if (tryEnroll) {
            const pwd = window.prompt("Set new admin password (min 6 chars):", "admin123");
            if (pwd && pwd.length >= 6) {
              setLoading(true);
              try {
                // Try to create it. If it exists, this will fail, then we know it's a wrong password.
                const userCredential = await createUserWithEmailAndPassword(auth, currentFirebaseEmail, pwd);
                const newProfile = {
                  uid: userCredential.user.uid,
                  email: currentFirebaseEmail,
                  role: 'admin',
                  name: 'SYSTEM ADMIN',
                  assignedLines: []
                };
                await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
                toast.success('Admin Protocol Initialized');
                navigate('/');
                return;
              } catch (regErr: any) {
                if (regErr.code === 'auth/email-already-in-use') {
                   message = 'Admin account already exists. Please use the correct password or contact system support.';
                } else {
                   message = `Provisioning Error: ${regErr.message}`;
                }
              }
            }
          }
        }
        
        message = err.code === 'auth/user-not-found' 
          ? `IDENTITY NOT FOUND: ${cleanEmail} is not enrolled.` 
          : `AUTHENTICATION FAILED: Check ID/Password. (Code: ${err.code})`;
          
        if (err.code === 'auth/invalid-credential') {
          message += "\n\nTip: If credentials are correct, double-check your Authorized Domains in Firebase Console.";
        }
      } else if (err.message.includes('offline') || err.message.includes('unavailable') || err.code === 'unavailable') {
        message = 'CONNECTION BLOCKED: Please add ' + window.location.hostname + ' to Firebase Auth > Authorized Domains and ensure Firestore is created.';
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      toast.success('Bypass Protocol Active: Guest Session');
      navigate('/');
    } catch (err: any) {
      console.error("Guest Error:", err);
      toast.error('Bypass Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 font-sans relative overflow-hidden">
      {/* Troubleshooting Banner */}
      {connectionError && (
        <div className="mb-8 w-full max-w-lg bg-destructive/10 border-2 border-destructive/20 p-6 rounded-3xl z-20 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="bg-destructive text-destructive-foreground p-2 rounded-xl shrink-0">
              <LogIn className="rotate-180" size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-destructive uppercase tracking-tight italic">System Configuration Required</h3>
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                The application cannot reach the server. This usually happens when the current domain is not authorized in Firebase.
              </p>
              <div className="bg-background/50 p-3 rounded-xl border border-destructive/20 font-mono text-[10px] space-y-1">
                <p><span className="text-destructive font-bold">DOMAIN:</span> {connectionError.domain}</p>
                <p>1. Go to Firebase Console &gt; Auth &gt; Settings</p>
                <p>2. Add domain to <span className="font-bold underline italic tracking-tight uppercase">Authorized Domains</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      
      <Card className="w-full max-w-lg border-2 shadow-2xl bg-card rounded-[3rem] overflow-hidden relative z-10 transition-all duration-700 border-border shadow-primary/5">
        <div className="h-3 w-full animate-pulse bg-primary" />
        <CardHeader className="text-center space-y-8 pb-10 pt-16 px-12">
          <div className="mx-auto w-24 h-24 rounded-[2rem] flex items-center justify-center text-primary-foreground shadow-2xl rotate-3 transition-all duration-700 transform hover:rotate-0 bg-primary shadow-primary/30">
            <Factory size={48} />
          </div>
          <div className="space-y-4">
            <CardTitle className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground uppercase italic leading-none">PlantFlow</CardTitle>
            <div className="flex items-center justify-center gap-2 transition-colors duration-700 text-primary">
              <span className="w-8 h-[2px] bg-primary"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">
                Secure Access Terminal
              </span>
              <span className="w-8 h-[2px] bg-primary"></span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-10 px-12 pb-16">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] italic text-muted-foreground ml-1">Identity Vector (Login ID)</Label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={20} />
                <Input 
                  id="email"
                  type="text"
                  placeholder="e.g. Z101"
                  className="pl-14 h-16 rounded-2xl bg-muted/30 border-2 border-border focus:ring-primary focus:border-primary font-bold text-lg transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] italic text-muted-foreground ml-1">Access Protocol (Password)</Label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={20} />
                <Input 
                  id="password"
                  type="password"
                  placeholder="Enter Password"
                  className="pl-14 h-16 rounded-2xl bg-muted/30 border-2 border-border focus:ring-primary focus:border-primary font-bold text-lg transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full h-20 text-2xl font-black uppercase italic tracking-tighter text-primary-foreground transition-all rounded-[1.5rem] shadow-2xl mt-6 active:scale-95 disabled:opacity-50 bg-primary hover:bg-primary/90 shadow-primary/30"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
              ) : (
                <div className="flex items-center gap-3">
                  <LogIn size={28} />
                  <span>Initialize System</span>
                </div>
              )}
            </Button>
          </form>

          <div className="flex flex-col items-center gap-6 pt-4">
            <button 
              onClick={handleGuestLogin}
              className="text-[10px] font-black uppercase tracking-[0.2em] italic text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <Globe size={12} />
              Bypass Security (Guest Access)
            </button>
            <div className="flex flex-col items-center gap-2 opacity-30 group cursor-default text-center">
              <div className="flex items-center gap-1.5 ">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-mono tracking-widest uppercase">PlantFlow Core v3.1</p>
              </div>
              <p className="text-[8px] font-mono uppercase tracking-tighter max-w-[200px]">AUTHORIZED PERSONNEL ONLY. CONTACT SYSTEM ADMINISTRATOR FOR NEW ACCOUNT ENROLLMENT.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Developer Footer */}
      <div className="mt-12 text-center text-muted-foreground/50 z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-mono tracking-widest uppercase">
            Design | Develop | Deployed by <span className="font-bold text-foreground/80">Rushikesh Kadam</span>
          </p>
          <div className="h-[1px] w-12 bg-border" />
          <p className="text-[9px] font-mono lowercase tracking-tighter opacity-80 hover:opacity-100 transition-opacity">
            rushikesh.kadam@lumaxiac.com
          </p>
        </div>
      </div>
    </div>
  );
}
