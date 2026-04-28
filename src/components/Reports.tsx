import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Department, Line, ManpowerRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, parseISO, startOfDay, addDays, 
  isToday, startOfWeek, endOfWeek
} from 'date-fns';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  FileDown, FileSpreadsheet, Calendar as CalendarIcon, 
  Filter, Loader2, Download, Table, FileText, 
  LayoutList, Clock, CheckCircle2, Factory,
  LayoutGrid, Sparkles, Mail, Target, TrendingUp,
  BarChart3, CalendarDays, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import emailjs from '@emailjs/browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  
  // Filter state
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedLine, setSelectedLine] = useState('all');
  const [reportRecords, setReportRecords] = useState<ManpowerRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [view, setView] = useState<'summary' | 'heatmap'>('summary');

  useEffect(() => {
    const fetchReportData = async () => {
      setPreviewLoading(true);
      try {
        let q = query(
          collection(db, 'records'),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );

        const querySnapshot = await getDocs(q);
        let records = querySnapshot.docs.map(doc => doc.data() as ManpowerRecord);

        // Client-side filtering
        if (selectedDept !== 'all') {
          records = records.filter(r => r.departmentId === selectedDept);
        }
        if (selectedLine !== 'all' && selectedLine !== 'direct') {
          records = records.filter(r => r.lineId === selectedLine);
        } else if (selectedLine === 'direct') {
          records = records.filter(r => r.lineId === 'direct');
        }

        setReportRecords(records);
      } catch (err) {
        console.error('Error fetching report preview:', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchReportData();
  }, [startDate, endDate, selectedDept, selectedLine]);

  const reportSummary = useMemo(() => {
    if (selectedDept !== 'all') {
      const summary: Record<string, { id: string; name: string; presence: number; ot: number }> = {};
      
      reportRecords.forEach(r => {
        const lineName = r.lineId === 'direct' ? 'Direct Allocation' : (lines.find(l => l.id === r.lineId)?.name || 'Unknown');
        if (!summary[r.lineId]) {
          summary[r.lineId] = { id: r.lineId, name: lineName, presence: 0, ot: 0 };
        }
        summary[r.lineId].presence += r.count;
        summary[r.lineId].ot += r.otCount;
      });
      
      return Object.values(summary);
    } else {
      const summary: Record<string, { id: string; name: string; presence: number; ot: number }> = {};
      
      reportRecords.forEach(r => {
        const deptName = departments.find(d => d.id === r.departmentId)?.name || 'Unknown';
        if (!summary[r.departmentId]) {
          summary[r.departmentId] = { id: r.departmentId, name: deptName, presence: 0, ot: 0 };
        }
        summary[r.departmentId].presence += r.count;
        summary[r.departmentId].ot += r.otCount;
      });
      
      return Object.values(summary);
    }
  }, [reportRecords, selectedDept, lines, departments]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const deptsSnap = await getDocs(collection(db, 'departments'));
        const depts = deptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
        setDepartments(depts);

        const linesSnap = await getDocs(collection(db, 'lines'));
        const linesData = linesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Line));
        setLines(linesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error('Failed to load filter options');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const headers = ['Date', 'Department', 'Line', 'Shift', 'Presence', 'Overtime', 'Timestamp'];
      const rows = reportRecords.map(r => {
        const dept = departments.find(d => d.id === r.departmentId)?.name || r.departmentId;
        const line = r.lineId === 'direct' ? 'Direct Entry' : (lines.find(l => l.id === r.lineId)?.name || r.lineId);
        return [
          r.date,
          `"${dept}"`,
          `"${line}"`,
          r.shift,
          r.count,
          r.otCount,
          r.timestamp
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `PlantFlow_Report_${startDate}_to_${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('CSV Report downloaded successfully');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to generate report');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('PlantFlow Executive Summary', 14, 22);
      
      // Meta info
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Frequency: ${startDate} to ${endDate}`, 14, 30);
      doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 35);
      doc.text(`Applied Filters: Dept ${selectedDept === 'all' ? 'All' : departments.find(d => d.id === selectedDept)?.name}, Line ${selectedLine === 'all' ? 'All' : selectedLine}`, 14, 40);

      // Summary Stats
      const totalPresence = reportRecords.reduce((sum, r) => sum + r.count, 0);
      const totalOT = reportRecords.reduce((sum, r) => sum + r.otCount, 0);
      
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 45, 182, 30, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text('Performance Metrics', 20, 55);
      doc.setFontSize(10);
      doc.text(`Total Attendance: ${totalPresence}`, 20, 62);
      doc.text(`Total Overtime: ${totalOT} hrs`, 80, 62);
      doc.text(`Efficiency Rate: ${((totalPresence / (totalPresence + totalOT)) * 100).toFixed(1)}%`, 140, 62);

      // Table
      const tableData = reportSummary.map(item => [
        item.name,
        item.presence.toString(),
        item.ot.toString(),
        (item.presence + item.ot).toString()
      ]);

      autoTable(doc, {
        startY: 85,
        head: [[selectedDept === 'all' ? 'Department' : 'Production Line', 'Base Attendance', 'Overtime', 'Total Man-Hours']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 9 }
      });

      // Daily Breakdown if not too many
      if (reportRecords.length < 50) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 15,
          head: [['Date', 'Dept', 'Line', 'Shift', 'Count', 'OT']],
          body: reportRecords.map(r => [
            r.date,
            departments.find(d => d.id === r.departmentId)?.name || 'N/A',
            r.lineId === 'direct' ? 'Direct' : (lines.find(l => l.id === r.lineId)?.name || 'N/A'),
            r.shift,
            r.count.toString(),
            r.otCount.toString()
          ]),
          styles: { fontSize: 7 }
        });
      }

      doc.save(`PlantFlow_Executive_Report_${startDate}.pdf`);
      toast.success('Executive PDF downloaded successfully');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    setDownloading(true);
    try {
      if (reportRecords.length === 0) {
        toast.warning('No records found to email');
        setDownloading(false);
        return;
      }

      const settingsSnap = await getDoc(doc(db, 'settings', 'email'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : {};

      const serviceId = settings.serviceId || import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = settings.templateId || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = settings.publicKey || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      const receiverEmail = settings.receiverEmail || import.meta.env.VITE_REPORT_RECEIVER_EMAIL || 'chakanassembly@gmail.com';

      if (!serviceId || !templateId || !publicKey) {
        toast.error('EmailJS not configured!');
        setDownloading(false);
        return;
      }

      let reportBody = `MANPOWER LOG REPORT: ${startDate} to ${endDate}\n`;
      reportBody += `Total Entries: ${reportRecords.length}\n`;
      reportBody += `Total Presence: ${reportRecords.reduce((sum, r) => sum + r.count, 0)}\n`;
      reportBody += `Total Overtime: ${reportRecords.reduce((sum, r) => sum + r.otCount, 0)}\n`;
      reportBody += `-------------------------------------------\n\n`;

      reportRecords.slice(0, 100).forEach((r, idx) => {
        const dept = departments.find(d => d.id === r.departmentId)?.name || 'N/A';
        const line = r.lineId === 'direct' ? 'Direct Entry' : (lines.find(l => l.id === r.lineId)?.name || 'N/A');
        reportBody += `${idx + 1}. [${r.date}] Dept: ${dept}, Line: ${line}, Shift: ${r.shift} -> Count: ${r.count}, OT: ${r.otCount}\n`;
      });
      
      if (reportRecords.length > 100) {
        reportBody += `\n... and ${reportRecords.length - 100} more entries.`;
      }

      const templateParams = {
        to_email: receiverEmail,
        report_date: `${startDate} to ${endDate}`,
        message: reportBody,
        subject: `PlantFlow Exec Report (${startDate} to ${endDate})`
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      toast.success('Report dispatched to management!');
    } catch (err) {
      console.error('Email error:', err);
      toast.error('Failed to send email report');
    } finally {
      setDownloading(false);
    }
  };

  const deptsToDisplay = departments.filter(dept => {
    if (profile?.role === 'supervisor') {
      if (profile.assignedDepts?.includes(dept.id)) return true;
      const assignedLinesInDept = lines.filter(l => l.departmentId === dept.id && (profile.assignedLines || []).includes(l.id));
      return assignedLinesInDept.length > 0;
    }
    return true;
  });

  const filteredLines = selectedDept === 'all' 
    ? (profile?.role === 'supervisor' 
        ? lines.filter(l => (profile.assignedLines || []).includes(l.id) || (profile.assignedDepts || []).includes(l.departmentId))
        : lines)
    : lines.filter(l => {
        const isDeptMatch = l.departmentId === selectedDept;
        if (profile?.role === 'supervisor') {
          return isDeptMatch && ((profile.assignedLines || []).includes(l.id) || (profile.assignedDepts || []).includes(l.departmentId));
        }
        return isDeptMatch;
      });

  // Heatmap Data Prep
  const heatmapData = useMemo(() => {
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate)
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayRecords = reportRecords.filter(r => r.date === dateStr);
      const totalForDay = dayRecords.reduce((sum, r) => sum + r.count, 0);
      
      // Calculate target if possible for "intensity"
      let target = 0;
      if (selectedDept !== 'all') {
        const dept = departments.find(d => d.id === selectedDept);
        if (dept) {
          target = (dept.targets?.A || 0) + (dept.targets?.B || 0) + (dept.targets?.C || 0) + (dept.targets?.G || 0);
        }
      } else {
        // Average/Total target of all depts
        target = departments.reduce((sum, d) => sum + ((d.targets?.A || 0) + (d.targets?.B || 0) + (d.targets?.C || 0) + (d.targets?.G || 0)), 0);
      }

      // Percentage to target
      const intensity = target > 0 ? (totalForDay / target) : (totalForDay > 0 ? 1 : 0);

      return {
        date: dateStr,
        day: format(day, 'd'),
        fullDate: day,
        count: totalForDay,
        intensity: Math.min(intensity, 1.2), // Caps at 120%
        hasData: dayRecords.length > 0
      };
    });
  }, [reportRecords, startDate, endDate, selectedDept, departments]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Archival Intelligence</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
            System <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Reports</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-xl">
            Export granular manpower distribution data and overtime metrics for audit and process optimization
          </p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setView('summary')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'summary' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-none' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Summary
          </button>
          <button 
            onClick={() => setView('heatmap')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'heatmap' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-none' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Heatmap
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters Card */}
        <div className="lg:col-span-4 h-fit sticky top-8">
          <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                  <Filter size={20} />
                </div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase">Export Engine</h3>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Range Selection</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="relative group">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={16} />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-12 pr-4 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                      />
                    </div>
                    <div className="relative group">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={16} />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-12 pr-4 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department Filter</Label>
                  <Select value={selectedDept} onValueChange={(val) => { 
                    setSelectedDept(val); 
                    const dept = departments.find(d => d.id === val);
                    if (dept?.hasLines === false) setSelectedLine('direct');
                    else setSelectedLine('all');
                  }}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <SelectItem value="all">Global (All Depts)</SelectItem>
                      {deptsToDisplay.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Production Line Filter</Label>
                  <Select value={selectedLine} onValueChange={setSelectedLine}>
                    <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
                      <SelectValue placeholder="All Lines" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <SelectItem value="all">Global (All Lines)</SelectItem>
                      {(selectedDept !== 'all' && departments.find(d => d.id === selectedDept)?.hasLines === false) && (
                        <SelectItem value="direct">Direct Entry</SelectItem>
                      )}
                      {filteredLines.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 mt-6 border-t-2 border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={handleDownloadCSV} 
                  disabled={downloading || loading}
                  variant="outline"
                  className="h-16 rounded-2xl border-2 border-slate-200 dark:border-slate-700 font-black uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} className="mr-2" /> CSV
                </Button>
                <Button 
                  onClick={handleDownloadPDF} 
                  disabled={downloading || loading}
                  className="h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <FileText size={16} className="mr-2" /> Management PDF
                </Button>
              </div>

              <Button 
                onClick={handleSendEmail} 
                disabled={downloading || loading}
                className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail size={20} />
                    <span>Dispatch to Management</span>
                  </div>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Dynamic View Section */}
        <div className="lg:col-span-8 space-y-8">
          {view === 'summary' ? (
            <>
              {/* Executive Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={100} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Presence</p>
                  <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                    {reportRecords.reduce((sum, r) => sum + r.count, 0)}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full w-fit">
                    <TrendingUp size={14} />
                    <span>Active Workflow</span>
                  </div>
                </Card>

                <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <Clock size={100} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Overtime Intensity</p>
                  <div className="text-4xl font-black tracking-tighter text-orange-500">
                    {reportRecords.reduce((sum, r) => sum + r.otCount, 0)}<span className="text-lg font-bold ml-1 text-slate-400">h</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-full w-fit">
                    <Zap size={14} />
                    <span>Peak Utilization</span>
                  </div>
                </Card>

                <Card className="rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <Target size={100} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Efficiency Index</p>
                  <div className="text-4xl font-black tracking-tighter text-blue-600">
                    {(() => {
                      const pres = reportRecords.reduce((sum, r) => sum + r.count, 0);
                      const ot = reportRecords.reduce((sum, r) => sum + r.otCount, 0);
                      return pres > 0 ? ((pres / (pres + ot)) * 100).toFixed(1) : '0';
                    })()}%
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full w-fit">
                    <LayoutGrid size={14} />
                    <span>Std. Deviation</span>
                  </div>
                </Card>
              </div>

              {/* Data Visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl p-8 bg-white dark:bg-slate-900 pb-12">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black italic tracking-tighter uppercase">Distribution Analysis</h3>
                      <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Manpower by Entity</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-500">
                      <BarChart3 size={20} />
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportSummary}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                          dy={10}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="presence" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={30} name="Attendance" />
                        <Bar dataKey="ot" fill="#f97316" radius={[6, 6, 0, 0]} barSize={30} name="Overtime" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                        <Table size={18} />
                      </div>
                      <h3 className="text-lg font-black italic tracking-tighter uppercase">Detailed Summary</h3>
                    </div>
                    {previewLoading && <Loader2 className="animate-spin text-slate-400" size={18} />}
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                          <th className="py-4 px-6 text-[9px] font-black uppercase tracking-wider text-slate-400">Entity</th>
                          <th className="py-4 px-6 text-right text-[9px] font-black uppercase tracking-wider text-slate-400">Pres.</th>
                          <th className="py-4 px-6 text-right text-[9px] font-black uppercase tracking-wider text-slate-400">OT</th>
                          <th className="py-4 px-6 text-right text-[9px] font-black uppercase tracking-wider text-slate-400">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {reportSummary.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                            <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[120px]">{item.name}</td>
                            <td className="py-4 px-6 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">{item.presence}</td>
                            <td className="py-4 px-6 text-right font-mono font-bold text-orange-500 text-xs">{item.ot}</td>
                            <td className="py-4 px-6 text-right font-mono text-indigo-600 dark:text-indigo-400 text-xs font-black">
                              {item.presence + item.ot}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card className="rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl p-10 bg-white dark:bg-slate-900 min-h-[600px]">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase">Monthly Performance Heatmap</h3>
                  <p className="text-xs text-slate-400 font-bold tracking-[0.3em] uppercase mt-1">Personnel Intensity Matrix</p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-[1.5rem] text-emerald-500 shadow-lg shadow-emerald-500/10">
                  <CalendarDays size={28} />
                </div>
              </div>

              <div className="grid grid-cols-7 gap-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 pb-4">
                    {day}
                  </div>
                ))}
                
                {heatmapData.map((day, idx) => (
                  <div 
                    key={idx}
                    className={`relative aspect-square rounded-[1.25rem] border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                      !day.hasData 
                        ? 'border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed opacity-50' 
                        : 'border-white dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-default'
                    }`}
                    style={{
                      backgroundColor: day.hasData 
                        ? (day.intensity >= 0.9 ? 'rgb(16, 185, 129, 0.1)' : day.intensity >= 0.7 ? 'rgb(245, 158, 11, 0.05)' : 'rgb(239, 68, 68, 0.05)')
                        : undefined,
                      borderColor: day.hasData
                        ? (day.intensity >= 0.9 ? '#10b981' : day.intensity >= 0.7 ? '#f59e0b' : '#ef4444')
                        : undefined
                    }}
                  >
                    {day.hasData && (
                      <div 
                        className="absolute inset-x-0 bottom-0 transition-all duration-1000"
                        style={{ 
                          height: `${day.intensity * 100}%`,
                          backgroundColor: day.intensity >= 0.9 ? '#10b981' : day.intensity >= 0.7 ? '#f59e0b' : '#ef4444',
                          opacity: 0.1
                        }}
                      />
                    )}
                    <span className={`text-sm font-black italic leading-none z-10 ${!day.hasData ? 'text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                      {day.day}
                    </span>
                    {day.hasData && (
                      <span className="text-[10px] font-black mt-1 z-10 opacity-70">
                        {day.count}
                      </span>
                    )}
                    
                    <div className="absolute inset-0 bg-slate-900/95 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-20 text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        {format(day.fullDate, 'MMM d')}
                      </p>
                      <p className="text-xl font-black italic tracking-tighter leading-none">{day.count}</p>
                      <p className="text-[7px] font-bold uppercase tracking-tight text-emerald-400 mt-1">PERSONNEL</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Optimum (90%+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-lg shadow-amber-500/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shortage (70-90%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Critical (&lt;70%)</span>
                </div>
              </div>
            </Card>
          )}
          
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-12 rounded-[3.5rem] text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-1000">
              <Sparkles size={240} />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                <LayoutGrid size={16} className="text-yellow-400" />
                <span className="text-xs font-black uppercase tracking-[0.3em]">Operational Mastery</span>
              </div>
              <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none max-w-lg">
                Decision Quality <br />Data Structures
              </h3>
              <p className="text-slate-300 text-sm md:text-base max-w-xl leading-relaxed">
                Empowering industrial leads with high-fidelity visualization. Our reporting suite transforms volatile shift logs into actionable strategic intelligence.
              </p>
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">PDF standard</p>
                    <p className="text-sm font-bold">Exec Level</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Integrity</p>
                    <p className="text-sm font-bold">100% Audit Ready</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
