import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { EmployeeSummary, EmployeeDayRecord } from '../types';
import { format } from 'date-fns';
import { isShiftMismatch } from '../lib/shiftUtils';
import { Calendar as CalendarIcon, Search, ChevronRight, AlertTriangle, Info, ArrowUpDown, Clock, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from '../contexts/LanguageContext';

interface EmployeeListProps {
  summaries: EmployeeSummary[];
  allSummaries: EmployeeSummary[];
  latestDate?: Date;
  initialFilter?: 'all' | 'month' | 'week' | 'day';
  availableFilters: string[];
  globalTypeFilter: 'all' | 'idle_overbreak_wc';
  globalIncludeWc: boolean;
  globalIncludeIdle: boolean;
  globalIncludeNonMod: boolean;
  globalIncludeTardiness: boolean;
  globalIncludeMinorTardiness?: boolean;
  globalIncludeEarlyLeave: boolean;
  globalIncludeShort30Min?: boolean;
  globalIncludeCheck?: boolean;
  globalShiftFilter?: string[];
  globalFilterMajorOverbreaks: boolean;
}

function getAbsenceStatusText(s: EmployeeSummary, allSummaries: EmployeeSummary[], filteredRecords: EmployeeDayRecord[], latestDate: Date) {
  if (s.isOffboarded) {
    return { text: "Offboarded", isActive: false, isOffboarded: true };
  }

  const hasSL = filteredRecords.some(r => r.isSL);
  const hasLOA = filteredRecords.some(r => r.isLOA);
  const hasPTO = filteredRecords.some(r => r.isPTO);

  if (!hasSL && !hasLOA && !hasPTO) {
    return null;
  }

  let statusName = "";
  let checkProp: 'isSL' | 'isLOA' | 'isPTO' = 'isSL';
  if (hasSL) {
    statusName = "Sick Leave";
    checkProp = 'isSL';
  } else if (hasLOA) {
    statusName = "LOA";
    checkProp = 'isLOA';
  } else if (hasPTO) {
    statusName = "PTO (VAC)";
    checkProp = 'isPTO';
  }

  const fullEmp = allSummaries.find(emp => emp.employeeName === s.employeeName) || s;
  const sortedRecords = [...fullEmp.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
  
  const activeRecsInFilter = [...filteredRecords]
    .filter(r => r[checkProp])
    .sort((a, b) => a.date.localeCompare(b.date));

  if (activeRecsInFilter.length === 0) {
    return { text: statusName, isActive: false, isOffboarded: false };
  }

  const targetDate = activeRecsInFilter[activeRecsInFilter.length - 1].date;
  const targetIndex = sortedRecords.findIndex(r => r.date === targetDate);
  
  if (targetIndex === -1) {
    return { text: statusName, isActive: false, isOffboarded: false };
  }

  let startIndex = targetIndex;
  while (startIndex > 0) {
    const prev = sortedRecords[startIndex - 1];
    if (prev[checkProp] || prev.isOFF) {
      startIndex--;
    } else {
      break;
    }
  }

  let endIndex = targetIndex;
  while (endIndex < sortedRecords.length - 1) {
    const next = sortedRecords[endIndex + 1];
    // Stop at the last consecutive absence day. Don't include following OFF days in the range.
    if (next[checkProp]) {
      endIndex++;
    } else {
      break;
    }
  }

  let actualStart = startIndex;
  while (actualStart <= endIndex && !sortedRecords[actualStart][checkProp]) {
    actualStart++;
  }
  if (actualStart > endIndex) actualStart = startIndex;

  const startDateStr = sortedRecords[actualStart].date;
  const lastAbsenceDateStr = sortedRecords[endIndex].date;
  let returnDateStr = null;
  if (endIndex + 1 < sortedRecords.length) {
    returnDateStr = sortedRecords[endIndex + 1].date;
  }

  const formatDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}`;
  };

  const todayStr = latestDate.toLocaleDateString("en-CA");
  const isActive = todayStr >= startDateStr && (!returnDateStr || todayStr < returnDateStr);

  let text = statusName;
  if (lastAbsenceDateStr) {
     text = `${statusName} ${formatDate(startDateStr)} until ${formatDate(lastAbsenceDateStr)}`;
  } else {
     text = `${statusName} since ${formatDate(startDateStr)}`;
  }

  return { text, isActive, isOffboarded: false };
}

function isLeaveShift(sh: string) {
  if (!sh) return false;
  const upper = sh.toUpperCase();
  return upper === 'PTO' || upper.includes('VAC') || upper.includes('FÉRIAS') || upper === 'SL' || upper.includes('SICK') || upper.includes('MEDICO') || upper.includes('ATESTADO') || upper === 'LOA' || upper.includes('LICENÇA');
}

export function EmployeeList({ summaries, allSummaries, latestDate, initialFilter = 'all', availableFilters, globalTypeFilter, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalIncludeTardiness, globalIncludeMinorTardiness, globalIncludeEarlyLeave, globalIncludeShort30Min, globalIncludeCheck, globalShiftFilter, globalFilterMajorOverbreaks }: EmployeeListProps) {
  const { t } = useLanguage();
  const isWcOnly = globalTypeFilter === 'all' && globalIncludeWc && !globalIncludeShort30Min && !globalIncludeNonMod && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave;
  const isShort30MinOnly = globalTypeFilter === 'all' && globalIncludeShort30Min && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLob, setSelectedLob] = useState<string>('ALL');
  const [selectedLang, setSelectedLang] = useState<string>('ALL');
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [sortBy, setSortBy] = useState<'maiores' | 'menores' | 'alfabetica' | string>('maiores');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const normalizeName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\.,\-]/g, ' ');

  const lobs = Array.from(new Set(summaries.map(s => s.lob?.trim()).filter(Boolean))).filter(l => {
     if (!l) return false;
     const upper = l.toUpperCase();
     return !['CSR', 'BA', 'TL', 'RTA', 'QA', 'TRAINER', 'MANAGER', 'OS', 'LMG', 'LMG BADNESS', 'LMG ES', 'LMG LATAM'].includes(upper);
  }).sort() as string[];
  const languages = selectedLob === 'ALL' 
    ? [] 
    : Array.from(new Set(summaries.filter(s => s.lob === selectedLob).map(s => s.language?.toUpperCase().trim()).filter(Boolean))).sort() as string[];

  const filtered = summaries.filter(s => {
    const matchesSearch = normalizeName(s.employeeName).includes(normalizeName(searchTerm));
    const matchesLob = selectedLob === 'ALL' || s.lob === selectedLob;
    const matchesLang = selectedLang === 'ALL' || s.language?.toUpperCase().trim() === selectedLang;
    return matchesSearch && matchesLob && matchesLang;
  }).sort((a, b) => {
    // If using predefined sorts
    if (sortBy === 'maiores') return b.totalOverbreakMinutes - a.totalOverbreakMinutes;
    if (sortBy === 'menores') return a.totalOverbreakMinutes - b.totalOverbreakMinutes;
    if (sortBy === 'alfabetica') return a.employeeName.localeCompare(b.employeeName);
    
    // Custom column sort
    let aVal = 0, bVal = 0;
    if (sortBy === 'tasks') { aVal = a.totalTasks || 0; bVal = b.totalTasks || 0; }
    if (sortBy === 'meal') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0); }
    if (sortBy === 'short') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0); }
    if (sortBy === 'wellness') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0); }
    if (sortBy === 'praying') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0); }
    if (sortBy === 'wc') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0); }
    if (sortBy === 'idle') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0); }
    if (sortBy === 'tardiness') { aVal = a.totalTardinessMinutes; bVal = b.totalTardinessMinutes; }
    if (sortBy === 'earlyLeave') { aVal = a.totalEarlyLeaveMinutes; bVal = b.totalEarlyLeaveMinutes; }
    if (sortBy === 'absences') { aVal = a.totalAbsences || 0; bVal = b.totalAbsences || 0; }
    if (sortBy === 'short30Min') { aVal = a.totalShort30MinRecords || 0; bVal = b.totalShort30MinRecords || 0; }
    if (sortBy === 'nonMod') { 
        aVal = a.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => b.type === 'non_moderating').reduce((s, b) => s + b.durationMinutes, 0), 0); 
        bVal = b.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => b.type === 'non_moderating').reduce((s, b) => s + b.durationMinutes, 0), 0); 
    }
    if (sortBy === 'reviewAndAppeal') { aVal = a.totalReviewAndAppealMinutes; bVal = b.totalReviewAndAppealMinutes; }
    if (sortBy === 'awaitingTasks') { aVal = a.totalAwaitingTasksMinutes; bVal = b.totalAwaitingTasksMinutes; }
    if (sortBy === 'total') { aVal = a.totalOverbreakMinutes; bVal = b.totalOverbreakMinutes; }
    
    if (aVal === bVal) return 0;
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (column: string) => {
     if (sortBy === column) {
         setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
     } else {
         setSortBy(column);
         setSortDirection('desc'); // Default to descending when clicking a new column
     }
  };

  return (
    <>
    <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-2xl shadow-slate-200/40 border border-slate-200 flex flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0 p-3 border-b border-slate-100 bg-slate-50/80 z-20">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder={t('searchAgent')} 
                className="pl-11 h-11 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium shadow-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {lobs.length > 0 && (
              <select className="h-11 bg-white border border-slate-200 text-slate-700 rounded-xl px-3 text-xs font-bold w-full sm:w-auto shadow-sm outline-none cursor-pointer" value={selectedLob} onChange={e => { setSelectedLob(e.target.value); setSelectedLang('ALL'); }}>
                <option value="ALL">LOB's</option>
                {lobs.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {selectedLob !== 'ALL' && languages.length > 0 && (
              <select className="h-11 bg-white border border-slate-200 text-slate-700 rounded-xl px-3 text-xs font-bold w-full sm:w-auto shadow-sm outline-none cursor-pointer" value={selectedLang} onChange={e => setSelectedLang(e.target.value)}>
                <option value="ALL">All Languages</option>
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
        </div>
        
        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-white border text-sm font-bold border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
        >
           <option value="maiores">{t('biggestViolators')}</option>
           <option value="menores">{t('smallestViolators')}</option>
           <option value="alfabetica">{t('alphabeticalMatch')}</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50/95 backdrop-blur border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 tracking-widest sticky top-0 z-30 outline outline-1 outline-slate-200 shadow-sm">
                <tr>
                  <th className="py-2.5 pl-8 pr-4 font-black whitespace-nowrap">{String(t('agents') || '').toUpperCase()} ({filtered.length})</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group focus:outline-none" onClick={() => handleSort('tasks')}>TASKS {sortBy === 'tasks' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('meal')}>Meal {sortBy === 'meal' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('short')}>Short {sortBy === 'short' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('wellness')}>Well. {sortBy === 'wellness' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('praying')}>Pray. {sortBy === 'praying' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('nonMod')}>NON-MOD {sortBy === 'nonMod' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('reviewAndAppeal')}>R&A {sortBy === 'reviewAndAppeal' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('awaitingTasks')}>A.T {sortBy === 'awaitingTasks' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('wc')}>Organic {sortBy === 'wc' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('idle')}>IDLE {sortBy === 'idle' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('tardiness')}>TARDINESS {sortBy === 'tardiness' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('earlyLeave')}>EARLY LEAVE {sortBy === 'earlyLeave' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('absences')}>{String(t('absencesString') || '').toUpperCase()} {sortBy === 'absences' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('short30Min')}>{t('shortBreaks30Title')} (Dias) {sortBy === 'short30Min' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('total')}>{t('total')} {sortBy === 'total' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-2.5 pl-4 pr-8 text-right font-black whitespace-nowrap">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s, idx) => {
                  if (String(s.employeeName).toLowerCase().includes('elsa')) {
                      console.log('ELSA DEBUG:', JSON.parse(JSON.stringify({ 
                         totalTasks: s.totalTasks, 
                         dailyRecords: s.dailyRecords.map(r => ({ date: r.date, tasks: r.tasks, shortOverbreak: r.shortOverbreak })) 
                      })));
                  }
                  const hasMealOver = s.dailyRecords.some(r => r.mealOverbreak > 0);
                  const hasShortOver = s.dailyRecords.some(r => r.shortOverbreak > 0);
                  const hasWellnessOver = s.dailyRecords.some(r => r.wellnessOverbreak > 0);
                  const hasPrayingOver = s.dailyRecords.some(r => r.prayingOverbreak > 0);
                  const hasWcExc = s.wcAlerts > 0;
                  const hasIdleExc = s.idleAlerts > 0;
                  const hasTardiness = globalIncludeMinorTardiness 
                    ? s.dailyRecords.some(r => (r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15)
                    : s.dailyRecords.some(r => (r.tardinessMinutes || 0) >= 15);
                  const hasEarlyLeave = s.dailyRecords.some(r => (r.earlyLeaveMinutes || 0) > 0);
                  const isAlertRow = hasMealOver || hasShortOver || hasWellnessOver || hasPrayingOver || hasWcExc || hasIdleExc || hasTardiness || hasEarlyLeave;

                  const mealTotal = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
                  const shortTotal = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
                  const wellnessTotal = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
                  const prayingTotal = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
                  const nonModTotal = s.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => b.type === 'non_moderating').reduce((sum, b) => sum + b.durationMinutes, 0), 0);
                  const wcTotal = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
                  const idleTotal = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);
                  const tardinessTotal = s.dailyRecords.reduce((acc, r) => acc + (r.tardinessMinutes || 0), 0);
                  const earlyLeaveTotal = s.dailyRecords.reduce((acc, r) => acc + (r.earlyLeaveMinutes || 0), 0);
                  
                  const hasShiftMismatch = (!globalShiftFilter || globalShiftFilter.length === 0) 
                    ? s.dailyRecords.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift)) 
                    : false;

                  const isTotallyAbsent = s.dailyRecords.length > 0 && s.dailyRecords.every(r => r.isAbsence);

                  return (
                    <tr 
                      key={`${s.employeeName}-${idx}`} 
                      onClick={() => setSelectedEmp(allSummaries.find(all => all.employeeName === s.employeeName) || s)}
                      className={`cursor-pointer transition-all hover:bg-slate-50/80 group ${isAlertRow ? 'bg-rose-50/10' : 'bg-white'}`}
                    >
                      <td className="py-2.5 pl-8 pr-4 relative">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasIdleExc ? 'bg-red-500' : hasWcExc ? 'bg-amber-500' : 'bg-transparent'}`} />
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors ${hasIdleExc ? 'underline decoration-red-500/50 decoration-2 underline-offset-4' : hasWcExc ? 'underline decoration-amber-500/50 decoration-2 underline-offset-4' : ''} truncate max-w-[200px]`}>
                            {s.employeeName}
                          </p>
                          {hasShiftMismatch && (
                            <div title={t('workedOutsideShiftDesc')} className="flex items-center justify-center p-0.5 rounded-md bg-amber-100 text-amber-600 border border-amber-200 shadow-sm shrink-0">
                              <Clock size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        {s.email && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{s.email}</p>
                          </div>
                        )}
                        {(() => {
                          const overrideStatus = getAbsenceStatusText(s, allSummaries, s.dailyRecords, latestDate);

                          const schedShifts = Array.from(new Set(s.dailyRecords.map(r => r.scheduledShift || r.inferredShift).filter(Boolean)));
                          const realSchedShifts = schedShifts.filter(sh => sh.toLowerCase() !== 'off');
                          let dispShift = s.shift;
                          let shiftDiffers = false;
                          
                          if (realSchedShifts.length === 1) {
                              dispShift = realSchedShifts[0];
                          } else if (realSchedShifts.length > 1) {
                              dispShift = "Vários Horários";
                          } else if (schedShifts.length > 0 && !isLeaveShift(schedShifts[0])) {
                              dispShift = schedShifts[0];
                          } else {
                              dispShift = s.shift;
                          }
                          
                          let statusNote = "";
                          if (!overrideStatus || overrideStatus.isOffboarded) {
                            if (s.isATT) statusNote = "ATT (Attrition)";
                            else if (s.isSUSPP) statusNote = "SUSPP (Suspended)";
                            else if (s.isOFF) statusNote = "OFF (Day Off)";
                          }

                          // Check if any specific day has a shift discrepancy
                          if (s.dailyRecords.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift))) {
                              shiftDiffers = true;
                          }

                          return ((s.role && !['OS', 'CSR'].includes(s.role.toUpperCase())) || s.lob || s.language || dispShift || s.supervisor || statusNote || overrideStatus) ? (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex flex-wrap gap-1">
                              {s.role && !['OS', 'CSR'].includes(s.role.toUpperCase()) && <span className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest border border-slate-200">{s.role}</span>}
                              {s.lob && <span className="bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.lob}</span>}
                              {s.language && <span className="bg-purple-50 text-purple-600 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.language}</span>}
                              {dispShift && !isLeaveShift(dispShift) && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest ${s.isOffboarded || s.isATT ? 'bg-slate-200 text-slate-900 border border-slate-300' : shiftDiffers ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {dispShift} {!s.isOffboarded && !s.isATT && shiftDiffers && '(CHECK)'}
                                </span>
                              )}
                              {s.supervisor && <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold">TL: {s.supervisor}</span>}
                            </div>
                            {overrideStatus && (
                               <div>
                                 <span className={`text-[10px] font-black px-1.5 py-0.5 rounded tracking-widest ${overrideStatus.isOffboarded ? 'bg-slate-200 text-slate-800' : overrideStatus.isActive ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                   {overrideStatus.text}
                                 </span>
                               </div>
                            )}
                            {statusNote && (
                              <p className="text-[9px] font-black text-rose-500 uppercase italic tracking-tighter">
                                {statusNote}
                              </p>
                            )}
                          </div>
                          ) : null;
                        })()}
                      </td>

                      <td className="py-2.5 px-2 text-center" title={s.totalTasks !== undefined && s.totalTasks > 0 ? `${s.totalTasks} tasks` : undefined}>
                        {s.totalTasks !== undefined && s.totalTasks > 0 ? (
                           <span className="inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-black">
                             {s.totalTasks}
                           </span>
                        ) : (
                           <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      
                      <td className="py-2.5 px-2 text-center" title={mealTotal > 0 ? `${mealTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasMealOver ? 'bg-rose-100 text-rose-700 font-black' : (isTotallyAbsent && mealTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {mealTotal > 0 ? `${mealTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={shortTotal > 0 ? `${shortTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasShortOver ? 'bg-rose-100 text-rose-700 font-black' : (isTotallyAbsent && shortTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {shortTotal > 0 ? `${shortTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={wellnessTotal > 0 ? `${wellnessTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasWellnessOver ? 'bg-rose-100 text-rose-700 font-black' : (isTotallyAbsent && wellnessTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {wellnessTotal > 0 ? `${wellnessTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={prayingTotal > 0 ? `${prayingTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasPrayingOver ? 'bg-rose-100 text-rose-700 font-black' : (isTotallyAbsent && prayingTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {prayingTotal > 0 ? `${prayingTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={nonModTotal > 0 ? `${nonModTotal}m em NON-MOD` : '0m em NON-MOD'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${nonModTotal > 0 ? 'bg-teal-50 text-teal-700 font-black border border-teal-200' : 'text-slate-300 font-bold'}`}>
                          {nonModTotal > 0 ? `${nonModTotal}m` : (isTotallyAbsent ? '-' : '0m')}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={s.totalReviewAndAppealMinutes > 0 ? `${s.totalReviewAndAppealMinutes}m em R&A` : '0m em R&A'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${s.totalReviewAndAppealMinutes > 0 ? 'bg-purple-50 text-purple-700 font-black border border-purple-200' : 'text-slate-300 font-bold'}`}>
                          {s.totalReviewAndAppealMinutes > 0 ? `${s.totalReviewAndAppealMinutes}m` : (isTotallyAbsent ? '-' : '0m')}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={s.totalAwaitingTasksMinutes > 0 ? `${s.totalAwaitingTasksMinutes}m em A.T` : '0m em A.T'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${s.totalAwaitingTasksMinutes > 0 ? 'bg-indigo-50 text-indigo-700 font-black border border-indigo-200' : 'text-slate-300 font-bold'}`}>
                          {s.totalAwaitingTasksMinutes > 0 ? `${s.totalAwaitingTasksMinutes}m` : (isTotallyAbsent ? '-' : '0m')}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={wcTotal > 0 ? `${wcTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasWcExc ? 'bg-amber-100 text-amber-700 font-black border border-amber-200' : (isTotallyAbsent && wcTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {wcTotal > 0 ? `${wcTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={idleTotal > 0 ? `${idleTotal}m ${t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${hasIdleExc ? 'bg-red-100 text-red-700 font-black border border-red-200' : (isTotallyAbsent && idleTotal === 0 ? 'text-slate-300 font-bold' : 'bg-emerald-50 text-emerald-600 font-bold')}`}>
                          {idleTotal > 0 ? `${idleTotal}m` : (isTotallyAbsent ? '-' : t('okShort'))}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={tardinessTotal > 0 ? `${tardinessTotal}m atraso` : 'No tardiness'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${tardinessTotal > 0 ? 'bg-orange-100 text-orange-700 font-black border border-orange-200' : 'text-slate-300 font-bold'}`}>
                          {tardinessTotal > 0 ? `${tardinessTotal}m` : (isTotallyAbsent ? '-' : '0m')}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={earlyLeaveTotal > 0 ? `${earlyLeaveTotal}m saída antecipada` : 'No early leave'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${earlyLeaveTotal > 0 ? 'bg-orange-100 text-orange-700 font-black border border-orange-200' : 'text-slate-300 font-bold'}`}>
                          {earlyLeaveTotal > 0 ? `${earlyLeaveTotal}m` : (isTotallyAbsent ? '-' : '0m')}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={(s.totalAbsences || 0) > 0 ? `${s.totalAbsences} ${t('absencesString').toLowerCase()} no período` : t('withoutRecords')}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${(s.totalAbsences || 0) > 0 ? 'bg-red-100 text-red-700 font-black border border-red-200' : 'text-slate-300 font-bold'}`}>
                          {(s.totalAbsences || 0) > 0 ? s.totalAbsences : '0'}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={(s.totalShort30MinRecords || 0) > 0 ? `${s.totalShort30MinRecords} dias` : '0 dias'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${(s.totalShort30MinRecords || 0) > 0 ? 'bg-emerald-100/70 border border-emerald-200 text-emerald-800 font-black' : 'text-slate-300 font-bold'}`}>
                          {s.totalShort30MinRecords || 0}d
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center" title={s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m ${isWcOnly ? 'Organic' : t('overbreakExceeded')}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.5 rounded transition-colors ${s.totalOverbreakMinutes > 0 ? (isWcOnly ? 'bg-amber-100 border border-amber-200 text-amber-600 font-black' : 'bg-rose-100 text-rose-700 font-black') : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m` : t('okShort')}
                        </span>
                      </td>

                      <td className="py-2.5 pl-4 pr-8 text-right">
                        {s.isATT ? (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">ATT</span>
                        ) : s.isOffboarded ? (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] font-black uppercase tracking-tighter">OFFBOARDED</span>
                        ) : s.isLOA ? (
                            <span className="inline-block px-1.5 py-0.5 bg-indigo-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">LOA</span>
                        ) : s.isPTO ? (
                            <span className="inline-block px-1.5 py-0.5 bg-cyan-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">PTO</span>
                        ) : s.isSL ? (
                            <span className="inline-block px-1.5 py-0.5 bg-rose-400 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">SL</span>
                        ) : s.isSUSPP ? (
                            <span className="inline-block px-1.5 py-0.5 bg-red-700 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">SUSPP</span>
                        ) : s.isOFF ? (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">OFF</span>
                        ) : isWcOnly && s.totalOverbreakMinutes > 0 ? (
                           <span className="inline-block px-1.5 py-0.5 bg-amber-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter">ORGANIC TOTAL</span>
                        ) : hasIdleExc ? (
                          <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase tracking-tighter">IDLE</span>
                        ) : hasWcExc ? (
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase tracking-tighter">ORGANIC EXC.</span>
                        ) : s.totalOverbreakMinutes > 30 ? (
                          <span className="inline-block px-1.5 py-0.5 bg-rose-600 text-white rounded-md text-[10px] font-black uppercase tracking-tighter">OVERBREAK</span>
                        ) : s.totalOverbreakMinutes > 0 ? (
                          <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase tracking-tighter">{t('alert')}</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-tighter">{t('stable')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-32">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">{t('noMatchAgent')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center px-8 shrink-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {t('showingRecords')} {filtered.length} {t('outOf')} {summaries.length} {t('recordsProcessed')}
          </p>
        </div>
      </div>

      <Dialog open={!!selectedEmp} onOpenChange={(open) => !open && setSelectedEmp(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col rounded-[2rem] border-slate-200 p-0 overflow-hidden shadow-2xl">
           {selectedEmp && <EmployeeDetail summary={selectedEmp} allSummaries={allSummaries} latestDate={latestDate || new Date()} initialFilter={initialFilter} availableFilters={availableFilters} t={t} globalTypeFilter={globalTypeFilter} globalIncludeWc={globalIncludeWc} globalIncludeIdle={globalIncludeIdle} globalIncludeNonMod={globalIncludeNonMod} globalIncludeTardiness={globalIncludeTardiness} globalIncludeMinorTardiness={globalIncludeMinorTardiness} globalIncludeEarlyLeave={globalIncludeEarlyLeave} globalIncludeShort30Min={globalIncludeShort30Min} globalIncludeCheck={globalIncludeCheck} globalFilterMajorOverbreaks={globalFilterMajorOverbreaks} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmployeeDetail({ summary: s, allSummaries, latestDate, initialFilter, availableFilters, t, globalTypeFilter, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalIncludeTardiness, globalIncludeMinorTardiness, globalIncludeEarlyLeave, globalIncludeShort30Min, globalIncludeCheck, globalFilterMajorOverbreaks }: { summary: EmployeeSummary; allSummaries: EmployeeSummary[]; latestDate: Date, initialFilter: string, availableFilters: string[], t: any, globalTypeFilter: 'all' | 'idle_overbreak_wc', globalIncludeWc: boolean, globalIncludeIdle: boolean, globalIncludeNonMod: boolean, globalIncludeTardiness: boolean, globalIncludeMinorTardiness?: boolean, globalIncludeEarlyLeave: boolean, globalIncludeShort30Min?: boolean, globalIncludeCheck?: boolean, globalFilterMajorOverbreaks: boolean }) {
  const today = latestDate;
  
  const getInitialView = () => {
    if (initialFilter === 'month' && availableFilters.includes('month')) return 'month';
    if (initialFilter === 'week' && availableFilters.includes('week')) return 'week';
    if (initialFilter === 'yesterday' && availableFilters.includes('yesterday')) return 'yesterday';
    if (initialFilter === 'day' && availableFilters.includes('day')) return 'today';
    
    if (availableFilters.includes('day')) return 'today';
    if (availableFilters.includes('yesterday')) return 'yesterday';
    if (availableFilters.includes('week')) return 'week';
    if (availableFilters.includes('month')) return 'month';
    return 'today';
  };

  const [view, setView] = useState<'today' | 'yesterday' | 'week' | 'month'>(getInitialView());
  const [onlyExceptions, setOnlyExceptions] = useState(
    globalTypeFilter === 'idle_overbreak_wc' ? true : false
  );
  const [includeWc, setIncludeWc] = useState(globalIncludeWc);
  const [includeIdle, setIncludeIdle] = useState(globalIncludeIdle);
  const [filterNm, setFilterNm] = useState(globalIncludeNonMod);
  const [includeTardiness, setIncludeTardiness] = useState(globalIncludeTardiness);
  const [includeMinorTardiness, setIncludeMinorTardiness] = useState(globalIncludeMinorTardiness || false);
  const [includeEarlyLeave, setIncludeEarlyLeave] = useState(globalIncludeEarlyLeave);
  const [includeShort30Min, setIncludeShort30Min] = useState(globalIncludeShort30Min || false);
  const [includeCheck, setIncludeCheck] = useState(globalIncludeCheck || false);

  const fullSummary = allSummaries.find(as => as.employeeName === s.employeeName) || s;
  
  let records = fullSummary.dailyRecords;
  
  const isShiftCrossingMidnight = (shiftStr: string | null | undefined) => {
    if (!shiftStr) return false;
    let cleaned = shiftStr.replace(/\s+/g, '').toUpperCase();
    
    // Convert AM/PM to 24h before removing letters
    const parseTime = (timeStr: string) => {
        let isPM = timeStr.includes('PM');
        let isAM = timeStr.includes('AM');
        let t = timeStr.replace(/[A-Z]/g, '').replace(':', '.');
        let parts = t.split('.');
        let h = parseInt(parts[0]) || 0;
        let m = parseInt(parts[1]) || 0;
        if (isPM && h !== 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + m;
    };

    const times = cleaned.split('-');
    if (times.length === 2) {
        let startTotal = parseTime(times[0]);
        let endTotal = parseTime(times[1]);
        if (endTotal <= startTotal) return true;
    }
    return false;
  };

  if (view === 'month') {
    records = fullSummary.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  } else if (view === 'week') {
    const dow = today.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMon);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    records = fullSummary.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return d >= startOfWeek && d <= endOfWeek;
    });
  } else if (view === 'today') {
    records = fullSummary.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
      
      if (isYesterday && (isShiftCrossingMidnight(r.scheduledShift) || isShiftCrossingMidnight(r.inferredShift))) return true;
      
      if (isToday) {
          const isNightShift = isShiftCrossingMidnight(r.scheduledShift) || isShiftCrossingMidnight(r.inferredShift);
          if (isNightShift) {
              const hasActivity = r.totalWorkTimeMillis > 0 || r.breaks.length > 0;
              let shiftStartMins = 0;
              const schedUpper = String(r.scheduledShift || r.inferredShift || '').replace(/\s+/g, '').toUpperCase();
              const times = schedUpper.split('-');
              if (times.length > 0) {
                 const t = times[0];
                 const isPM = t.includes('PM');
                 const isAM = t.includes('AM');
                 let parts = t.replace(/[A-Z]/g, '').replace(':', '.').split('.');
                 let h = parseInt(parts[0]) || 0;
                 let m = parseInt(parts[1]) || 0;
                 if (isPM && h !== 12) h += 12;
                 if (isAM && h === 12) h = 0;
                 shiftStartMins = h * 60 + m;
              }
              
              const currentMins = today.getHours() * 60 + today.getMinutes();
              if (!hasActivity && shiftStartMins > currentMins) {
                  return false;
              }
          }
          return true;
      }
      return false;
    });
  } else if (view === 'yesterday') {
    records = fullSummary.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
      
      const beforeYesterday = new Date(yesterday);
      beforeYesterday.setDate(beforeYesterday.getDate() - 1);
      const isBeforeYesterday = d.getDate() === beforeYesterday.getDate() && d.getMonth() === beforeYesterday.getMonth() && d.getFullYear() === beforeYesterday.getFullYear();

      if (isYesterday) return true;
      if (isBeforeYesterday && (isShiftCrossingMidnight(r.scheduledShift) || isShiftCrossingMidnight(r.inferredShift))) return true;
      return false;
    });
  }

  const viewRecords = records;
  const hasExceptionsData = viewRecords.some(r => r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0 || r.wcDuration > 10 || r.idleOverbreak > 0);
  const hasOrganicData = viewRecords.some(r => r.wcDuration > 0);
  const hasNonModData = viewRecords.some(r => r.breaks.some(b => b.type === 'non_moderating' || b.type === 'forgot_status'));
  const hasTardinessData = viewRecords.some(r => (r.tardinessMinutes || 0) > 0);
  const hasEarlyLeaveData = viewRecords.some(r => (r.earlyLeaveMinutes || 0) > 0);
  const hasIdleData = viewRecords.some(r => r.idleDuration > 0);
  const hasCheckData = viewRecords.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift));

  const anyLocalFilterActive = onlyExceptions || includeWc || includeIdle || filterNm || includeTardiness || includeEarlyLeave || includeShort30Min || includeCheck;
  if (anyLocalFilterActive) {
    records = records.filter(r => {
      let keep = false;
      const hasAnyOverbreak = r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0 || r.wcDuration > 10 || r.idleOverbreak > 0 || (includeMinorTardiness ? ((r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15) : (r.tardinessMinutes || 0) >= 15) || (r.earlyLeaveMinutes || 0) > 0;
      
      if (onlyExceptions && hasAnyOverbreak) keep = true;
      if (includeWc && r.wcDuration > 0) keep = true;
      if (includeIdle && r.idleDuration > 0) keep = true;
      if (filterNm && r.breaks.some(b => b.type === 'non_moderating' || b.type === 'forgot_status')) keep = true;
      if (includeTardiness) {
          if (includeMinorTardiness) {
              if ((r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15) keep = true;
          } else {
              if ((r.tardinessMinutes || 0) >= 15) keep = true;
          }
      }
      if (includeEarlyLeave && (r.earlyLeaveMinutes || 0) > 0) keep = true;
      if (includeShort30Min && r.hasSingleShort30m) keep = true;
      if (includeCheck && isShiftMismatch(r.scheduledShift, r.inferredShift)) keep = true;
      
      return keep;
    });
  }

  // Se SOMENTE o respectivo filtro estiver selecionado localmente em relacao as outras opcoes de overbreaks/excecoes
  const isWcOnly = includeWc && !includeShort30Min && !includeIdle && !filterNm && !includeTardiness && !includeEarlyLeave && !includeCheck && globalTypeFilter === 'all';
  const isIdleOnly = includeIdle && !includeShort30Min && !includeWc && !filterNm && !includeTardiness && !includeEarlyLeave && !includeCheck && globalTypeFilter === 'all';
  const isTardinessOnly = includeTardiness && !includeMinorTardiness && !includeShort30Min && !includeIdle && !includeWc && !filterNm && !includeEarlyLeave && !includeCheck && globalTypeFilter === 'all';
  const isMinorTardinessOnly = includeTardiness && includeMinorTardiness && !includeShort30Min && !includeIdle && !includeWc && !filterNm && !includeEarlyLeave && !includeCheck && globalTypeFilter === 'all';
  const isEarlyLeaveOnly = includeEarlyLeave && !includeShort30Min && !includeIdle && !includeWc && !filterNm && !includeTardiness && !includeCheck && globalTypeFilter === 'all';
  const isShort30MinOnly = includeShort30Min && !includeEarlyLeave && !includeIdle && !includeWc && !filterNm && !includeTardiness && !includeCheck && globalTypeFilter === 'all';
  const isCheckOnly = includeCheck && !includeShort30Min && !includeEarlyLeave && !includeIdle && !includeWc && !filterNm && !includeTardiness && globalTypeFilter === 'all';

  const totalPeriodOverbreak = records.reduce((acc, r) => {
    if (isWcOnly) return acc + r.wcDuration;
    if (isIdleOnly) return acc + r.idleDuration;

    let dayOverbreak = r.mealOverbreak + r.shortOverbreak + r.wellnessOverbreak + r.prayingOverbreak;
    if (includeIdle) dayOverbreak += r.idleOverbreak;
    if (includeWc) dayOverbreak += r.wcOverbreak;
    return acc + dayOverbreak;
  }, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-slate-900 text-white p-6 shrink-0 relative z-10 w-full">
        <DialogHeader>
          <div className="flex flex-col gap-4">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shrink-0">
                   {String(s.employeeName || '').substring(0, 2).toUpperCase()}
                 </div>
                 <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-2xl font-black text-left">{s.employeeName}</DialogTitle>
                      <button
                           onClick={() => {
                               let periodStr = '';
                               if (records.length > 0) {
                                   const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
                                   periodStr = sorted.length === 1 ? sorted[0].date : `${sorted[0].date} to ${sorted[sorted.length - 1].date}`;
                               } else {
                                   periodStr = 'N/A';
                               }

                               const fmtD = (dStr: string) => {
                                   const dObj = new Date(dStr + 'T12:00:00');
                                   const day = dObj.getDate();
                                   const m = dObj.toLocaleDateString('en-US', { month: 'long' });
                                   const ord = (day > 3 && day < 21) ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][day % 10];
                                   return `${m} ${day}${ord}`;
                               };

                               const reports = [];

                               // Idle Time
                               if (includeIdle) {
                                   const totalIdle = records.reduce((acc, r) => acc + r.idleDuration, 0);
                                   if (totalIdle > 0) {
                                       let occurrences = '';
                                       records.filter(r => r.idleDuration > 0).forEach(r => {
                                           const idleBreaks = (r.breaks || []).filter(b => b.type === 'idle');
                                           if (idleBreaks.length > 0) {
                                               const totalMin = Math.round(idleBreaks.reduce((acc, b) => acc + b.durationMinutes, 0));
                                               const details = idleBreaks.map(b => {
                                                   const start = `${b.startTime.getHours().toString().padStart(2, '0')}:${b.startTime.getMinutes().toString().padStart(2, '0')}`;
                                                   const end = `${b.endTime.getHours().toString().padStart(2, '0')}:${b.endTime.getMinutes().toString().padStart(2, '0')}`;
                                                   return `${start} ~ ${end} [${Math.round(b.durationMinutes)} min]`;
                                               }).join(' | ');
                                               occurrences += `  • ${fmtD(r.date)}: ${totalMin} minutes (${details})\n`;
                                           }
                                       });
                                       reports.push({
                                           title: "Idle Time",
                                           totalStr: `${Math.floor(totalIdle / 60)}h ${totalIdle % 60}m`,
                                           occurrences
                                       });
                                   }
                               }

                               // Organic Excess
                               if (includeWc) {
                                   const wcRecords = records.filter(r => r.wcOverbreak > 0);
                                   if (wcRecords.length > 0) {
                                       const totalWc = wcRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
                                       let occurrences = '';
                                       wcRecords.forEach(r => {
                                           let accWc = 0;
                                           const wcBreaks = (r.breaks || []).filter(b => b.type === 'wc');
                                           const details: string[] = [];
                                           wcBreaks.forEach(b => {
                                               let oldAcc = accWc;
                                               accWc += b.durationMinutes;
                                               if (accWc > 25) {
                                                   let exceeded = accWc - Math.max(oldAcc, 25);
                                                   if (exceeded > 0) {
                                                       const start = `${b.startTime.getHours().toString().padStart(2, '0')}:${b.startTime.getMinutes().toString().padStart(2, '0')}`;
                                                       const end = `${b.endTime.getHours().toString().padStart(2, '0')}:${b.endTime.getMinutes().toString().padStart(2, '0')}`;
                                                       details.push(`${start} ~ ${end} [${Math.round(exceeded)} min exceeded]`);
                                                   }
                                               }
                                           });
                                           if (details.length > 0) {
                                               occurrences += `  • ${fmtD(r.date)}: ${Math.round(r.wcOverbreak)} minutes exceeded (${details.join(' | ')})\n`;
                                           }
                                       });
                                       reports.push({
                                           title: "Organic Break Excess (Allowed: 25m/day)",
                                           totalStr: `${Math.floor(totalWc / 60)}h ${totalWc % 60}m`,
                                           occurrences
                                       });
                                   }
                               }

                               // Overbreak
                               if (onlyExceptions) {
                                   const overbreakRecords = records.filter(r => r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0);
                                   if (overbreakRecords.length > 0) {
                                       const totalOver = overbreakRecords.reduce((acc, r) => acc + r.mealOverbreak + r.shortOverbreak + r.wellnessOverbreak + r.prayingOverbreak, 0);
                                       let occurrences = '';
                                       overbreakRecords.forEach(r => {
                                           let accMeal = 0, accShort = 0, accWell = 0, accPray = 0;
                                           const types = ['meal', 'short', 'wellness', 'praying'];
                                           const obBreaks = (r.breaks || []).filter(b => types.includes(b.type));
                                           const details: string[] = [];
                                           obBreaks.forEach(b => {
                                               let lim = 0;
                                               let acc = 0;
                                               if (b.type === 'meal') { lim = 60; accMeal += b.durationMinutes; acc = accMeal; }
                                               else if (b.type === 'short') { lim = 20; accShort += b.durationMinutes; acc = accShort; }
                                               else if (b.type === 'wellness') { lim = 10; accWell += b.durationMinutes; acc = accWell; }
                                               else if (b.type === 'praying') { lim = 15; accPray += b.durationMinutes; acc = accPray; }
                                               
                                               let oldAcc = acc - b.durationMinutes;
                                               if (acc > lim) {
                                                   let exceeded = acc - Math.max(oldAcc, lim);
                                                   if (exceeded > 0) {
                                                       const start = `${b.startTime.getHours().toString().padStart(2, '0')}:${b.startTime.getMinutes().toString().padStart(2, '0')}`;
                                                       const end = `${b.endTime.getHours().toString().padStart(2, '0')}:${b.endTime.getMinutes().toString().padStart(2, '0')}`;
                                                       const typeNames = { meal: 'Meal', short: 'Short', wellness: 'Wellness', praying: 'Praying' };
                                                       details.push(`${typeNames[b.type as keyof typeof typeNames]} ${start} ~ ${end} [${Math.round(exceeded)} min exceeded]`);
                                                   }
                                               }
                                           });
                                           if (details.length > 0) {
                                               const totalExceeded = Math.round(r.mealOverbreak + r.shortOverbreak + r.wellnessOverbreak + r.prayingOverbreak);
                                               occurrences += `  • ${fmtD(r.date)}: ${totalExceeded} minutes exceeded (${details.join(' | ')})\n`;
                                           }
                                       });
                                       reports.push({
                                           title: "Standard Overbreak (Meal: 60m, Short: 20m, Wellness: 10m)",
                                           totalStr: `${Math.floor(totalOver / 60)}h ${totalOver % 60}m`,
                                           occurrences
                                       });
                                   }
                               }

                               // Tardiness
                               if (includeTardiness) {
                                   const tardyRecords = records.filter(r => (r.tardinessMinutes || 0) > 0);
                                   if (tardyRecords.length > 0) {
                                       const totalTardiness = tardyRecords.reduce((acc, r) => acc + (r.tardinessMinutes || 0), 0);
                                       let occurrences = tardyRecords.map(r => {
                                           const actualStart = r.actualStartTime ? `${new Date(r.actualStartTime).getHours().toString().padStart(2, '0')}:${new Date(r.actualStartTime).getMinutes().toString().padStart(2, '0')}` : 'N/A';
                                           return `  • ${fmtD(r.date)}: ${r.tardinessMinutes} minutes (Shift: ${r.scheduledShift || r.inferredShift || 'N/A'} | Clock In: ${actualStart})`;
                                       }).join('\n');
                                       occurrences += '\n';
                                       reports.push({
                                           title: "Tardiness",
                                           totalStr: `${Math.floor(totalTardiness / 60)}h ${totalTardiness % 60}m`,
                                           occurrences
                                       });
                                   }
                               }

                               // Early Leave
                               if (includeEarlyLeave) {
                                   const earlyRecords = records.filter(r => (r.earlyLeaveMinutes || 0) > 0);
                                   if (earlyRecords.length > 0) {
                                       const totalEarly = earlyRecords.reduce((acc, r) => acc + (r.earlyLeaveMinutes || 0), 0);
                                       let occurrences = earlyRecords.map(r => {
                                           const actualEnd = r.actualEndTime ? `${new Date(r.actualEndTime).getHours().toString().padStart(2, '0')}:${new Date(r.actualEndTime).getMinutes().toString().padStart(2, '0')}` : 'N/A';
                                           return `  • ${fmtD(r.date)}: ${r.earlyLeaveMinutes} minutes (Shift: ${r.scheduledShift || r.inferredShift || 'N/A'} | Clock Out: ${actualEnd})`;
                                       }).join('\n');
                                       occurrences += '\n';
                                       reports.push({
                                           title: "Early Leave",
                                           totalStr: `${Math.floor(totalEarly / 60)}h ${totalEarly % 60}m`,
                                           occurrences
                                       });
                                   }
                               }

                               let subjects = reports.map(r => r.title);
                               const subjStr = subjects.length > 1 ? "Timeline Exceptions" : (subjects[0] || "Timeline Review");
                               const subj = `${subjStr} - ${s.employeeName}`;

                               const firstName = s.employeeName ? s.employeeName.split(' ')[0] : 'Team Member';
                               
                               let body = `Hello ${firstName},\n\nI hope you're doing well.\n\nWhile reviewing your timeline for the period (${periodStr}), I noticed some exceeded times that we need to align on:\n\n`;
                               
                               if (reports.length > 0) {
                                   reports.forEach(report => {
                                       body += `Daily Total (${report.title}):\n\n${report.occurrences}\n`;
                                   });
                                   body += `Could you please check your timeline for these specific times and clarify what happened?\n\n`;
                               } else {
                                   body += `Please review your timeline to ensure all activities are correctly logged.\n\n`;
                               }

                               body += `Let me know if you have any questions.\n\nBest regards,`;

                               const tlEmail = s.tl ? `${s.tl.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '.')}@concentrix.com` : '';
                               const ccList = ["sofia.fernandes@concentrix.com", tlEmail].filter(e => e).join(',');
                               
                               const mailto = `mailto:${s.email || ''}?cc=${encodeURIComponent(ccList)}&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
                               window.location.href = mailto;
                           }}
                           className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-indigo-500 hover:text-white transition-colors border border-slate-700 ml-1"
                           title="Send Report via Email"
                      >
                           <Mail size={16} />
                      </button>
                    </div>
                    {s.email && <p className="text-slate-400 text-xs mt-0.5">{s.email}</p>}
                    {/* */}
                   {(() => {
                       const overrideStatus = getAbsenceStatusText(s, allSummaries, records, latestDate);
                       const schedShifts = Array.from(new Set(records.map(r => r.scheduledShift || r.inferredShift).filter(Boolean)));
                       const realSchedShifts = schedShifts.filter(sh => sh.toLowerCase() !== 'off');
                       let dispShift = s.shift;
                       if (realSchedShifts.length === 1) {
                           dispShift = realSchedShifts[0];
                       } else if (realSchedShifts.length > 1) {
                           dispShift = "Vários Horários";
                       } else if (schedShifts.length > 0 && !isLeaveShift(schedShifts[0])) {
                           dispShift = schedShifts[0];
                       } else {
                           dispShift = s.shift;
                       }
                       return ((s.role && !['OS', 'CSR'].includes(s.role.toUpperCase())) || s.lob || s.language || dispShift || s.supervisor || overrideStatus) ? (
                     <div className="flex flex-col gap-1 mt-2">
                       <div className="flex flex-wrap gap-1">
                         {s.role && !['OS', 'CSR'].includes(s.role.toUpperCase()) && <span className="bg-slate-700 text-slate-300 border border-slate-500 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.role}</span>}
                         {s.lob && <span className="bg-blue-50/10 text-blue-300 border border-blue-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.lob}</span>}
                         {s.language && <span className="bg-purple-50/10 text-purple-300 border border-purple-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.language}</span>}
                         {dispShift && !isLeaveShift(dispShift) && <span className={`border text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest ${s.dailyRecords.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift)) ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-emerald-50/10 text-emerald-300 border-emerald-500/30'}`}>{dispShift} {s.dailyRecords.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift)) && '(CHECK)'}</span>}
                         {s.supervisor && <span className="bg-slate-800 text-slate-300 border border-slate-600 text-[9px] px-1.5 py-0.5 rounded font-bold">TL: {s.supervisor}</span>}
                       </div>
                       {overrideStatus && (
                          <div className="mt-0.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded tracking-widest ${overrideStatus.isOffboarded ? 'bg-slate-800 text-slate-200 border-slate-600 border' : overrideStatus.isActive ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 border' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 border'}`}>
                              {overrideStatus.text}
                            </span>
                          </div>
                       )}
                     </div>
                   ) : null;
                   })()}
                   <div className="flex items-center gap-3 mt-2">
                     <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">{t('auditLogComplete')}</p>
                   </div>
                 </div>
               </div>
             </div>
                 
             <div className="flex flex-wrap flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <div className="flex flex-col w-full gap-2">
                  <div className="flex flex-wrap bg-slate-800 rounded-md p-1 border border-slate-700 w-full gap-1">
                    {(['today', 'yesterday', 'week', 'month'] as const)
                      .filter(v => {
                        if (v === 'today') return availableFilters.includes('day');
                        if (v === 'month') return true; // ALways allow Current Month
                        return availableFilters.includes(v);
                      })
                      .map(v => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`flex-1 min-w-[60px] px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors flex justify-center items-center gap-1.5 ${view === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                      >
                        {v === 'today' ? t('filterDay') : v === 'yesterday' ? t('filterYesterday') : v === 'week' ? t('filterWeek') : t('filterMonth')}
                      </button>
                    ))}
                  </div>
  
                  {!isWcOnly && (
                    <div className="flex flex-wrap bg-slate-800 rounded-md p-1 border border-slate-700 w-full gap-1 justify-center">
                          {hasExceptionsData && (
                            <button
                              onClick={() => setOnlyExceptions(!onlyExceptions)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${onlyExceptions ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              {t('exceptions')}
                            </button>
                          )}
                          {hasOrganicData && (
                            <button
                              onClick={() => setIncludeWc(!includeWc)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${includeWc ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              Organic
                            </button>
                          )}
                          {hasNonModData && (
                            <button
                              onClick={() => setFilterNm(!filterNm)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${filterNm ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              NON-MOD
                            </button>
                          )}
                          {hasTardinessData && (
                            <button
                              onClick={() => setIncludeTardiness(!includeTardiness)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${includeTardiness ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              TARDINESS
                            </button>
                          )}
                          {hasEarlyLeaveData && (
                            <button
                              onClick={() => setIncludeEarlyLeave(!includeEarlyLeave)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${includeEarlyLeave ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              EARLY LEAVE
                            </button>
                          )}
                          {hasIdleData && (
                            <button
                              onClick={() => setIncludeIdle(!includeIdle)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${includeIdle ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              IDLE
                            </button>
                          )}
                          {hasCheckData && (
                            <button
                              onClick={() => setIncludeCheck(!includeCheck)}
                              className={`flex-auto px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider transition-colors min-w-fit ${includeCheck ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                            >
                              CHECK
                            </button>
                          )}
                          <div className={`flex-auto px-1.5 py-0.5 flex items-center justify-center gap-1 bg-slate-700/50 rounded border border-slate-600/50 min-w-fit ${totalPeriodOverbreak === 0 ? 'opacity-50' : ''}`}>
                             <span className="text-[8.5px] font-bold tracking-widest text-slate-400 uppercase">TOTAL</span>
                             <span className="text-[9px] font-black text-rose-400">+{totalPeriodOverbreak}m</span>
                          </div>
                    </div>
                  )}
                  {isWcOnly && (
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full sm:w-auto mt-2 sm:mt-0 shadow-inner">
                       <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">TEMPO TOTAL (ORGANIC)</span>
                       <span className="text-sm font-black text-amber-500">{Math.floor(totalPeriodOverbreak / 60)}h {totalPeriodOverbreak % 60}m</span>
                    </div>
                  )}
                  {isIdleOnly && (
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full sm:w-auto mt-2 sm:mt-0 shadow-inner">
                       <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">TEMPO TOTAL (IDLE)</span>
                       <span className="text-sm font-black text-rose-500">{Math.floor(totalPeriodOverbreak / 60)}h {totalPeriodOverbreak % 60}m</span>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </DialogHeader>
      </div>
      <div className="flex-1 w-full overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="space-y-6">
            {records.length > 0 ? records.map((day, idx) => (
              <DayRecordCard key={`${day.date}-${idx}`} record={day} isWcOnly={isWcOnly} isIdleOnly={isIdleOnly} isTardinessOnly={isTardinessOnly} isMinorTardinessOnly={isMinorTardinessOnly} filterNm={filterNm} includeWc={includeWc} includeIdle={includeIdle} includeTardiness={includeTardiness} includeMinorTardiness={includeMinorTardiness} includeEarlyLeave={includeEarlyLeave} includeCheck={includeCheck} globalFilterMajorOverbreaks={globalFilterMajorOverbreaks} onlyExceptions={onlyExceptions} />
            )) : (
              <div className="text-center py-12">
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Nenhum registro para o período.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DayRecordCard: React.FC<{ record: EmployeeDayRecord; isWcOnly?: boolean; isIdleOnly?: boolean; isTardinessOnly?: boolean; isMinorTardinessOnly?: boolean; filterNm?: boolean; includeWc?: boolean; includeIdle?: boolean; includeTardiness?: boolean; includeMinorTardiness?: boolean; includeEarlyLeave?: boolean; includeCheck?: boolean; globalFilterMajorOverbreaks: boolean; onlyExceptions?: boolean }> = ({ record, isWcOnly, isIdleOnly, isTardinessOnly, isMinorTardinessOnly, filterNm, includeWc, includeIdle, includeTardiness, includeMinorTardiness, includeEarlyLeave, includeCheck, globalFilterMajorOverbreaks, onlyExceptions }) => {
    const { t } = useLanguage();
    if (record.isAbsence) {
        return (
            <div className="bg-red-50/50 border-2 border-red-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-widest shadow-md">
                            FALTA
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                {format(new Date(record.date + 'T12:00:00'), 'EEEE, dd/MM/yyyy')}
                            </p>
                            <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Ausência não justificada (Escalado: {record.scheduledShift})</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if ((record.isOFF || record.isLOA || record.isPTO || record.isSL || record.isSUSPP || record.isATT) && record.actualStartTime == null && record.totalWorkTimeMillis < 60000) {
        const typeLabel = record.isATT ? 'ATT / SAÍDA' : record.isLOA ? 'LICENÇA' : record.isPTO ? 'FÉRIAS' : record.isSL ? 'ATESTADO' : record.isSUSPP ? 'SUSPENSÃO' : 'OFF';
        return (
             <div className="flex flex-col p-4 border rounded-xl shadow-sm bg-white border-slate-100">
                <div className="flex items-center gap-3">
                    <span className="text-base font-black tracking-tight text-slate-900">{format(new Date(record.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-100">
                        {typeLabel}
                    </span>
                </div>
            </div>
        );
    }
    
    const isWcAlert = record.wcDuration > 10;
    const hasAnyOverbreak = record.mealOverbreak > 0 || record.shortOverbreak > 0 || record.wellnessOverbreak > 0 || record.prayingOverbreak > 0 || isWcAlert || record.idleOverbreak > 0 || (includeMinorTardiness ? ((record.tardinessMinutes || 0) > 0 && (record.tardinessMinutes || 0) < 15) : (record.tardinessMinutes || 0) >= 15) || (record.earlyLeaveMinutes || 0) > 0;
    
    // Check if any local filter is active
    const anyLocalFilterActive = onlyExceptions || includeWc || includeIdle || filterNm || includeTardiness || includeEarlyLeave || includeCheck;
    
    let isHighlighted = false;
    let borderColor = 'border-slate-100';
    
    if (anyLocalFilterActive) {
        if (onlyExceptions && hasAnyOverbreak) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-2'; }
        else if (filterNm && record.breaks.some(b => b.type === 'non_moderating' || b.type === 'forgot_status')) { isHighlighted = true; borderColor = 'border-teal-200 ring-teal-50/50 ring-2'; }
        else if (includeWc && record.wcDuration > 0) { isHighlighted = true; borderColor = 'border-amber-200 ring-amber-50/50 ring-2'; }
        else if (includeIdle && record.idleDuration > 0) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-2'; }
        else if (includeTardiness) { 
            if (includeMinorTardiness && (record.tardinessMinutes || 0) > 0 && (record.tardinessMinutes || 0) < 15) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-2'; }
            else if (!includeMinorTardiness && (record.tardinessMinutes || 0) >= 15) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-2'; }
        }
        else if (includeCheck && isShiftMismatch(record.scheduledShift, record.inferredShift)) { isHighlighted = true; borderColor = 'border-amber-200 ring-amber-50/50 ring-2'; }
        else if (includeEarlyLeave && (record.earlyLeaveMinutes || 0) > 0) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-2'; }
    } else {
        // Fallback for global or no filters
        if (isWcOnly && record.wcDuration > 0) { isHighlighted = true; borderColor = 'border-amber-200 ring-amber-50/50 ring-2'; }
        else if (isIdleOnly && record.idleDuration > 0) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-2'; }
        else if (isMinorTardinessOnly && ((record.tardinessMinutes || 0) > 0 && (record.tardinessMinutes || 0) < 15 || (record.earlyLeaveMinutes || 0) > 0)) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-2'; }
        else if (isTardinessOnly && ((record.tardinessMinutes || 0) >= 15 || (record.earlyLeaveMinutes || 0) > 0)) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-2'; }
        else if (hasAnyOverbreak) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-2'; }
    }

    // Calculate cumulative sums to correctly identify which breaks contribute to overbreaks
    const typeSums: Record<string, number> = {};
    
    // First, sort by start time so cumulative sum works chronologically
    const sortedBreaks = [...record.breaks].sort((a,b) => a.startTime.getTime() - b.startTime.getTime());
    
    const taggedBreaks = sortedBreaks.map(b => {
        const prevSum = typeSums[b.type] || 0;
        const newSum = prevSum + b.durationMinutes;
        typeSums[b.type] = newSum;
        
        let idealTime = 0;
        if (b.type === 'meal') idealTime = 60;
        else if (b.type === 'short') idealTime = 30;
        else if (b.type === 'wellness' || b.type === 'praying') idealTime = 15;
        else if (b.type === 'wc') idealTime = 10;
        
        let isOverbreak = false;
        let excessTime = 0;
        let usedIdeal = 0;

        if (b.type === 'idle' || b.type === 'forgot_status') {
            if (!globalFilterMajorOverbreaks || b.durationMinutes > 2) {
                isOverbreak = true;
                excessTime = b.durationMinutes;
                usedIdeal = 0;
            }
        } else if (idealTime > 0) {
            if (newSum > idealTime) {
                const excess = Math.min(b.durationMinutes, newSum - idealTime);
                if (b.type === 'wc' || b.type === 'praying' || b.type === 'wellness') {
                    isOverbreak = true;
                } else {
                    if (!globalFilterMajorOverbreaks || excess > 2) isOverbreak = true;
                }
                if (isOverbreak) {
                    excessTime = excess;
                    usedIdeal = b.durationMinutes - excess;
                }
            }
        }
        
        return { ...b, isOverbreak, allowed: usedIdeal, excess: excessTime, total: b.durationMinutes };
    });

    // Filter breaks to only show WC if isWcOnly is true
    const visibleBreaks = taggedBreaks.filter(b => {
        
        // If NO filter is selected, show EVERYTHING
        if (!onlyExceptions && !includeWc && !includeIdle && !filterNm) {
            return true;
        }

        // Otherwise, show if it matches ANY selected filter
        if (filterNm && (b.type === 'non_moderating' || b.type === 'forgot_status')) return true;
        if (includeWc && b.type === 'wc') return true;
        if (includeIdle && b.type === 'idle') return true;
        if (onlyExceptions && b.isOverbreak) return true;
        if (b.type === 'offline' && !onlyExceptions && !includeWc && !includeIdle && !filterNm) return true; // Just in case, already covered above

        return false;
    });

    const nmTotalDuration = typeSums['non_moderating'] || 0;
    
    let textColor = 'text-slate-900';
    if (isHighlighted) {
        if (borderColor.includes('teal')) textColor = 'text-teal-900';
        else if (borderColor.includes('amber')) textColor = 'text-amber-900';
        else if (borderColor.includes('rose')) textColor = 'text-rose-900';
        else if (borderColor.includes('orange')) textColor = 'text-orange-900';
    }

    return (
        <div className={`flex flex-col p-4 border rounded-xl shadow-sm transition-all relative overflow-hidden bg-white ${borderColor}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-3">
                    <span className={`text-base font-black tracking-tight ${textColor}`}>{format(new Date(record.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                    {(record.scheduledShift || record.inferredShift) && (
                       <div className="flex gap-2 items-center">
                           {isShiftMismatch(record.scheduledShift, record.inferredShift) ? (
                              <>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-100">
                                   {record.scheduledShift}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-100 text-amber-800 border-amber-300">
                                   {record.inferredShift}
                                </span>
                              </>
                           ) : (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-100">
                                  {record.scheduledShift || record.inferredShift}
                               </span>
                           )}
                       </div>
                    )}
                    {(record.mealOverbreak > 0 || record.shortOverbreak > 0 || record.wellnessOverbreak > 0 || record.prayingOverbreak > 0 || record.idleOverbreak > 0 || isWcAlert) && !filterNm && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-black uppercase tracking-wider">
                        Overbreak
                      </span>
                    )}
                </div>
            </div>

            {record.hasMealWithoutShortAnomaly && !isWcOnly && !filterNm && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                   <AlertTriangle className="text-amber-500 shrink-0 w-4 h-4 mt-0.5" />
                   <div>
                       <p className="text-xs font-bold text-amber-800">Possível Junção de Pausas</p>
                       <p className="text-[10px] text-amber-700/80">Meal break excedeu 1h15m, porém não há registro de Short Break logo após. Overbreak não deduzido, assumido como meal + short.</p>
                   </div>
                </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1.5 relative z-10 w-full mb-2 border-b border-slate-100 pb-2">
                {filterNm ? (
                    <div title={`Total: ${Math.floor(nmTotalDuration/60)}h ${nmTotalDuration%60}m`}>
                        <p className="text-[10px] text-teal-600 uppercase font-bold tracking-widest leading-none mb-0.5">Non-Moderating</p>
                        <div className="flex items-center gap-1 font-black text-sm">
                            <span className="text-teal-700">{Math.floor(nmTotalDuration/60)}h {nmTotalDuration%60}m</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {!isWcOnly && (
                            <>
                                {record.tasks !== undefined && record.tasks > 0 && (
                                    <div title={`Total Cases: ${record.tasks}`}>
                                        <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest leading-none mb-0.5">TASKS</p>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-indigo-600">{record.tasks}</span>
                                        </div>
                                    </div>
                                )}
                                <div title={`Total: ${Math.floor(record.mealDuration/60)}h ${record.mealDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mb-0.5">Meal</p>
                                    <div className="flex items-center gap-1 font-black text-sm">
                                        <span className="text-emerald-500">60m</span>
                                        {record.mealOverbreak > 0 && (
                                            <span className="text-amber-500">+{record.mealOverbreak}m</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.shortDuration/60)}h ${record.shortDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mb-0.5">Short</p>
                                    <div className="flex items-center gap-1 font-black text-sm">
                                        <span className="text-emerald-500">30m</span>
                                        {record.shortOverbreak > 0 && (
                                            <span className="text-amber-500">+{record.shortOverbreak}m</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.wellnessDuration/60)}h ${record.wellnessDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mb-0.5">Well.</p>
                                    <div className="flex items-center gap-1 font-black text-sm">
                                        <span className="text-emerald-500">15m</span>
                                        {record.wellnessOverbreak > 0 && (
                                            <span className="text-amber-500">+{record.wellnessOverbreak}m</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.prayingDuration/60)}h ${record.prayingDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mb-0.5">Pray.</p>
                                    <div className="flex items-center gap-1 font-black text-sm">
                                        <span className="text-emerald-500">15m</span>
                                        {record.prayingOverbreak > 0 && (
                                            <span className="text-amber-500">+{record.prayingOverbreak}m</span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div title={`Total: ${Math.floor(record.wcDuration/60)}h ${record.wcDuration%60}m`}>
                            <p className="text-[10px] text-amber-500 uppercase font-bold tracking-widest leading-none mb-0.5">Organic</p>
                            <div className="flex items-center gap-1 font-black text-sm">
                                {isWcOnly ? (
                                    <span className="text-amber-600">{Math.floor(record.wcDuration/60)}h {record.wcDuration%60}m</span>
                                ) : (
                                    <>
                                        <span className="text-emerald-500">10m</span>
                                        {isWcAlert && (
                                            <span className="text-amber-500">+{record.wcOverbreak}m</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {!isWcOnly && (
                            <div title={`Total: ${Math.floor(record.idleDuration/60)}h ${record.idleDuration%60}m`}>
                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-widest leading-none mb-0.5">IDLE</p>
                                <div className="flex items-center gap-1 font-black text-sm">
                                    {record.idleDuration > 0 ? (
                                        <span className="text-red-500">+{record.idleDuration}m</span>
                                    ) : (
                                        <span className="text-emerald-500">OK</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isWcOnly && (
                            <div title={`Tardiness: ${record.tardinessMinutes || 0}m`}>
                                <p className="text-[10px] text-orange-400 uppercase font-bold tracking-widest leading-none mb-0.5">TARDINESS</p>
                                <div className="flex flex-col">
                                    {(record.tardinessMinutes || 0) > 0 ? (
                                        <>
                                            <span className="font-black text-sm text-orange-600">+{record.tardinessMinutes}m</span>
                                            {record.actualStartTime && <span className="text-[9px] text-orange-500/80 font-bold">{format(record.actualStartTime, 'HH:mm')}</span>}
                                        </>
                                    ) : (
                                        <span className="font-black text-sm text-emerald-500">OK</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isWcOnly && (
                            <div title={`Early Leave: ${record.earlyLeaveMinutes || 0}m`}>
                                <p className="text-[10px] text-orange-400 uppercase font-bold tracking-widest leading-none mb-0.5">EARLY LEAVE</p>
                                <div className="flex flex-col">
                                    {(record.earlyLeaveMinutes || 0) > 0 ? (
                                        <>
                                            <span className="font-black text-sm text-orange-600">+{record.earlyLeaveMinutes}m</span>
                                            {record.actualEndTime && <span className="text-[9px] text-orange-500/80 font-bold">{format(record.actualEndTime, 'HH:mm')}</span>}
                                        </>
                                    ) : (
                                        <span className="font-black text-sm text-emerald-500">OK</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {visibleBreaks.length > 0 && (
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Timeline Detalhada</p>
                    <div className="flex flex-wrap gap-1.5">
                        {visibleBreaks.map((b, i) => {
                            const isOverbreak = b.isOverbreak;
                            
                            const lowerStatus = `${b.rawStatus || ''} ${b.subType || ''}`.toLowerCase();
                            let dotColor = 'bg-slate-400';
                            let textColor = isOverbreak ? 'text-rose-700' : 'text-slate-500';
                            
                            if (lowerStatus.includes('meeting') || b.type === 'meeting') {
                                dotColor = 'bg-yellow-400';
                                if (!isOverbreak) textColor = 'text-yellow-700';
                            } else if (lowerStatus.includes('training') || lowerStatus.includes('treinamento') || b.type === 'training') {
                                dotColor = 'bg-orange-500';
                                if (!isOverbreak) textColor = 'text-orange-700';
                            } else if (lowerStatus.includes('non') || lowerStatus.includes('n.m') || b.type === 'non_moderating') {
                                dotColor = 'bg-teal-500';
                                if (!isOverbreak) textColor = 'text-teal-700';
                            } else if (b.type === 'meal') {
                                dotColor = 'bg-blue-400';
                                if (!isOverbreak) textColor = 'text-blue-700';
                            } else if (b.type === 'wellness') {
                                dotColor = 'bg-indigo-400';
                                if (!isOverbreak) textColor = 'text-indigo-700';
                            } else if (b.type === 'praying') {
                                dotColor = 'bg-purple-400';
                                if (!isOverbreak) textColor = 'text-purple-700';
                            } else if (b.type === 'short' || lowerStatus.includes('rest')) {
                                dotColor = 'bg-emerald-400';
                                if (!isOverbreak) textColor = 'text-emerald-700';
                            } else if (b.type === 'wc') {
                                dotColor = 'bg-amber-400';
                                if (!isOverbreak) textColor = 'text-amber-700';
                            } else if (b.type === 'idle') {
                                dotColor = 'bg-red-500';
                                if (!isOverbreak) textColor = 'text-red-700';
                            } else if (b.type === 'offline') {
                                dotColor = 'bg-slate-800';
                                if (!isOverbreak) textColor = 'text-slate-700';
                            } else if (b.type === 'forgot_status') {
                                dotColor = 'bg-slate-700';
                            }
                            
                            let label = b.type === 'other' || b.type === 'forgot_status' ? (b.rawStatus || b.type) : b.type;
                            if (b.type === 'offline') label = 'offline';
                            if (b.type === 'non_moderating' && b.subType) {
                                label = b.subType;
                            }
                            
                            const dur = b.durationMinutes;
                            const durFormat = dur > 59 ? `${Math.floor(dur / 60)}h${dur % 60 > 0 ? ` ${dur % 60}m` : ''}` : `${dur}m`;
                            
                            return (
                                <div key={i} className={`flex items-center px-1.5 py-0.5 rounded text-[10px] border gap-1.5 shadow-sm ${isOverbreak ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    <span className={`font-bold ${isOverbreak ? 'text-rose-900' : 'text-slate-700'}`}>
                                        {format(b.startTime, 'HH:mm')} 
                                        <span className={`font-normal mx-0.5 ${isOverbreak ? 'text-rose-400' : 'text-slate-400'}`}>a</span> 
                                        {format(b.endTime, 'HH:mm')}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase ml-1 flex-1 ${textColor}`} title={b.rawStatus}>
                                        {label}
                                    </span>
                                    <div className="flex items-center gap-1 justify-end">
                                        {isOverbreak ? (
                                           <>
                                              {b.allowed > 0 && <span className="font-black text-emerald-600 bg-emerald-50 px-1 rounded shadow-sm">{b.allowed}m</span>}
                                              {b.excess > 0 && <span className="font-black text-amber-600 bg-amber-50 px-1 rounded shadow-sm">+{b.excess}m</span>}
                                           </>
                                        ) : (
                                           <span className="font-black text-slate-700 text-right">{durFormat}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {visibleBreaks.some(b => b.originalRemark && b.originalRemark.trim().length > 0) && (
                <div className="mt-4 bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{t('agentNotes')}</p>
                    <div className="space-y-2.5">
                        {visibleBreaks
                            .filter(b => b.originalRemark && b.originalRemark.trim().length > 0)
                            .map((b, idx) => {
                                let bgClass = 'bg-emerald-50/80';
                                let borderClass = 'border-emerald-200';
                                let textClass = 'text-emerald-700';
                                let nameClass = 'text-emerald-800';
                                let fillClass = 'bg-emerald-100/50';
                                
                                const lowerStatus = `${b.originalStatus || ''} ${b.originalSubStatus || ''}`.toLowerCase();
                                const isOvb = b.isOverbreak;
                                
                                if (lowerStatus.includes('meeting') || b.type === 'meeting') {
                                    bgClass = 'bg-yellow-50/80'; borderClass = 'border-yellow-200'; textClass = 'text-yellow-700'; nameClass = 'text-yellow-800'; fillClass = 'bg-yellow-100/50';
                                } else if (lowerStatus.includes('training') || lowerStatus.includes('treinamento') || b.type === 'training') {
                                    bgClass = 'bg-orange-50/80'; borderClass = 'border-orange-200'; textClass = 'text-orange-700'; nameClass = 'text-orange-800'; fillClass = 'bg-orange-100/50';
                                } else if (lowerStatus.includes('non') || lowerStatus.includes('n.m') || b.type === 'non_moderating') {
                                    bgClass = 'bg-teal-50/80'; borderClass = 'border-teal-200'; textClass = 'text-teal-700'; nameClass = 'text-teal-800'; fillClass = 'bg-teal-100/50';
                                } else if (b.type === 'meal') {
                                    bgClass = 'bg-blue-50/80'; borderClass = 'border-blue-200'; textClass = 'text-blue-700'; nameClass = 'text-blue-800'; fillClass = 'bg-blue-100/50';
                                } else if (b.type === 'wellness') {
                                    bgClass = 'bg-indigo-50/80'; borderClass = 'border-indigo-200'; textClass = 'text-indigo-700'; nameClass = 'text-indigo-800'; fillClass = 'bg-indigo-100/50';
                                } else if (b.type === 'praying') {
                                    bgClass = 'bg-purple-50/80'; borderClass = 'border-purple-200'; textClass = 'text-purple-700'; nameClass = 'text-purple-800'; fillClass = 'bg-purple-100/50';
                                } else if (b.type === 'wc') {
                                    bgClass = 'bg-amber-50/80'; borderClass = 'border-amber-200'; textClass = 'text-amber-700'; nameClass = 'text-amber-800'; fillClass = 'bg-amber-100/50';
                                } else if (b.type === 'offline') {
                                    bgClass = 'bg-slate-50/80'; borderClass = 'border-slate-300'; textClass = 'text-slate-700'; nameClass = 'text-slate-800'; fillClass = 'bg-slate-200/60';
                                } else if (b.type === 'idle' || isOvb) {
                                    bgClass = 'bg-rose-50/80'; borderClass = 'border-rose-200'; textClass = 'text-rose-700'; nameClass = 'text-rose-800'; fillClass = 'bg-rose-100/50';
                                }
                                
                                const s = b.originalStatus?.trim() || '';
                                const ss = b.originalSubStatus?.trim() || '';
                                let label = '';
                                if (s.toLowerCase().includes('wellness')) {
                                    label = 'Wellness';
                                } else if (ss) {
                                    label = ss;
                                } else {
                                    label = s || '-';
                                }
                                
                                const dur = b.durationMinutes;
                                const durFormat = dur > 59 ? `${Math.floor(dur / 60)}h${dur % 60 > 0 ? ` ${dur % 60}m` : ''}` : `${dur}m`;
                                
                                return (
                                    <div key={idx} className={`p-2.5 rounded-lg border ${bgClass} ${borderClass} text-[11px] shadow-sm`}>
                                        <div className="flex justify-between items-center mb-1.5 gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black ${nameClass} uppercase tracking-[0.05em] text-[10px]`}>{label}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <span className={`font-bold ${textClass}`}>{format(b.startTime, 'HH:mm')} - {format(b.endTime, 'HH:mm')}</span>
                                                <div className="flex items-center gap-1">
                                                    {isOvb ? (
                                                       <>
                                                          {b.allowed > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${fillClass}`}>{b.allowed}m</span>}
                                                          {b.excess > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-amber-700 bg-amber-100/50`}>+{b.excess}m</span>}
                                                       </>
                                                    ) : (
                                                       <span className={`text-[10px] ${textClass} font-bold px-1.5 py-0.5 rounded ${fillClass}`}>({durFormat})</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p className={`italic text-slate-700 leading-snug font-medium pl-2.5 border-l-[3px] py-0.5 mt-2 ${borderClass}`}>"{b.originalRemark}"</p>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            )}
        </div>
    );
}
