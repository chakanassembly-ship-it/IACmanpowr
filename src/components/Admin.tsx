import React, { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Department, Line, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Trash2, Plus, Shield, Building2, LayoutGrid, Users, 
  Settings, Target, Briefcase, UserCog, Database, 
  Layers, TrendingUp, AlertCircle, CheckCircle2, 
  XCircle, Edit2, Save, RefreshCw, ArrowUpRight,
  Globe, Server, Cpu, Activity, BarChart3, PieChart,
  History, Clock, AlertTriangle, ShieldCheck, Mail, Key,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { subMonths, format } from 'date-fns';

export default function Admin() {
  const { user: currentUser } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState('structure');

  // Form States
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptHasLines, setNewDeptHasLines] = useState(true);
  const [newLineName, setNewLineName] = useState('');
  const [newLineDescription, setNewLineDescription] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [reqA, setReqA] = useState('0');
  const [reqG, setReqG] = useState('0');
  const [reqB, setReqB] = useState('0');
  const [reqC, setReqC] = useState('0');

  // Department Update State
  const [updateDeptId, setUpdateDeptId] = useState('');
  const [updateDeptDescription, setUpdateDeptDescription] = useState('');
  const [updateDeptHasLines, setUpdateDeptHasLines] = useState(true);
  const [updateDeptReqA, setUpdateDeptReqA] = useState('0');
  const [updateDeptReqG, setUpdateDeptReqG] = useState('0');
  const [updateDeptReqB, setUpdateDeptReqB] = useState('0');
  const [updateDeptReqC, setUpdateDeptReqC] = useState('0');

  const [updateLineId, setUpdateLineId] = useState('');
  const [updateLineDescription, setUpdateLineDescription] = useState('');
  const [updateReqA, setUpdateReqA] = useState('0');
  const [updateReqG, setUpdateReqG] = useState('0');
  const [updateReqB, setUpdateReqB] = useState('0');
  const [updateReqC, setUpdateReqC] = useState('0');
  const [isCleaning, setIsCleaning] = useState(false);
  const [lastCleanupInfo, setLastCleanupInfo] = useState<{count: number, date: string} | null>(null);

  // Email Setting States
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');
  const [emailReceiver, setEmailReceiver] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // New User Form States
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('supervisor');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    const deptsUnsubscribe = onSnapshot(collection(db, 'departments'), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'departments');
    });

    const linesUnsubscribe = onSnapshot(collection(db, 'lines'), (snapshot) => {
      setLines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Line)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'lines');
    });

    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const emailUnsubscribe = onSnapshot(doc(db, 'settings', 'email'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setEmailServiceId(data.serviceId || '');
        setEmailTemplateId(data.templateId || '');
        setEmailPublicKey(data.publicKey || '');
        setEmailReceiver(data.receiverEmail || '');
      } else {
        // Fallback to env if nothing in DB
        setEmailServiceId(import.meta.env.VITE_EMAILJS_SERVICE_ID || '');
        setEmailTemplateId(import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '');
        setEmailPublicKey(import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '');
        setEmailReceiver(import.meta.env.VITE_REPORT_RECEIVER_EMAIL || 'chakanassembly@gmail.com');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/email');
    });
    return () => {
      deptsUnsubscribe();
      linesUnsubscribe();
      usersUnsubscribe();
      emailUnsubscribe();
    };
  }, []);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    try {
      await updateDoc(doc(db, 'settings', 'email'), {
        serviceId: emailServiceId,
        templateId: emailTemplateId,
        publicKey: emailPublicKey,
        receiverEmail: emailReceiver,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email
      }).catch(async (err) => {
        // If doc doesn't exist, try to create it
        if (err.code === 'not-found') {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'settings', 'email'), {
            serviceId: emailServiceId,
            templateId: emailTemplateId,
            publicKey: emailPublicKey,
            receiverEmail: emailReceiver,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.email
          });
        } else {
          throw err;
        }
      });
      toast.success('Email settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save email settings');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;
    try {
      await addDoc(collection(db, 'departments'), { 
        name: newDeptName,
        hasLines: newDeptHasLines
      });
      setNewDeptName('');
      setNewDeptHasLines(true);
      toast.success('Department added successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'departments');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName || !selectedDeptId) return;
    try {
      await addDoc(collection(db, 'lines'), { 
        name: newLineName, 
        description: newLineDescription,
        departmentId: selectedDeptId,
        requirements: {
          A: parseInt(reqA) || 0,
          G: parseInt(reqG) || 0,
          B: parseInt(reqB) || 0,
          C: parseInt(reqC) || 0
        }
      });
      setNewLineName('');
      setNewLineDescription('');
      setReqA('0');
      setReqG('0');
      setReqB('0');
      setReqC('0');
      toast.success('Production line added');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'lines');
    }
  };

  const handleUpdateRole = async (uid: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      toast.success(`User role updated to ${role.toUpperCase()}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleRemoveLine = async (uid: string, lineId: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;
    
    const updatedLines = (user.assignedLines || []).filter(id => id !== lineId);
    try {
      await updateDoc(doc(db, 'users', uid), { assignedLines: updatedLines });
      toast.success('Line assignment removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleRemoveDept = async (uid: string, deptId: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;
    
    const updatedDepts = (user.assignedDepts || []).filter(id => id !== deptId);
    try {
      await updateDoc(doc(db, 'users', uid), { assignedDepts: updatedDepts });
      toast.success('Department assignment removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleUpdateLineReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateLineId) return;
    try {
      await updateDoc(doc(db, 'lines', updateLineId), {
        description: updateLineDescription,
        requirements: {
          A: parseInt(updateReqA) || 0,
          G: parseInt(updateReqG) || 0,
          B: parseInt(updateReqB) || 0,
          C: parseInt(updateReqC) || 0
        }
      });
      toast.success('Line requirements updated');
      setUpdateLineId('');
      setUpdateLineDescription('');
      setUpdateReqA('0');
      setUpdateReqG('0');
      setUpdateReqB('0');
      setUpdateReqC('0');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'lines');
    }
  };

  const onSelectLineToEdit = (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (line) {
      setUpdateLineId(lineId);
      setUpdateLineDescription(line.description || '');
      setUpdateReqA(String(line.requirements?.A || 0));
      setUpdateReqG(String(line.requirements?.G || 0));
      setUpdateReqB(String(line.requirements?.B || 0));
      setUpdateReqC(String(line.requirements?.C || 0));
    }
  };

  const onSelectDeptToEdit = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (dept) {
      setUpdateDeptId(deptId);
      setUpdateDeptDescription(dept.description || '');
      setUpdateDeptHasLines(dept.hasLines !== false); // Default to true if undefined
      setUpdateDeptReqA(String(dept.targets?.A || 0));
      setUpdateDeptReqG(String(dept.targets?.G || 0));
      setUpdateDeptReqB(String(dept.targets?.B || 0));
      setUpdateDeptReqC(String(dept.targets?.C || 0));
    }
  };

  const handleUpdateDeptReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateDeptId) return;
    try {
      await updateDoc(doc(db, 'departments', updateDeptId), {
        name: departments.find(d => d.id === updateDeptId)?.name || '', // Explicitly include name to ensure pass rules
        description: updateDeptDescription,
        hasLines: updateDeptHasLines,
        targets: {
          A: parseInt(updateDeptReqA) || 0,
          G: parseInt(updateDeptReqG) || 0,
          B: parseInt(updateDeptReqB) || 0,
          C: parseInt(updateDeptReqC) || 0
        }
      });
      toast.success(`Division "${departments.find(d => d.id === updateDeptId)?.name}" configuration saved`);
      console.log(`[Admin] Successfully updated department ${updateDeptId}. Mode: ${updateDeptHasLines ? 'STRUCTURED' : 'FLAT'}`);
      // Refresh local state if necessary or just keep the current form context
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'departments');
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    console.log(`[Admin] Attempting to delete from ${coll} with ID: ${id}`);
    
    // Simple confirmation if not already handled by a wrapping function
    if (!window.confirm(`Are you sure you want to permanently delete this ${coll.slice(0, -1)}?`)) {
      console.log(`[Admin] Deletion of ${id} cancelled`);
      return;
    }

    const loadingToast = toast.loading(`Deleting ${coll.slice(0, -1)}...`);
    try {
      await deleteDoc(doc(db, coll, id));
      toast.success('Deleted successfully', { id: loadingToast });
      console.log(`[Admin] Successfully deleted ${id} from ${coll}`);
    } catch (err) {
      console.error(`[Admin] Failed to delete ${id} from ${coll}:`, err);
      toast.error('Deletion failed', { id: loadingToast });
      handleFirestoreError(err, OperationType.DELETE, coll);
    }
  };

  const handlePurgeOldData = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete all manpower records older than 6 months? This action cannot be undone.');
    if (!confirmDelete) return;

    setIsCleaning(true);
    try {
      const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
      const q = query(collection(db, 'records'), where('date', '<', sixMonthsAgo));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.info('No records older than 6 months found.');
        return;
      }

      // Process in batches if necessary, but for now simple batch
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      setLastCleanupInfo({ count: snapshot.size, date: new Date().toISOString() });
      toast.success(`Successfully purged ${snapshot.size} legacy records.`);
    } catch (err) {
      console.error(err);
      toast.error('Data purge failed. See console for details.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('All fields are required for new user enrollment');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsCreatingUser(true);
    try {
      // Map Login ID to Email format if it's just a code (e.g., Z101 -> z101@iac.com)
      let firebaseEmail = newUserEmail.trim();
      if (!firebaseEmail.includes('@')) {
        firebaseEmail = `${firebaseEmail.toLowerCase()}@iac.com`;
      }

      // We use a secondary app instance to create the user without logging out the current admin
      const secondaryAppName = `SecondaryApp_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, firebaseEmail, newUserPassword);
      
      const newProfile = {
        uid: userCredential.user.uid,
        email: firebaseEmail,
        role: newUserRole,
        name: newUserName.trim().toUpperCase(),
        assignedLines: []
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      
      // Sign out from the secondary auth instance and delete the app
      await signOut(secondaryAuth);
      // Ensure cleanup
      const { deleteApp } = await import('firebase/app');
      await deleteApp(secondaryApp);

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('supervisor');
      
      toast.success(`Access Protocol Initialized: ${newUserName.toUpperCase()} enrolled successfully.`);
    } catch (err: any) {
      console.error(err);
      let message = err.message;
      if (err.code === 'auth/email-already-in-use') {
        message = 'This ID/Email is already registered in the system.';
      }
      toast.error(`Enrollment Failed: ${message}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);

  const handleDeleteUser = async (uid: string, name: string = 'Unknown User') => {
    console.log(`[Admin] Step 1: Initiating delete for user: ${uid} (${name})`);
    
    if (!uid) {
      console.error('[Admin] Error: No UID provided for deletion');
      toast.error('Cannot delete user: Missing ID');
      return;
    }

    if (uid === currentUser?.uid) {
      console.warn('[Admin] Self-deletion attempt blocked');
      toast.error('Self-deletion blocked. You cannot delete your own account.');
      return;
    }

    const confirmDelete = window.confirm(`CRITICAL: Purge ${name} from system? This cannot be reversed.`);
    if (!confirmDelete) return;

    setIsDeletingUser(uid);
    
    const deletePromise = deleteDoc(doc(db, 'users', uid));

    toast.promise(deletePromise, {
      loading: `Deleting ${name}...`,
      success: () => {
        console.log(`[Admin] Successfully purged: ${uid}`);
        return `${name} has been removed.`;
      },
      error: (err) => {
        console.error(`[Admin] Delete failed for ${uid}:`, err);
        return `Failed to delete ${name}.`;
      }
    });

    try {
      await deletePromise;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    } finally {
      setIsDeletingUser(null);
    }
  };

  // Calculate statistics
  const totalLines = lines.length;
  const totalDepartments = departments.length;
  const totalUsers = users.length;
  const supervisors = users.filter(u => u.role === 'supervisor').length;
  const admins = users.filter(u => u.role === 'admin').length;

  const roleColors = {
    admin: 'from-purple-500 to-purple-700',
    hr: 'from-blue-500 to-indigo-600',
    supervisor: 'from-emerald-500 to-teal-600',
  };

  const shiftColors = {
    A: 'bg-blue-500',
    G: 'bg-purple-500',
    B: 'bg-emerald-500',
    C: 'bg-amber-500',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-12 space-y-6 md:space-y-8">
        
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full"></div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Command Center</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
              Administration
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl">
              Global system configuration, structural definitions, and security orchestration
            </p>
          </div>
          
          {/* Stats Cards */}
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                  <Building2 size={18} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalDepartments}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Departments</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                  <LayoutGrid size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalLines}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Production Lines</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl px-5 py-3 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <Users size={18} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalUsers}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Active Users</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-4">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('structure')}
                className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'structure'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Database size={16} />
                Infrastructure
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Shield size={16} />
                Security
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'maintenance'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <RefreshCw size={16} />
                Maintenance
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold rounded-t-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Key size={16} />
                System Settings
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Structure Tab */}
            {activeTab === 'structure' && (
              <div className="space-y-8">
                {/* Department Requirements Configuration Card */}
                <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                        <TrendingUp size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Department Operational Targets</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Set total manpower goals for each department</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleUpdateDeptReq} className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Select Department</Label>
                          <Select value={updateDeptId} onValueChange={onSelectDeptToEdit}>
                            <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
                              <SelectValue placeholder="Choose department" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700">
                              {departments.map(dept => (
                                <SelectItem key={dept.id} value={dept.id} className="py-2">
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="lg:col-span-8">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Shift Targets (Manpower)</Label>
                          <div className="grid grid-cols-4 gap-3">
                            {['A', 'G', 'B', 'C'].map((shift) => (
                              <div key={shift} className="space-y-1">
                                <div className={`${shiftColors[shift as keyof typeof shiftColors]} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto`}>
                                  {shift}
                                </div>
                                <Input 
                                  type="number" 
                                  value={shift === 'A' ? updateDeptReqA : shift === 'G' ? updateDeptReqG : shift === 'B' ? updateDeptReqB : updateDeptReqC} 
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (shift === 'A') setUpdateDeptReqA(v);
                                    else if (shift === 'G') setUpdateDeptReqG(v);
                                    else if (shift === 'B') setUpdateDeptReqB(v);
                                    else setUpdateDeptReqC(v);
                                  }} 
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Department Description</Label>
                          <Input 
                            placeholder="Enter department role or notes..." 
                            value={updateDeptDescription} 
                            onChange={(e) => setUpdateDeptDescription(e.target.value)}
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            disabled={!updateDeptId}
                          />
                        </div>
                        <div className="lg:col-span-4 flex items-center justify-between mt-auto">
                          <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Architecture Mode</Label>
                            <Button 
                              type="button" 
                              onClick={() => {
                                setUpdateDeptHasLines(!updateDeptHasLines);
                                toast.info(`Mode set to: ${!updateDeptHasLines ? 'ENABLED (HAS SUB-LINES)' : 'DISABLED (DIRECT ENTRY)'}. Click Update to commit changes.`);
                              }}
                              className={`h-11 px-6 rounded-xl font-black text-xs transition-all border-2 ${
                                updateDeptHasLines 
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 border-blue-400' 
                                : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-amber-400'
                              }`}
                              disabled={!updateDeptId}
                            >
                              {updateDeptHasLines ? 'STRUCTURED (SUB-LINES)' : 'FLAT (DIRECT REPORT)'}
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              type="button"
                              variant="outline"
                              onClick={() => setUpdateDeptId('')}
                              className="h-11 px-4 rounded-xl font-bold"
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              className="h-11 px-8 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white font-bold shadow-xl shadow-slate-200"
                              disabled={!updateDeptId}
                            >
                              <Save size={16} className="mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Requirements Configuration Card */}
                <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                        <Target size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Line-wise Operational Targets</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Recalibrate shift-wise manpower requirements</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleUpdateLineReq} className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Select Production Line</Label>
                          <Select value={updateLineId} onValueChange={onSelectLineToEdit}>
                            <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
                              <SelectValue placeholder="Choose line">
                                {updateLineId ? (lines.find(l => l.id === updateLineId)?.name) : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700">
                              {lines.map(line => {
                                const dept = departments.find(d => d.id === line.departmentId);
                                return (
                                  <SelectItem key={line.id} value={line.id} textValue={line.name} className="py-2">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{line.name}</span>
                                      <span className="text-xs text-slate-400">{dept?.name}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="lg:col-span-8">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Shift Requirements</Label>
                          <div className="grid grid-cols-4 gap-3">
                            {['A', 'G', 'B', 'C'].map((shift) => (
                              <div key={shift} className="space-y-1">
                                <div className={`${shiftColors[shift as keyof typeof shiftColors]} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto`}>
                                  {shift}
                                </div>
                                <Input 
                                  type="number" 
                                  value={shift === 'A' ? updateReqA : shift === 'G' ? updateReqG : shift === 'B' ? updateReqB : updateReqC} 
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (shift === 'A') setUpdateReqA(v);
                                    else if (shift === 'G') setUpdateReqG(v);
                                    else if (shift === 'B') setUpdateReqB(v);
                                    else setUpdateReqC(v);
                                  }} 
                                  className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">Line Description</Label>
                          <Input 
                            placeholder="Enter line purpose or operational context..." 
                            value={updateLineDescription} 
                            onChange={(e) => setUpdateLineDescription(e.target.value)}
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            disabled={!updateLineId}
                          />
                        </div>
                        <div className="lg:col-span-4 flex items-end">
                          <Button 
                            type="submit" 
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-purple-500/30"
                            disabled={!updateLineId}
                          >
                            <Save size={16} className="mr-2" />
                            Update Configuration
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Departments and Lines Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Departments Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                            <Building2 size={18} className="text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Divisions</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">High-level department definitions</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {departments.length} total
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4 mb-6">
                        <div className="flex gap-3">
                          <Input 
                            placeholder="New department name" 
                            value={newDeptName} 
                            onChange={(e) => setNewDeptName(e.target.value)}
                            className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                          />
                          <Button type="button" onClick={handleAddDept} className="h-11 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 shrink-0">
                            <Plus size={18} />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subdivision Architecture</span>
                          <Button 
                            type="button" 
                            onClick={() => setNewDeptHasLines(!newDeptHasLines)}
                            className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                              newDeptHasLines 
                              ? 'bg-blue-500 text-white shadow-md' 
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {newDeptHasLines ? 'Supports Sub-Lines' : 'Direct Reporting Only'}
                          </Button>
                        </div>
                      </div>

                          <div className="space-y-2">
                            {departments.map((dept) => (
                              <div 
                                key={dept.id} 
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group cursor-pointer ${
                                  updateDeptId === dept.id 
                                  ? 'bg-blue-50 border-2 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                                  : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                onClick={() => onSelectDeptToEdit(dept.id)}
                              >
                                <div className="flex flex-col items-start translate-x-0 group-hover:translate-x-1 transition-transform">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${updateDeptId === dept.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                      {dept.name}
                                    </span>
                                    {dept.hasLines !== false && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-blue-100/50 dark:bg-blue-900/30 text-[10px] font-black text-blue-600 dark:text-blue-400">
                                        {lines.filter(l => l.departmentId === dept.id).length}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">
                                    {dept.hasLines !== false ? 'Structured (Sub-Lines)' : 'Flat (Direct Reporting)'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {updateDeptId === dept.id && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                  )}
                                  <Button 
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('departments', dept.id);
                                    }}
                                    className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        {departments.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            No departments created yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lines Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                            <LayoutGrid size={18} className="text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Production Assets</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Line mapping and shift quotas</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {lines.length} assets
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <form onSubmit={handleAddLine} className="space-y-4 mb-6">
                        <div className="grid grid-cols-2 gap-3">
                          <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                            <SelectTrigger className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                              <SelectValue placeholder="Department">
                                {selectedDeptId ? (departments.find(d => d.id === selectedDeptId)?.name) : undefined}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {departments.filter(d => d.hasLines !== false).map(dept => (
                                <SelectItem key={dept.id} value={dept.id} textValue={dept.name}>{dept.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input 
                            placeholder="Line name" 
                            value={newLineName} 
                            onChange={(e) => setNewLineName(e.target.value)}
                            className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                        <Input 
                          placeholder="Description (optional)" 
                          value={newLineDescription} 
                          onChange={(e) => setNewLineDescription(e.target.value)}
                          className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                        <div className="grid grid-cols-4 gap-2">
                          {['A', 'G', 'B', 'C'].map((shift) => (
                            <div key={shift} className="text-center">
                              <div className={`${shiftColors[shift as keyof typeof shiftColors]} w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs mx-auto mb-1`}>
                                {shift}
                              </div>
                              <Input 
                                type="number" 
                                placeholder="0"
                                value={shift === 'A' ? reqA : shift === 'G' ? reqG : shift === 'B' ? reqB : reqC} 
                                onChange={e => {
                                  const v = e.target.value;
                                  if (shift === 'A') setReqA(v);
                                  else if (shift === 'G') setReqG(v);
                                  else if (shift === 'B') setReqB(v);
                                  else setReqC(v);
                                }} 
                                className="h-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-center text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold" disabled={!selectedDeptId}>
                          <Plus size={16} className="mr-2" />
                          Add Production Line
                        </Button>
                      </form>

                      <div className="space-y-3">
                        {lines
                          .filter(line => {
                            const dept = departments.find(d => d.id === line.departmentId);
                            return dept?.hasLines !== false;
                          })
                          .map((line) => {
                            const dept = departments.find(d => d.id === line.departmentId);
                            return (
                              <div 
                                key={line.id} 
                                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                              >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{line.name}</h4>
                                  <p className="text-xs text-slate-400">{dept?.name}</p>
                                  {line.description && (
                                    <p className="text-xs text-slate-500 mt-1">{line.description}</p>
                                  )}
                                </div>
                                <button 
                                  onClick={() => handleDelete('lines', line.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="flex gap-3 mt-2">
                                {['A', 'G', 'B', 'C'].map((s) => (
                                  <div key={s} className="flex items-center gap-1">
                                    <span className={`${shiftColors[s as keyof typeof shiftColors]} w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[10px]`}>
                                      {s}
                                    </span>
                                    <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                                      {line.requirements?.[s as keyof typeof line.requirements] || 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {lines.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            No production lines added yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance Tab */}
            {activeTab === 'maintenance' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Retention Policy Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                          <History size={18} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data Retention Policy</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">System automatic cleanup configuration</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">6-Month Limit Active</h4>
                          <p className="text-xs text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
                            Manpower records older than 180 days are considered legacy data. To maintain system performance and storage efficiency, these records should be periodically purged.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Threshold Date</span>
                          </div>
                          <span className="text-sm font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {format(subMonths(new Date(), 6), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Database size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Optimized</span>
                          </div>
                        </div>
                      </div>

                      {lastCleanupInfo && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Last Run Summary</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Records Cleared:</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{lastCleanupInfo.count}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Timestamp:</span>
                            <span className="text-xs font-mono text-slate-500">{format(new Date(lastCleanupInfo.date), 'yyyy-MM-dd HH:mm')}</span>
                          </div>
                        </div>
                      )}

                      <Button 
                        onClick={handlePurgeOldData}
                        disabled={isCleaning}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white font-bold shadow-lg shadow-slate-200 dark:shadow-none"
                      >
                        {isCleaning ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing Purge...
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} className="mr-2" />
                            Run Cleanup Protocol
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* System Security Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                          <ShieldCheck size={18} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security Metadata</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Global system environment status</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="space-y-4">
                         <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Server size={18} className="text-blue-500" />
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">Storage Region</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Asia-East1</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 px-2 py-0.5 rounded">Active</span>
                         </div>
                         <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Cpu size={18} className="text-indigo-500" />
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">Rules Version</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Firebase V2 (Hardened)</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded">Secure</span>
                         </div>
                         <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Activity size={18} className="text-emerald-500" />
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">API Connectivity</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Google GenAI Edge</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 px-2 py-0.5 rounded">Stable</span>
                         </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-medium">
                        <Shield className="shrink-0" size={14} />
                        <span>Policy: All deletions are logged and audited automatically.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                        <Mail size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Email Configuration</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure EmailJS for automated reporting</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-8">
                    <form onSubmit={handleSaveEmailSettings} className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Service ID</Label>
                          <Input 
                            value={emailServiceId} 
                            onChange={(e) => setEmailServiceId(e.target.value)}
                            placeholder="e.g. service_abcd123"
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Template ID</Label>
                          <Input 
                            value={emailTemplateId} 
                            onChange={(e) => setEmailTemplateId(e.target.value)}
                            placeholder="e.g. template_xyzw123"
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Public Key</Label>
                          <Input 
                            value={emailPublicKey} 
                            onChange={(e) => setEmailPublicKey(e.target.value)}
                            placeholder="Your EmailJS Public Key"
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Receiver Email</Label>
                          <Input 
                            value={emailReceiver} 
                            onChange={(e) => setEmailReceiver(e.target.value)}
                            placeholder="e.g. hr@example.com"
                            className="h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>

                      <Button 
                        disabled={isSavingEmail}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20"
                      >
                        {isSavingEmail ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={16} className="mr-2" />
                            Save Email Settings
                          </>
                        )}
                      </Button>
                    </form>

                    <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                      <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        Important Requirement
                      </h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-relaxed">
                        For scheduled reports to work from our cloud server, you MUST enable <strong>"Allow API access from non-browser environments"</strong> in your EmailJS dashboard under <strong>Account &gt; Security</strong>.
                      </p>
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase mb-2 flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-blue-500" />
                        Usage Guide
                      </h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
                        <p>1. Sign up at <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-[10px]">emailjs.com</a></p>
                        <p>2. Create a Template using <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{"{{message}}"}</code> as the body.</p>
                        <p>3. Copy the IDs and Public Key here.</p>
                        <p>4. Reports will be sent to the "Receiver Email" above.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* New User Enrollment Form */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                        <UserPlus size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Personnel Enrollment</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Initialize new system-access credentials</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Login ID / Email</Label>
                        <Input 
                          placeholder="e.g. Z101" 
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Password</Label>
                        <Input 
                          type="password"
                          placeholder="Min 6 chars" 
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Full Name</Label>
                        <Input 
                          placeholder="Personnel Name" 
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Role</Label>
                        <Select value={newUserRole} onValueChange={setNewUserRole}>
                          <SelectTrigger className="h-11 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="admin">👑 Admin</SelectItem>
                            <SelectItem value="hr">📊 HR</SelectItem>
                            <SelectItem value="supervisor">👥 Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end lg:col-span-1">
                        <Button 
                          type="submit" 
                          disabled={isCreatingUser}
                          className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/20"
                        >
                          {isCreatingUser ? <RefreshCw className="animate-spin" size={20} /> : 'Enroll User'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                      <UserCog size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Access Control Matrix</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Manage personnel authorization and asset assignments</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => (
                    <div key={u.uid} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* User Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${roleColors[u.role as keyof typeof roleColors] || roleColors.supervisor} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                              {u.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 dark:text-slate-200">{u.name || 'Unnamed User'}</h4>
                              <p className="text-sm text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div className="lg:w-40">
                          <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' :
                            u.role === 'hr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' :
                            u.role === 'supervisor' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {u.role}
                          </div>
                        </div>

                        {/* Assigned Areas (for supervisors) */}
                        {u.role === 'supervisor' && (
                          <div className="flex-1 space-y-4">
                            {/* Lines */}
                            <div>
                              <Label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Assigned Lines</Label>
                              <div className="flex flex-wrap gap-2">
                                {u.assignedLines?.map(lineId => {
                                  const line = lines.find(l => l.id === lineId);
                                  return (
                                    <div key={lineId} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg px-2 py-1 border border-blue-100 dark:border-blue-900/50">
                                      <span className="text-xs font-semibold">{line?.name || 'Unknown'}</span>
                                      <button 
                                        onClick={() => handleRemoveLine(u.uid, lineId)}
                                        className="hover:text-red-500 ml-1 transition-colors"
                                      >
                                        <XCircle size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                                <Select onValueChange={(lineId) => {
                                  const current = u.assignedLines || [];
                                  if (!current.includes(lineId)) {
                                    updateDoc(doc(db, 'users', u.uid), { assignedLines: [...current, lineId] });
                                    toast.success('Line assigned');
                                  }
                                }}>
                                  <SelectTrigger className="h-7 px-2 text-[10px] rounded-lg border-dashed bg-transparent">
                                    <SelectValue placeholder="+ Line" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl shadow-xl">
                                    {lines.map(l => (
                                      <SelectItem key={l.id} value={l.id} textValue={l.name} className="text-sm">{l.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Departments */}
                            <div>
                              <Label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Assigned Departments</Label>
                              <div className="flex flex-wrap gap-2">
                                {u.assignedDepts?.map(deptId => {
                                  const dept = departments.find(d => d.id === deptId);
                                  return (
                                    <div key={deptId} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg px-2 py-1 border border-emerald-100 dark:border-emerald-900/50">
                                      <span className="text-xs font-semibold">{dept?.name || 'Unknown'}</span>
                                      <button 
                                        onClick={() => handleRemoveDept(u.uid, deptId)}
                                        className="hover:text-red-500 ml-1 transition-colors"
                                      >
                                        <XCircle size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                                <Select onValueChange={(deptId) => {
                                  const current = u.assignedDepts || [];
                                  if (!current.includes(deptId)) {
                                    updateDoc(doc(db, 'users', u.uid), { assignedDepts: [...current, deptId] });
                                    toast.success('Department assigned');
                                  }
                                }}>
                                  <SelectTrigger className="h-7 px-2 text-[10px] rounded-lg border-dashed bg-transparent">
                                    <SelectValue placeholder="+ Dept" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl shadow-xl">
                                    {departments.map(d => (
                                      <SelectItem key={d.id} value={d.id} textValue={d.name} className="text-sm">{d.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 relative z-10 shrink-0">
                          <Select value={u.role || 'supervisor'} onValueChange={(val: any) => handleUpdateRole(u.uid, val)}>
                            <SelectTrigger className="h-10 w-32 sm:w-40 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="admin" className="font-medium">👑 Admin</SelectItem>
                              <SelectItem value="hr" className="font-medium">📊 HR</SelectItem>
                              <SelectItem value="supervisor" className="font-medium">👥 Supervisor</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('FINAL ATTEMPT: Delete clicked for:', u.uid, u.name);
                              handleDeleteUser(u.uid, u.name || 'Unknown User');
                            }}
                            disabled={isDeletingUser === u.uid}
                            className="h-10 w-10 min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                            style={{ cursor: 'pointer' }}
                            title="Delete User"
                          >
                            {isDeletingUser === u.uid ? <RefreshCw className="animate-spin text-red-500" size={18} /> : <Trash2 size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      No users found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}