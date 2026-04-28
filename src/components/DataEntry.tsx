import React, { useEffect, useState, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Department, Line, ManpowerRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format } from 'date-fns';
import { 
  Trash2, ClipboardCheck, Calendar as CalendarIcon, 
  ClipboardList, Loader2, TrendingUp, Users, Clock, Zap, 
  BarChart3, CheckCircle2, UserCheck, Plus,
  ArrowUpRight, Download, RefreshCw, Eye, Grid3X3,
  List, Building2, LayoutGrid, Sun, Moon, Star, Target
} from 'lucide-react';
import { toast } from 'sonner';

// Helper function to get gradient based on department
const getDepartmentGradient = (deptName: string) => {
  const gradients: Record<string, string> = {
    'Assembly': 'from-blue-500 to-indigo-600',
    'Quality': 'from-emerald-500 to-teal-600',
    'Logistics': 'from-amber-500 to-orange-600',
    'Maintenance': 'from-purple-500 to-pink-600',
    'Production': 'from-rose-500 to-red-600',
  };
  return gradients[deptName] || 'from-slate-500 to-gray-600';
};

// Helper for shift badge styling
const getShiftBadgeStyle = (shift: string) => {
  const styles: Record<string, string> = {
    A: 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30',
    B: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30',
    C: 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30',
    G: 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/30',
  };
  return styles[shift] || 'bg-gradient-to-br from-slate-500 to-slate-600';
};

