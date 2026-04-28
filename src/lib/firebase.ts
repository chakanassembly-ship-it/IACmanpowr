// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// -------------------------------
// 🔥 Initialize Firebase
// -------------------------------
const app = initializeApp(firebaseConfig);

// -------------------------------
// 🔐 Authentication
// -------------------------------
export const auth = getAuth(app);

// -------------------------------
// 🗄️ Firestore (SAFE INIT)
// -------------------------------

// 👉 Custom DB ID (if exists)
const databaseId =
  typeof firebaseConfig.firestoreDatabaseId === 'string' &&
  firebaseConfig.firestoreDatabaseId.trim() !== ''
    ? firebaseConfig.firestoreDatabaseId
    : '(default)';

// 🔥 Debug log (helpful)
console.log('🔥 Using Firestore DB:', databaseId);

// 🔥 Initialize Firestore safely
export const db =
  databaseId === '(default)'
    ? getFirestore(app)
    : getFirestore(app, databaseId);

// -------------------------------
// 🔁 Retry Connection (UI FIX)
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

  // 👇 helpful debug
  if (errInfo.error.includes('not found')) {
    console.error('❌ Database not found → check firestoreDatabaseId');
  }

  if (errInfo.error.includes('permission')) {
    console.error('🔒 Permission issue → check Firestore rules');
  }

  throw error;
}