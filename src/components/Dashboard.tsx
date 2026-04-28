import React, { useEffect, useState, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Department, Line, ManpowerRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { format } from 'date-fns';
import { 
  Trash2, AlertCircle, ClipboardCheck, Calendar as CalendarIcon, 
  ClipboardList, Loader2, TrendingUp, Users, Clock, Zap, 
  BarChart3, CheckCircle2, XCircle, UserCheck, Eye, Plus,
  ArrowUpRight, MoreHorizontal, Filter, Download, RefreshCw,
  LayoutDashboard, Activity, Mail, Target
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LineChart, Line as ReLine, AreaChart, Area } from 'recharts';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import emailjs from '@emailjs/browser';

// Helper function to get gradient based on department
const getDepartmentGradient = (deptName: string) => {
  const gradients = {
    'Assembly': 'from-blue-500 to-indigo-600',
    'Quality': 'from-emerald-500 to-teal-600',
    'Logistics': 'from-amber-500 to-orange-600',
    'Maintenance': 'from-purple-500 to-pink-600',
    'Production': 'from-rose-500 to-red-600',
  };
  return gradients[deptName as keyof typeof gradients] || 'from-slate-500 to-gray-600';
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [records, setRecords] = useState<ManpowerRecord[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<ManpowerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [reportMode, setReportMode] = useState<'logs' | 'summary'>('summary');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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

    const recordsQuery = query(collection(db, 'records'), where('date', '==', date), orderBy('timestamp', 'desc'));
    const recordsUnsubscribe = onSnapshot(recordsQuery, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManpowerRecord)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'records');
      setLoading(false);
    });

    // Fetch last 7 days of data for trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const histDateStr = format(sevenDaysAgo, 'yyyy-MM-dd');
    
    const histQuery = query(collection(db, 'records'), where('date', '>=', histDateStr), orderBy('date', 'asc'));
    const histUnsubscribe = onSnapshot(histQuery, (snapshot) => {
      setHistoricalRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManpowerRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'records_history');
    });

    return () => {
      deptsUnsubscribe();
      linesUnsubscribe();
      recordsUnsubscribe();
      histUnsubscribe();
    };
  }, [date]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'records', id));
      toast.success('Record deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'records');
      toast.error('Failed to delete record');
    }
  };

  // Calculate summary statistics
  const totalPresence = records.reduce((sum, r) => sum + r.count, 0);
  const totalOT = records.reduce((sum, r) => sum + r.otCount, 0);
  const avgPresence = records.length ? Math.round(totalPresence / records.length) : 0;

  const shiftColors = {
    A: 'bg-gradient-to-br from-blue-500 to-blue-600',
    B: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    C: 'bg-gradient-to-br from-amber-500 to-amber-600',
    G: 'bg-gradient-to-br from-purple-500 to-purple-600',
  };

  const chartData = useMemo(() => records.reduce((acc: any[], record) => {
    let lineName = '';
    const line = lines.find(l => l.id === record.lineId);
    
    if (line) {
      lineName = line.name;
    } else if (record.lineId === 'direct') {
      const dept = departments.find(d => d.id === record.departmentId);
      lineName = `${dept?.name || 'Unknown'} (Direct)`;
    } else {
      return acc;
    }
    
    const existing = acc.find(item => item.name === lineName);
    if (existing) {
      existing.presence += record.count;
      existing.ot += record.otCount;
    } else {
      acc.push({
        name: lineName,
        presence: record.count,
        ot: record.otCount,
        dept: departments.find(d => d.id === record.departmentId)?.name || 'Unknown'
      });
    }
    return acc;
  }, []), [records, lines, departments]);

  const trendData = useMemo(() => {
    const dailyMap: Record<string, { date: string; displayDate: string; presence: number; ot: number }> = {};
    
    // Initialize last 7 days including today
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = format(d, 'yyyy-MM-dd');
      dailyMap[ds] = {
        date: ds,
        displayDate: format(d, 'dd MMM'),
        presence: 0,
        ot: 0
      };
    }

    historicalRecords.forEach(record => {
      if (dailyMap[record.date]) {
        dailyMap[record.date].presence += record.count;
        dailyMap[record.date].ot += record.otCount;
      }
    });

    return Object.values(dailyMap);
  }, [historicalRecords]);

  const summaryData = useMemo(() => {
    const summary: Record<string, { 
      lineName: string; 
      deptName: string; 
      A: number; 
      B: number; 
      C: number; 
      G: number; 
      otA: number;
      otB: number;
      otC: number;
      otG: number;
      reqA: number;
      reqG: number;
      reqB: number;
      reqC: number;
      total: number;
      totalReq: number;
      totalOT: number;
      grandTotal: number;
    }> = {};

    // Pre-populate with all lines to show required targets
    lines.forEach(line => {
      const dept = departments.find(d => d.id === line.departmentId);
      if (!dept) return;
      const key = `${dept.id}-${line.id}`;
      summary[key] = {
        lineName: line.name,
        deptName: dept.name,
        A: 0, B: 0, C: 0, G: 0,
        otA: 0, otB: 0, otC: 0, otG: 0,
        reqA: line.requirements?.A || 0,
        reqG: line.requirements?.G || 0,
        reqB: line.requirements?.B || 0,
        reqC: line.requirements?.C || 0,
        total: 0,
        totalReq: (line.requirements?.A || 0) + (line.requirements?.G || 0) + (line.requirements?.B || 0) + (line.requirements?.C || 0),
        totalOT: 0,
        grandTotal: 0
      };
    });

    // Add direct entry departments to summary
    departments.forEach(dept => {
      if (dept.hasLines === false) {
        const key = `${dept.id}-direct`;
        summary[key] = {
          lineName: 'Direct Allocation',
          deptName: dept.name,
          A: 0, B: 0, C: 0, G: 0,
          otA: 0, otB: 0, otC: 0, otG: 0,
          reqA: dept.targets?.A || 0,
          reqG: dept.targets?.G || 0,
          reqB: dept.targets?.B || 0,
          reqC: dept.targets?.C || 0,
          total: 0,
          totalReq: (dept.targets?.A || 0) + (dept.targets?.G || 0) + (dept.targets?.B || 0) + (dept.targets?.C || 0),
          totalOT: 0,
          grandTotal: 0
        };
      }
    });

    records.forEach(record => {
      const key = `${record.departmentId}-${record.lineId}`;
      
      // If not in pre-populated summary (e.g. orphan record or new record)
      if (!summary[key]) {
        const dept = departments.find(d => d.id === record.departmentId);
        if (dept) {
          const line = lines.find(l => l.id === record.lineId);
          summary[key] = {
            lineName: record.lineId === 'direct' ? 'Direct Allocation' : (line?.name || 'Unknown Line'),
            deptName: dept.name,
            A: 0, B: 0, C: 0, G: 0,
            otA: 0, otB: 0, otC: 0, otG: 0,
            reqA: record.lineId === 'direct' ? (dept.targets?.A || 0) : (line?.requirements?.A || 0),
            reqG: record.lineId === 'direct' ? (dept.targets?.G || 0) : (line?.requirements?.G || 0),
            reqB: record.lineId === 'direct' ? (dept.targets?.B || 0) : (line?.requirements?.B || 0),
            reqC: record.lineId === 'direct' ? (dept.targets?.C || 0) : (line?.requirements?.C || 0),
            total: 0,
            totalReq: 0,
            totalOT: 0,
            grandTotal: 0
          };
          summary[key].totalReq = summary[key].reqA + summary[key].reqG + summary[key].reqB + summary[key].reqC;
        }
      }

      if (summary[key]) {
        const shift = record.shift as 'A' | 'B' | 'C' | 'G';
        summary[key][shift] += record.count;
        summary[key][`ot${shift}` as 'otA' | 'otB' | 'otC' | 'otG'] += record.otCount;
        summary[key].total += record.count;
        summary[key].totalOT += record.otCount;
        summary[key].grandTotal += (record.count + record.otCount);
      }
    });

    return Object.values(summary).sort((a, b) => a.deptName.localeCompare(b.deptName) || a.lineName.localeCompare(b.lineName));
  }, [records, lines, departments]);

  const deptSummaryData = useMemo(() => {
    const summary: Record<string, { 
      deptId: string;
      deptName: string; 
      lineCount: number;
      hasLines: boolean;
      A: number; 
      B: number; 
      C: number; 
      G: number; 
      otA: number;
      otB: number;
      otC: number;
      otG: number;
      targetA: number;
      targetB: number;
      targetC: number;
      targetG: number;
      total: number;
      totalTarget: number;
      totalOT: number;
    }> = {};

    departments.forEach(dept => {
      const deptLines = lines.filter(l => l.departmentId === dept.id);
      summary[dept.id] = {
        deptId: dept.id,
        deptName: dept.name,
        lineCount: deptLines.length,
        hasLines: dept.hasLines !== false,
        A: 0, B: 0, C: 0, G: 0,
        otA: 0, otB: 0, otC: 0, otG: 0,
        targetA: dept.targets?.A || 0,
        targetB: dept.targets?.B || 0,
        targetC: dept.targets?.C || 0,
        targetG: dept.targets?.G || 0,
        total: 0,
        totalTarget: (dept.targets?.A || 0) + (dept.targets?.B || 0) + (dept.targets?.C || 0) + (dept.targets?.G || 0),
        totalOT: 0
      };
    });

    records.forEach(record => {
      if (summary[record.departmentId]) {
        const shift = record.shift as 'A' | 'B' | 'C' | 'G';
        summary[record.departmentId][shift] += record.count;
        summary[record.departmentId][`ot${shift}` as 'otA' | 'otB' | 'otC' | 'otG'] += record.otCount;
        summary[record.departmentId].total += record.count;
        summary[record.departmentId].totalOT += record.otCount;
      }
    });

    return Object.values(summary).sort((a, b) => a.deptName.localeCompare(b.deptName));
  }, [records, departments]);

  const handleSendEmail = async () => {
    if (summaryData.length === 0) {
      toast.warning('No data to send for this date');
      return;
    }

    setIsSendingEmail(true);
    toast.info('Preparing email report...');

    try {
      // Get settings from Firestore first
      const settingsSnap = await getDoc(doc(db, 'settings', 'email'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : {};

      const serviceId = settings.serviceId || import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = settings.templateId || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = settings.publicKey || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      const receiverEmail = settings.receiverEmail || import.meta.env.VITE_REPORT_RECEIVER_EMAIL || 'chakanassembly@gmail.com';

      if (!serviceId || !templateId || !publicKey) {
        toast.error('EmailJS not configured!', {
          description: 'Please set EmailJS keys in Administration -> System Settings.'
        });
        setIsSendingEmail(false);
        return;
      }

      // Create a formatted text report
      let reportBody = `MANPOWER REPORT - ${format(new Date(date), 'dd MMM yyyy')}\n`;
      reportBody += `Total Presence: ${totalPresence}\n`;
      reportBody += `Total Overtime: ${totalOT}\n`;
      reportBody += `-------------------------------------------\n\n`;
      
      summaryData.forEach(item => {
        reportBody += `[${item.deptName}] ${item.lineName}:\n`;
        reportBody += `  Shift A: ${item.A} (OT: ${item.otA})\n`;
        reportBody += `  Shift B: ${item.B} (OT: ${item.otB})\n`;
        reportBody += `  Shift C: ${item.C} (OT: ${item.otC})\n`;
        reportBody += `  Shift G: ${item.G} (OT: ${item.otG})\n`;
        reportBody += `  Line Total: ${item.grandTotal}\n`;
        reportBody += `-------------------------------------------\n`;
      });

      const templateParams = {
        to_email: receiverEmail,
        report_date: format(new Date(date), 'dd-MM-yyyy'),
        message: reportBody,
        subject: `Daily Manpower Report: ${format(new Date(date), 'dd MMM yyyy')}`
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      toast.success('Email report sent successfully!');
    } catch (error) {
      console.error('Email Error:', error);
      toast.error('Failed to send email. Check console for details.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-12 space-y-6 md:space-y-8">
        
        {/* Modern Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Intelligence Dashboard</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
              Mission <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Control</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl">
              Global workforce analytics and real-time production line monitoring
            </p>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link to="/entry">
              <Button className="h-12 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center gap-2 hover:scale-[1.02] transition-all">
                <Plus size={18} />
                <span>Quick Input</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl px-4 py-2 shadow-sm border border-slate-200 dark:border-slate-700">
              <CalendarIcon size={16} className="text-blue-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 font-mono font-semibold text-sm text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* ... existing stats cards ... */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Users size={24} className="text-blue-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Staff</span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalPresence}</div>
              <div className="text-sm text-slate-500 mt-1">across all shifts</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
                <Clock size={24} className="text-orange-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Overtime</span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalOT}</div>
              <div className="text-sm text-slate-500 mt-1">extra manpower logged</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                <TrendingUp size={24} className="text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Average</span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{avgPresence}</div>
              <div className="text-sm text-slate-500 mt-1">per line average</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-purple-500" />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Records</span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{records.length}</div>
              <div className="text-sm text-slate-500 mt-1">entries today</div>
            </div>
          </div>
        </div>

        {/* Monitoring Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30">
                  <Activity size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daily Snap</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Line-wise distribution for {format(new Date(date), 'dd MMM')}</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-8 h-[350px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        padding: '12px'
                      }}
                    />
                    <Bar dataKey="presence" radius={[6, 6, 0, 0]} barSize={30}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDepartmentGradient(entry.dept).split(' ')[1].replace('to-', '').replace('-600', '-500')} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                    <BarChart3 size={40} className="opacity-20" />
                  </div>
                  <p className="text-sm font-medium">No data for this date</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/30">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Trend Logic</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Last 7 days workforce utilization</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-8 h-[350px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="displayDate" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        padding: '12px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="presence" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPresence)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ot" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      fill="transparent" 
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                    <TrendingUp size={40} className="opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Insufficient trend data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Records Section */}
        <div className="space-y-6">
          {/* Department Targets Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mb-8">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg shadow-indigo-500/30">
                  <Target size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Department Targets Overview</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Global operational target tracking by shift</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {deptSummaryData.map((dept) => (
                  <div key={dept.deptId} className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gradient-to-r ${getDepartmentGradient(dept.deptName)} text-white text-center`}>
                          {dept.deptName}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 text-center">
                          {!dept.hasLines ? 'Direct Reporting' : `${dept.lineCount} ${dept.lineCount === 1 ? 'Line' : 'Lines'}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">Total P / Target</p>
                        <p className={`text-lg font-mono font-black ${dept.total < dept.totalTarget ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {dept.total} / {dept.totalTarget}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {['A', 'G', 'B', 'C'].map((s) => {
                        const shift = s as 'A' | 'G' | 'B' | 'C';
                        const p = dept[shift];
                        const t = dept[`target${shift}` as keyof typeof dept] as number;
                        const ot = dept[`ot${shift}` as 'otA' | 'otG' | 'otB' | 'otC'];
                        const percentage = t > 0 ? Math.min(Math.round((p / t) * 100), 100) : 0;
                        
                        return (
                          <div key={s} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-500">SHIFT {s}</span>
                              <span className={p < t ? 'text-rose-500' : 'text-emerald-500'}>{p} / {t} {ot > 0 && <span className="text-orange-500 ml-1"> (+{ot} OT)</span>}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${p < t ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {deptSummaryData.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 italic">
                    No departments defined
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Workforce Intelligence
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {reportMode === 'summary' ? 'Shift-wise summary by line' : 'Individual entry logs'} • {format(new Date(date), 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setReportMode('summary')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    reportMode === 'summary' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setReportMode('logs')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    reportMode === 'logs' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  Logs
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-500 transition-colors disabled:opacity-50"
                  title="Send Email Report"
                >
                  {isSendingEmail ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                </button>
                <button 
                  onClick={() => {
                    toast.info('Export starting...');
                    // In a real app, this would generate a CSV/PDF
                  }}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-500 transition-colors"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={() => {
                    setDate(format(new Date(), 'yyyy-MM-dd'));
                    toast.success('Syncing with Real-time Stream');
                  }}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-blue-500 transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
          </div>          {reportMode === 'summary' ? (
            <div className="space-y-4">
              {/* Desktop Table: Hidden on small screens */}
              <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <th className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
                        <th className="py-5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Line</th>
                        <th className="py-5 px-6 text-center text-xs font-bold uppercase tracking-wider text-blue-500 bg-blue-50/40 dark:bg-blue-900/20 border-x border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center">
                            <span>Shift A</span>
                            <span className="text-[8px] font-normal text-slate-400 mt-0.5">P / R / OT</span>
                          </div>
                        </th>
                        <th className="py-5 px-6 text-center text-xs font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/20 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center">
                            <span>Shift B</span>
                            <span className="text-[8px] font-normal text-slate-400 mt-0.5">P / R / OT</span>
                          </div>
                        </th>
                        <th className="py-5 px-6 text-center text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-50/40 dark:bg-amber-900/20 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center">
                            <span>Shift C</span>
                            <span className="text-[8px] font-normal text-slate-400 mt-0.5">P / R / OT</span>
                          </div>
                        </th>
                        <th className="py-5 px-6 text-center text-xs font-bold uppercase tracking-wider text-purple-500 bg-purple-50/40 dark:bg-purple-900/20 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-center">
                            <span>Shift G</span>
                            <span className="text-[8px] font-normal text-slate-400 mt-0.5">P / R / OT</span>
                          </div>
                        </th>
                        <th className="py-5 px-6 text-right text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col items-end">
                            <span>Day P</span>
                            <span className="text-[8px] font-normal text-slate-400 mt-0.5">Presence / Req</span>
                          </div>
                        </th>
                        <th className="py-5 px-6 text-right text-xs font-bold uppercase tracking-wider text-orange-500 border-r border-slate-100 dark:border-slate-800">Total OT</th>
                        <th className="py-5 px-6 text-right text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Force</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summaryData.length > 0 ? summaryData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gradient-to-r ${getDepartmentGradient(item.deptName)} text-white`}>
                              {item.deptName}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-300">{item.lineName}</td>
                          <td className="py-4 px-6 text-center font-mono font-bold bg-blue-50/10 dark:bg-blue-900/5 border-x border-slate-50 dark:border-slate-800">
                            <div className="flex flex-col items-center">
                              <div className="flex items-baseline gap-1">
                                <span className={item.reqA > 0 && item.A < item.reqA ? 'text-rose-500' : 'text-blue-600 dark:text-blue-400'}>
                                  {item.A}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">/ {item.reqA}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {item.otA > 0 && (
                                  <span className="text-[10px] text-orange-500 font-bold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">OT: {item.otA}</span>
                                )}
                                {(item.A > 0 || item.otA > 0) && (
                                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">Σ: {item.A + item.otA}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-mono font-bold bg-emerald-50/10 dark:bg-emerald-900/5 border-r border-slate-50 dark:border-slate-800">
                            <div className="flex flex-col items-center">
                              <div className="flex items-baseline gap-1">
                                <span className={item.reqB > 0 && item.B < item.reqB ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {item.B}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">/ {item.reqB}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {item.otB > 0 && (
                                  <span className="text-[10px] text-orange-500 font-bold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">OT: {item.otB}</span>
                                )}
                                {(item.B > 0 || item.otB > 0) && (
                                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">Σ: {item.B + item.otB}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-mono font-bold bg-amber-50/10 dark:bg-amber-900/5 border-r border-slate-50 dark:border-slate-800">
                            <div className="flex flex-col items-center">
                              <div className="flex items-baseline gap-1">
                                <span className={item.reqC > 0 && item.C < item.reqC ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}>
                                  {item.C}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">/ {item.reqC}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {item.otC > 0 && (
                                  <span className="text-[10px] text-orange-500 font-bold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">OT: {item.otC}</span>
                                )}
                                {(item.C > 0 || item.otC > 0) && (
                                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">Σ: {item.C + item.otC}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-mono font-bold bg-purple-50/10 dark:bg-purple-900/5 border-r border-slate-50 dark:border-slate-800">
                            <div className="flex flex-col items-center">
                              <div className="flex items-baseline gap-1">
                                <span className={item.reqG > 0 && item.G < item.reqG ? 'text-rose-500' : 'text-purple-600 dark:text-purple-400'}>
                                  {item.G}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">/ {item.reqG}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {item.otG > 0 && (
                                  <span className="text-[10px] text-orange-500 font-bold bg-orange-50 dark:bg-orange-950/30 px-1 rounded">OT: {item.otG}</span>
                                )}
                                {(item.G > 0 || item.otG > 0) && (
                                  <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">Σ: {item.G + item.otG}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold border-r border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col items-end">
                              <span className={item.total < item.totalReq ? 'text-rose-500' : 'text-slate-900 dark:text-white'}>
                                {item.total}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">/ {item.totalReq}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-orange-500 border-r border-slate-100 dark:border-slate-800">{item.totalOT}</td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50/30 dark:bg-slate-800/30">{item.grandTotal}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8} className="py-20 text-center text-slate-400 italic">No records found for this date</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile View: High-density Cards for smaller screens */}
              <div className="lg:hidden space-y-4">
                {summaryData.map((item, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className={`h-1.5 bg-gradient-to-r ${getDepartmentGradient(item.deptName)}`}></div>
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{item.lineName}</h4>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{item.deptName}</span>
                      </div>
                      <div className="text-right">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-indigo-500 uppercase tracking-tighter">Total Force</span>
                          <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                             {item.grandTotal}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-slate-100/50 dark:bg-slate-800/50 flex justify-between items-center border-y border-slate-200 dark:border-slate-800">
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Day Presence: <span className={item.total < item.totalReq ? 'text-rose-500' : 'text-slate-900 dark:text-white'}>{item.total} / {item.totalReq}</span></span>
                       <span className="text-[10px] font-bold text-orange-500 uppercase">Total OT: {item.totalOT}</span>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        { label: 'Shift A', p: item.A, r: item.reqA, ot: item.otA, color: 'text-blue-500', bg: 'bg-blue-50/20 dark:bg-blue-900/10' },
                        { label: 'Shift B', p: item.B, r: item.reqB, ot: item.otB, color: 'text-emerald-500', bg: 'bg-emerald-50/20 dark:bg-emerald-900/10' },
                        { label: 'Shift C', p: item.C, r: item.reqC, ot: item.otC, color: 'text-amber-500', bg: 'bg-amber-50/20 dark:bg-amber-900/10' },
                        { label: 'Shift G', p: item.G, r: item.reqG, ot: item.otG, color: 'text-purple-500', bg: 'bg-purple-50/20 dark:bg-purple-900/10' },
                      ].map((s) => (
                        <div key={s.label} className={`p-4 ${s.bg}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${s.color} mb-2`}>{s.label}</p>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-slate-400">P / R:</span>
                              <span className={`font-mono font-bold ${s.r > 0 && s.p < s.r ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {s.p} / {s.r}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between border-t border-slate-100/50 dark:border-slate-800/10 pt-1 mt-1">
                              <span className="text-xs text-slate-400">OT:</span>
                              <span className={`font-mono font-bold ${s.ot > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                                {s.ot}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between border-t border-slate-100/50 dark:border-slate-800/10 pt-1 mt-1">
                              <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Σ Shift Total:</span>
                              <span className="font-mono font-bold text-indigo-500">
                                {s.p + s.ot}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {item.totalOT > 0 && (
                      <div className="p-3 bg-orange-50/50 dark:bg-orange-950/20 border-t border-orange-100 dark:border-orange-900/30 flex justify-between items-center">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Daily Overtime</span>
                        <span className="font-mono font-bold text-orange-500">{item.totalOT}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {summaryData.length === 0 && (
                  <div className="py-20 text-center text-slate-400 italic">No records found for this date</div>
                )}
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={28} className="text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No records yet</h4>
              <p className="text-sm text-slate-500 mt-1">Submit your first manpower record using the form above</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {records.map((record) => {
                const line = lines.find(l => l.id === record.lineId);
                const dept = departments.find(d => d.id === record.departmentId);
                return (
                  <div 
                    key={record.id} 
                    className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all duration-300 overflow-hidden"
                  >
                    <div className={`h-2 bg-gradient-to-r ${getDepartmentGradient(dept?.name || '')}`}></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`${shiftColors[record.shift]} w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md`}>
                          {record.shift}
                        </div>
                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <h4 className="font-bold text-lg text-slate-900 dark:text-white">{line?.name || 'Unknown Line'}</h4>
                      {dept && (
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-0.5">{dept.name}</p>
                      )}
                      
                      <div className="flex items-center gap-6 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase">Presence</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{record.count}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase">Overtime</p>
                          <p className="text-2xl font-bold text-orange-500">{record.otCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift</th>
                      <th className="text-left py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Line</th>
                      <th className="hidden sm:table-cell text-left py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                      <th className="text-right py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Presence</th>
                      <th className="text-right py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">OT</th>
                      <th className="text-right py-4 px-4 sm:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const line = lines.find(l => l.id === record.lineId);
                      const dept = departments.find(d => d.id === record.departmentId);
                      return (
                        <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-4 sm:px-6">
                            <span className={`inline-flex w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${shiftColors[record.shift]} text-white font-bold items-center justify-center text-[10px] sm:text-sm`}>
                              {record.shift}
                            </span>
                          </td>
                          <td className="py-4 px-4 sm:px-6 font-medium text-slate-900 dark:text-white text-sm sm:text-base">{line?.name || '—'}</td>
                          <td className="hidden sm:table-cell py-4 px-4 sm:px-6 text-sm text-slate-500">{dept?.name || '—'}</td>
                          <td className="py-4 px-4 sm:px-6 text-right font-bold text-base sm:text-lg text-slate-900 dark:text-white">{record.count}</td>
                          <td className="py-4 px-4 sm:px-6 text-right font-bold text-base sm:text-lg text-orange-500">{record.otCount}</td>
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button 
                              onClick={() => handleDelete(record.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}