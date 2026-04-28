// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// -------------------------------
// 🔥 Firebase Config (INLINE FIX)
// -------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyByRBbpKyosatnOMyH-gfMFxS6cdNzouNc",
  authDomain: "iacmanpowermonitoring77.firebaseapp.com",
  projectId: "iacmanpowermonitoring77",
  storageBucket: "iacmanpowermonitoring77.firebasestorage.app",
  messagingSenderId: "671304202969",
  appId: "1:671304202969:web:c8ef1e7bbeb7716a6c1cc8",

  // 👇 optional custom database
  firestoreDatabaseId: "ai-studio-e708ba66-32e2-4e7e-b1d3-192f656f2acd"
};

// -------------------------------
// 🔥 Initialize Firebase
// -------------------------------
export const app = initializeApp(firebaseConfig);

// -------------------------------
// 🔐 Authentication
// -------------------------------
export const auth = getAuth(app);

// -------------------------------
// 🗄️ Firestore (SAFE INIT)
// -------------------------------

// 👉 Custom DB ID (safe check)
const databaseId =
  typeof firebaseConfig.firestoreDatabaseId === 'string' &&
  firebaseConfig.firestoreDatabaseId.trim() !== ''
    ? firebaseConfig.firestoreDatabaseId
    : '(default)';

// 🔥 Debug log
console.log('🔥 Using Firestore DB:', databaseId);

// 🔥 Initialize Firestore
export const db =
  databaseId === '(default)'
    ? getFirestore(app)
    : getFirestore(app, databaseId);

// -------------------------------
// 🔁 Retry Connection
// -------------------------------
export const retryFirestore = () => {
  console.warn('🔁 Retrying Firestore connection...');
  window.location.reload();
};

// -------------------------------
// 🔥 Operation Types
// -------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// -------------------------------
// 🔥 Error Info Interface
// -------------------------------
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
  };
}

// -------------------------------
// 🚨 Error Handler
// -------------------------------
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
  };

  console.error('🔥 Firestore Error:', errInfo);

  // 🔍 Debug helpers
  if (errInfo.error.includes('not found')) {
    console.error('❌ Database not found → check firestoreDatabaseId');
  }

  if (errInfo.error.includes('permission')) {
    console.error('🔒 Permission issue → check Firestore rules');
  }

  throw error;
}