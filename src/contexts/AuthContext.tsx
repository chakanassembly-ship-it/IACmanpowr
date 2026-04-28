import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isHr: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (authUser) {
        // Use onSnapshot to detect profile deletion or role updates in real-time
        profileUnsubscribe = onSnapshot(doc(db, 'users', authUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.disabled) {
              setProfile(null);
              return;
            }
            setProfile({ uid: authUser.uid, ...data } as UserProfile);
          } else {
            // Profile missing! 
            // SPECIAL CASE: Auto-create only for the Master Admin email or guest admin
            const isMaster = authUser.email === 'chakanassembly@gmail.com' || (authUser.email || '').includes('admin');
            
            if (isMaster) {
              console.log("Master account detected, ensuring profile exists...");
              const newProfile: UserProfile = {
                uid: authUser.uid,
                email: authUser.email || 'admin@system.local',
                role: 'admin',
                name: (authUser.email || '').split('@')[0].toUpperCase(),
              };
              try {
                await setDoc(doc(db, 'users', authUser.uid), newProfile);
                setProfile(newProfile);
              } catch (e) {
                console.error("Failed to auto-ensure master profile:", e);
                setProfile(newProfile); // Set locally anyway
              }
            } else {
              // Standard user with no profile = No access
              console.warn("User has no profile document. Access denied.");
              setProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listen error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isHr: profile?.role === 'hr' || profile?.role === 'admin',
    isSupervisor: profile?.role === 'supervisor' || profile?.role === 'hr' || profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