export default function DataEntry() {
  const { user, profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [records, setRecords] = useState<ManpowerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form State
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedShift, setSelectedShift] = useState<'A' | 'B' | 'C' | 'G' | ''>('');
  const [count, setCount] = useState('');
  const [otCount, setOtCount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

    return () => {
      deptsUnsubscribe();
      linesUnsubscribe();
      recordsUnsubscribe();
    };
  }, [date]);

  const isDirectEntry = useMemo(() => {
    const dept = departments.find(d => d.id === selectedDept);
    // If department specifically has hasLines: false, it's direct entry
    return dept?.hasLines === false;
  }, [departments, selectedDept]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    // Comprehensive client-side validation
    const errors: string[] = [];
    if (!selectedDept) errors.push('Department');
    if (!isDirectEntry && !selectedLine) errors.push('Production Line');
    if (!selectedShift) errors.push('Shift');
    
    const parsedCount = parseInt(count);
    if (count === '' || isNaN(parsedCount) || parsedCount < 0) {
      errors.push('Valid non-negative Presence count');
    }
    
    const parsedOtCount = parseInt(otCount);
    if (otCount === '' || isNaN(parsedOtCount) || parsedOtCount < 0) {
      errors.push('Valid non-negative Overtime count');
    }

    if (errors.length > 0) {
      toast.error('Validation Error', {
        description: `Missing or invalid: ${errors.join(', ')}`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newRecord = {
        date,
        departmentId: selectedDept,
        lineId: isDirectEntry ? 'direct' : selectedLine,
        shift: selectedShift,
        count: parsedCount,
        otCount: parsedOtCount,
        recordedBy: user.uid,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'records'), newRecord);
      toast.success('Record added successfully');
      
      setSelectedLine('');
      setCount('');
      setOtCount('');
      setSelectedShift('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'records');
      toast.error('Failed to add record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'records', id));
      toast.success('Record deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'records');
      toast.error('Failed to delete record');
    }
  };

  const deptsToDisplay = departments.filter(dept => {
    if (profile?.role === 'supervisor') {
      // Show if directly assigned to dept
      if (profile.assignedDepts?.includes(dept.id)) return true;
      
      // OR if user has assigned lines in this dept
      const assignedLinesInDept = lines.filter(l => l.departmentId === dept.id && profile.assignedLines?.includes(l.id));
      return assignedLinesInDept.length > 0;
    }
    return true;
  });

  const filteredLines = lines.filter(l => {
    const isDeptMatch = l.departmentId === selectedDept;
    if (profile?.role === 'supervisor') {
      // Supervisor has access if assigned to specific line OR assigned to the whole department
      return isDeptMatch && (
        (profile.assignedLines || []).includes(l.id) || 
        (profile.assignedDepts || []).includes(l.departmentId)
      );
    }
    return isDeptMatch;
  });

  // Calculate summary statistics
  const totalPresence = records.reduce((sum, r) => sum + r.count, 0);
  const totalOT = records.reduce((sum, r) => sum + r.otCount, 0);
  const avgPresence = records.length ? Math.round(totalPresence / records.length) : 0;
  const utilizationRate = records.length ? Math.round((totalPresence / (records.length * 100)) * 100) : 0;

  const shiftColors = {
    A: 'from-blue-500 to-blue-600',
    B: 'from-emerald-500 to-emerald-600',
    C: 'from-amber-500 to-amber-600',
    G: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Data Management</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800 dark:text-white">
              Manpower <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Entry</span>
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Record and monitor workforce allocation across production lines in real-time
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 shadow-sm border border-slate-200 dark:border-slate-700">
              <CalendarIcon size="14" className="text-blue-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 font-mono text-sm text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Grid3X3 size="16" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <List size="16" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard 
            icon={<Users size="18" />} 
            value={totalPresence} 
            label="Total Staff" 
            sublabel="across all shifts"
            color="blue"
          />
          <StatCard 
            icon={<Clock size="18" />} 
            value={totalOT} 
            label="Overtime" 
            sublabel="extra manpower logged"
            color="orange"
          />
          <StatCard 
            icon={<TrendingUp size="18" />} 
            value={avgPresence} 
            label="Average" 
            sublabel="per line"
            color="emerald"
          />
          <StatCard 
            icon={<CheckCircle2 size="18" />} 
            value={records.length} 
            label="Records" 
            sublabel="entries today"
            color="purple"
          />
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm">
                <Plus size="14" className="text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">New Entry</h2>
              <p className="text-xs text-slate-400 ml-2">Record manpower data</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 size="12" className="text-blue-500" />
                    Department
                  </span>
                  <span className="text-[10px] text-rose-500 font-bold">* Required</span>
                </Label>
                <Select value={selectedDept} onValueChange={(val) => { setSelectedDept(val); setSelectedLine(''); }}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <SelectValue placeholder="Select department">
                      {selectedDept ? (departments.find(d => d.id === selectedDept)?.name) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {deptsToDisplay.map(dept => (
                      <SelectItem key={dept.id} value={dept.id} textValue={dept.name} className="text-sm">{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Line - Only show if not direct entry */}
              {!isDirectEntry && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <LayoutGrid size="12" className="text-blue-500" />
                      Production Line
                    </span>
                    <span className="text-[10px] text-rose-500 font-bold">* Required</span>
                  </Label>
                  <Select value={selectedLine} onValueChange={setSelectedLine} disabled={!selectedDept}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm disabled:opacity-50">
                      <SelectValue placeholder={selectedDept ? "Select line" : "Select dept first"}>
                        {selectedLine ? (lines.find(l => l.id === selectedLine)?.name) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredLines.map(line => (
                        <SelectItem key={line.id} value={line.id} textValue={line.name} className="text-sm">
                          <div className="flex flex-col">
                            <span>{line.name}</span>
                            {line.description && <span className="text-[10px] text-slate-400">{line.description}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Shift */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Star size="12" className="text-blue-500" />
                    Shift
                  </span>
                  <span className="text-[10px] text-rose-500 font-bold">* Required</span>
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['A', 'G', 'B', 'C'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedShift(s)}
                      className={`h-10 rounded-lg font-bold text-base transition-all duration-200 ${
                        selectedShift === s
                          ? `bg-gradient-to-r ${getShiftBadgeStyle(s)} text-white shadow-md`
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Targets Info (Contextual) */}
              {selectedDept && (
                <div className="md:col-span-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shift Target Context</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['A', 'G', 'B', 'C'].map((s) => {
                      const shift = s as 'A' | 'G' | 'B' | 'C';
                      const line = lines.find(l => l.id === selectedLine);
                      const dept = departments.find(d => d.id === selectedDept);
                      
                      const targetValue = isDirectEntry 
                        ? (dept?.targets?.[shift] || 0)
                        : (line?.requirements?.[shift] || dept?.targets?.[shift] || 0);
                        
                      return (
                        <div key={s} className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-slate-400">{s}</span>
                          <span className="text-sm font-mono font-black text-slate-700 dark:text-slate-300">{targetValue}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck size="12" className="text-emerald-500" />
                      Presence
                    </span>
                    <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={count}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (/^\d+$/.test(val))) {
                          setCount(val);
                        }
                      }}
                      placeholder="0"
                      className="h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-lg font-bold pl-3 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">workers</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap size="12" className="text-orange-500" />
                      Overtime
                    </span>
                    <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={otCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (/^\d+$/.test(val))) {
                          setOtCount(val);
                        }
                      }}
                      placeholder="0"
                      className="h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-lg font-bold pl-3 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">workers</span>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-sm"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ClipboardCheck size="16" />
                  <span>Submit Record</span>
                  <ArrowUpRight size="14" className="opacity-70" />
                </div>
              )}
            </Button>
          </form>
        </div>

        {/* Records Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Today's Records</h3>
              <p className="text-xs text-slate-400">{records.length} entries for {format(new Date(date), 'MMM d, yyyy')}</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 transition-colors">
                <Download size="14" />
              </button>
              <button 
                onClick={() => {
                  setDate(format(new Date(), 'yyyy-MM-dd'));
                  toast.success('Refreshed');
                }}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 transition-colors"
              >
                <RefreshCw size="14" />
              </button>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <ClipboardList size="20" className="text-slate-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No records yet</h4>
              <p className="text-xs text-slate-400 mt-1">Submit your first manpower record</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {records.map((record) => {
                const line = lines.find(l => l.id === record.lineId);
                const dept = departments.find(d => d.id === record.departmentId);
                return (
                  <RecordCard
                    key={record.id}
                    shift={record.shift}
                    shiftColor={shiftColors[record.shift as keyof typeof shiftColors]}
                    lineName={record.lineId === 'direct' ? 'Direct Allocation' : (line?.name || 'Unknown')}
                    deptName={dept?.name}
                    count={record.count}
                    otCount={record.otCount}
                    onDelete={() => handleDelete(record.id)}
                    gradient={getDepartmentGradient(dept?.name || '')}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase">Shift</th>
                      <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase">Line</th>
                      <th className="text-left py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase hidden md:table-cell">Dept</th>
                      <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase">Presence</th>
                      <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase">OT</th>
                      <th className="text-right py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const line = lines.find(l => l.id === record.lineId);
                      const dept = departments.find(d => d.id === record.departmentId);
                      return (
                        <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <span className={`inline-flex w-8 h-8 rounded-lg bg-gradient-to-br ${getShiftBadgeStyle(record.shift)} text-white font-bold items-center justify-center text-xs shadow-sm`}>
                              {record.shift}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                            {record.lineId === 'direct' ? (
                              <span className="text-xs italic text-slate-400">Direct Entry</span>
                            ) : (line?.name || '—')}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">{dept?.name || '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-white">{record.count}</td>
                          <td className="py-3 px-4 text-right font-bold text-orange-500">{record.otCount}</td>
                          <td className="py-3 px-4 text-right">
                            <button 
                              onClick={() => handleDelete(record.id)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 size="14" />
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

interface StatCardProps {
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  sublabel: string;
  color: 'blue' | 'orange' | 'emerald' | 'purple';
}

// Stat Card Component
function StatCard({ icon, value, label, sublabel, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-500',
    orange: 'bg-orange-50 dark:bg-orange-950/30 text-orange-500',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500',
    purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-500',
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-lg ${colors[color]} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <div className="text-xl font-bold text-slate-800 dark:text-white">{value}</div>
          <div className="text-[10px] font-medium text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

interface RecordCardProps {
  key?: string;
  shift: string;
  shiftColor: string;
  lineName: string;
  deptName?: string;
  count: number;
  otCount: number;
  onDelete: () => void | Promise<void>;
  gradient: string;
}

// Record Card Component for Grid View
function RecordCard({ 
  shift, shiftColor, lineName, deptName, count, otCount, onDelete, gradient 
}: RecordCardProps) {
  return (
    <div className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${gradient}`}></div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${shiftColor} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
            {shift}
          </div>
          <button 
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          >
            <Trash2 size="14" />
          </button>
        </div>
        
        <h4 className="font-bold text-slate-800 dark:text-white">{lineName}</h4>
        {deptName && (
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">{deptName}</p>
        )}
        
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[9px] font-medium text-slate-400 uppercase">Presence</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{count}</p>
          </div>
          <div>
            <p className="text-[9px] font-medium text-slate-400 uppercase">Overtime</p>
            <p className="text-xl font-bold text-orange-500">{otCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}