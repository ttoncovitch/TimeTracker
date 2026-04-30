import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { EmployeeSummary, EmployeeDayRecord } from '../types';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, ChevronRight, AlertTriangle, Info, ArrowUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from '../contexts/LanguageContext';

interface EmployeeListProps {
  summaries: EmployeeSummary[];
  allSummaries: EmployeeSummary[];
  latestDate?: Date;
  initialFilter?: 'all' | 'month' | 'week' | 'day';
  globalTypeFilter: 'all' | 'idle_overbreak_wc';
  globalIncludeWc: boolean;
  globalIncludeIdle: boolean;
  globalIncludeNonMod: boolean;
  globalIncludeTardiness: boolean;
  globalIncludeEarlyLeave: boolean;
  globalIncludeShort30Min?: boolean;
  globalFilterMajorOverbreaks: boolean;
}

export function EmployeeList({ summaries, allSummaries, latestDate, initialFilter = 'all', globalTypeFilter, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalIncludeTardiness, globalIncludeEarlyLeave, globalIncludeShort30Min, globalFilterMajorOverbreaks }: EmployeeListProps) {
  const { t } = useLanguage();
  const isWcOnly = globalTypeFilter === 'all' && globalIncludeWc && !globalIncludeShort30Min && !globalIncludeNonMod && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave;
  const isShort30MinOnly = globalTypeFilter === 'all' && globalIncludeShort30Min && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [sortBy, setSortBy] = useState<'maiores' | 'menores' | 'alfabetica' | string>('maiores');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filtered = summaries.filter(s => 
    s.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    // If using predefined sorts
    if (sortBy === 'maiores') return b.totalOverbreakMinutes - a.totalOverbreakMinutes;
    if (sortBy === 'menores') return a.totalOverbreakMinutes - b.totalOverbreakMinutes;
    if (sortBy === 'alfabetica') return a.employeeName.localeCompare(b.employeeName);
    
    // Custom column sort
    let aVal = 0, bVal = 0;
    if (sortBy === 'meal') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0); }
    if (sortBy === 'short') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0); }
    if (sortBy === 'wellness') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0); }
    if (sortBy === 'praying') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0); }
    if (sortBy === 'wc') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0); }
    if (sortBy === 'idle') { aVal = a.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0); bVal = b.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0); }
    if (sortBy === 'tardiness') { aVal = a.totalTardinessMinutes; bVal = b.totalTardinessMinutes; }
    if (sortBy === 'earlyLeave') { aVal = a.totalEarlyLeaveMinutes; bVal = b.totalEarlyLeaveMinutes; }
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder={t('searchAgent')} 
            className="pl-11 h-11 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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

      <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/40 border border-slate-200 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50/95 backdrop-blur border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 tracking-widest sticky top-0 z-20">
                <tr>
                  <th className="py-4 pl-8 pr-4 font-black whitespace-nowrap">Agente</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('meal')}>Meal {sortBy === 'meal' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('short')}>Short {sortBy === 'short' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('wellness')}>Well. {sortBy === 'wellness' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('praying')}>Pray. {sortBy === 'praying' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('nonMod')}>NON-MOD {sortBy === 'nonMod' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('reviewAndAppeal')}>R&A {sortBy === 'reviewAndAppeal' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('awaitingTasks')}>A.T {sortBy === 'awaitingTasks' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('wc')}>Organic {sortBy === 'wc' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('idle')}>IDLE {sortBy === 'idle' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('tardiness')}>TARDINESS {sortBy === 'tardiness' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('earlyLeave')}>EARLY LEAVE {sortBy === 'earlyLeave' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('short30Min')}>Short 30min (Dias) {sortBy === 'short30Min' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('total')}>{t('total')} {sortBy === 'total' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 pl-4 pr-8 text-right font-black whitespace-nowrap">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s, idx) => {
                  const hasMealOver = s.dailyRecords.some(r => r.mealOverbreak > 0);
                  const hasShortOver = s.dailyRecords.some(r => r.shortOverbreak > 0);
                  const hasWellnessOver = s.dailyRecords.some(r => r.wellnessOverbreak > 0);
                  const hasPrayingOver = s.dailyRecords.some(r => r.prayingOverbreak > 0);
                  const hasWcExc = s.wcAlerts > 0;
                  const hasIdleExc = s.idleAlerts > 0;
                  const hasTardiness = s.dailyRecords.some(r => (r.tardinessMinutes || 0) > 0);
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

                  return (
                    <tr 
                      key={`${s.employeeName}-${idx}`} 
                      onClick={() => setSelectedEmp(allSummaries.find(all => all.employeeName === s.employeeName) || s)}
                      className={`cursor-pointer transition-all hover:bg-slate-50/80 group ${isAlertRow ? 'bg-rose-50/10' : 'bg-white'}`}
                    >
                      <td className="py-4 pl-8 pr-4 relative">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasIdleExc ? 'bg-red-500' : hasWcExc ? 'bg-amber-500' : 'bg-transparent'}`} />
                        <p className={`font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors ${hasIdleExc ? 'underline decoration-red-500/50 decoration-2 underline-offset-4' : hasWcExc ? 'underline decoration-amber-500/50 decoration-2 underline-offset-4' : ''} truncate max-w-[200px]`}>
                          {s.employeeName}
                        </p>
                        {s.email && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{s.email}</p>
                            {(s.lob || s.language) && (
                              <p className="text-[9px] font-bold text-slate-500 uppercase">
                                {[s.lob, s.language].filter(Boolean).join(' - ')}
                              </p>
                            )}
                          </div>
                        )}
                        {(() => {
                          const schedShifts = Array.from(new Set(s.dailyRecords.map(r => r.scheduledShift || r.inferredShift).filter(Boolean)));
                          const realSchedShifts = schedShifts.filter(sh => sh.toLowerCase() !== 'off');
                          let dispShift = s.shift;
                          let shiftDiffers = false;
                          if (realSchedShifts.length === 1) {
                              dispShift = realSchedShifts[0];
                          } else if (realSchedShifts.length > 1) {
                              dispShift = "Vários Horários";
                          } else if (schedShifts.length > 0) {
                              dispShift = schedShifts[0];
                          }
                          
                          // Check if any specific day has a shift discrepancy
                          if (s.dailyRecords.some(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim())) {
                              shiftDiffers = true;
                          }

                          return (s.lob || s.language || dispShift || s.supervisor) ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {s.lob && <span className="bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.lob}</span>}
                            {s.language && <span className="bg-purple-50 text-purple-600 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.language}</span>}
                            {dispShift && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest ${shiftDiffers ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                                {dispShift} {shiftDiffers && '(CHECK)'}
                              </span>
                            )}
                            {s.supervisor && <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold">TL: {s.supervisor}</span>}
                          </div>
                          ) : null;
                        })()}
                      </td>
                      
                      <td className="py-4 px-2 text-center" title={mealTotal > 0 ? `${mealTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasMealOver ? 'bg-rose-100 text-rose-700 font-black' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {mealTotal > 0 ? `${mealTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={shortTotal > 0 ? `${shortTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasShortOver ? 'bg-rose-100 text-rose-700 font-black' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {shortTotal > 0 ? `${shortTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={wellnessTotal > 0 ? `${wellnessTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasWellnessOver ? 'bg-rose-100 text-rose-700 font-black' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {wellnessTotal > 0 ? `${wellnessTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={prayingTotal > 0 ? `${prayingTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasPrayingOver ? 'bg-rose-100 text-rose-700 font-black' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {prayingTotal > 0 ? `${prayingTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={nonModTotal > 0 ? `${nonModTotal}m em NON-MOD` : '0m em NON-MOD'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${nonModTotal > 0 ? 'bg-teal-50 text-teal-700 font-black border border-teal-200' : 'text-slate-300 font-bold'}`}>
                          {nonModTotal}m
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={s.totalReviewAndAppealMinutes > 0 ? `${s.totalReviewAndAppealMinutes}m em R&A` : '0m em R&A'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${s.totalReviewAndAppealMinutes > 0 ? 'bg-purple-50 text-purple-700 font-black border border-purple-200' : 'text-slate-300 font-bold'}`}>
                          {s.totalReviewAndAppealMinutes}m
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={s.totalAwaitingTasksMinutes > 0 ? `${s.totalAwaitingTasksMinutes}m em A.T` : '0m em A.T'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${s.totalAwaitingTasksMinutes > 0 ? 'bg-indigo-50 text-indigo-700 font-black border border-indigo-200' : 'text-slate-300 font-bold'}`}>
                          {s.totalAwaitingTasksMinutes}m
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={wcTotal > 0 ? `${wcTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasWcExc ? 'bg-amber-100 text-amber-700 font-black border border-amber-200' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {wcTotal > 0 ? `${wcTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={idleTotal > 0 ? `${idleTotal}m excedentes` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${hasIdleExc ? 'bg-red-100 text-red-700 font-black border border-red-200' : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {idleTotal > 0 ? `${idleTotal}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={tardinessTotal > 0 ? `${tardinessTotal}m atraso` : 'No tardiness'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${tardinessTotal > 0 ? 'bg-orange-100 text-orange-700 font-black border border-orange-200' : 'text-slate-300 font-bold'}`}>
                          {tardinessTotal > 0 ? `${tardinessTotal}m` : '0m'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={earlyLeaveTotal > 0 ? `${earlyLeaveTotal}m saída antecipada` : 'No early leave'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${earlyLeaveTotal > 0 ? 'bg-orange-100 text-orange-700 font-black border border-orange-200' : 'text-slate-300 font-bold'}`}>
                          {earlyLeaveTotal > 0 ? `${earlyLeaveTotal}m` : '0m'}
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={(s.totalShort30MinRecords || 0) > 0 ? `${s.totalShort30MinRecords} dias` : '0 dias'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${(s.totalShort30MinRecords || 0) > 0 ? 'bg-emerald-100/70 border border-emerald-200 text-emerald-800 font-black' : 'text-slate-300 font-bold'}`}>
                          {s.totalShort30MinRecords || 0}d
                        </span>
                      </td>

                      <td className="py-4 px-2 text-center" title={s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m ${isWcOnly ? 'Organic' : 'excedentes'}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${s.totalOverbreakMinutes > 0 ? (isWcOnly ? 'bg-amber-100 border border-amber-200 text-amber-600 font-black' : 'bg-rose-100 text-rose-700 font-black') : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 pl-4 pr-8 text-right">
                        {isWcOnly && s.totalOverbreakMinutes > 0 ? (
                           <span className="inline-block px-2 py-1 bg-amber-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter">ORGANIC TOTAL</span>
                        ) : hasIdleExc ? (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase tracking-tighter">IDLE</span>
                        ) : hasWcExc ? (
                          <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase tracking-tighter">ORGANIC EXC.</span>
                        ) : s.totalOverbreakMinutes > 30 ? (
                          <span className="inline-block px-2 py-1 bg-rose-600 text-white rounded-md text-[10px] font-black uppercase tracking-tighter">OVERBREAK</span>
                        ) : s.totalOverbreakMinutes > 0 ? (
                          <span className="inline-block px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-[10px] font-black uppercase tracking-tighter">ALERTA</span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-black uppercase tracking-tighter">ESTÁVEL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-32">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">Nenhum agente correspondente</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center px-8 shrink-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {t('showingRecords')} {filtered.length} {t('outOf')} {summaries.length} {t('recordsProcessed')}
          </p>
        </div>
      </div>

      <Dialog open={!!selectedEmp} onOpenChange={(open) => !open && setSelectedEmp(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col rounded-[2rem] border-slate-200 p-0 overflow-hidden shadow-2xl">
           {selectedEmp && <EmployeeDetail summary={selectedEmp} latestDate={latestDate || new Date()} initialFilter={initialFilter} t={t} globalTypeFilter={globalTypeFilter} globalIncludeWc={globalIncludeWc} globalIncludeIdle={globalIncludeIdle} globalIncludeNonMod={globalIncludeNonMod} globalIncludeTardiness={globalIncludeTardiness} globalIncludeEarlyLeave={globalIncludeEarlyLeave} globalIncludeShort30Min={globalIncludeShort30Min} globalFilterMajorOverbreaks={globalFilterMajorOverbreaks} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDetail({ summary: s, latestDate, initialFilter, t, globalTypeFilter, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalIncludeTardiness, globalIncludeEarlyLeave, globalIncludeShort30Min, globalFilterMajorOverbreaks }: { summary: EmployeeSummary; latestDate: Date, initialFilter: string, t: any, globalTypeFilter: 'all' | 'idle_overbreak_wc', globalIncludeWc: boolean, globalIncludeIdle: boolean, globalIncludeNonMod: boolean, globalIncludeTardiness: boolean, globalIncludeEarlyLeave: boolean, globalIncludeShort30Min?: boolean, globalFilterMajorOverbreaks: boolean }) {
  const today = new Date();
  
  // Start with the initialFilter mapped to 'today', 'week', or 'month'
  // If initialFilter is 'all' or 'day', we'll default it smartly
  const getInitialView = () => {
    if (initialFilter === 'month') return 'month';
    if (initialFilter === 'week') return 'week';
    return 'today';
  };

  const [view, setView] = useState<'today' | 'week' | 'month'>(getInitialView());
  const [onlyExceptions, setOnlyExceptions] = useState(
    globalTypeFilter === 'idle_overbreak_wc' ? true : false
  );
  const [includeWc, setIncludeWc] = useState(globalIncludeWc);
  const [includeIdle, setIncludeIdle] = useState(globalIncludeIdle);
  const [filterNm, setFilterNm] = useState(globalIncludeNonMod);
  const [includeTardiness, setIncludeTardiness] = useState(globalIncludeTardiness);
  const [includeEarlyLeave, setIncludeEarlyLeave] = useState(globalIncludeEarlyLeave);
  const [includeShort30Min, setIncludeShort30Min] = useState(globalIncludeShort30Min || false);

  let records = s.dailyRecords;
  
  if (view === 'month') {
    records = s.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return (today.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    });
  } else if (view === 'week') {
    records = s.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return (today.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    });
  } else if (view === 'today') {
    records = s.dailyRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
  }

  const anyLocalFilterActive = onlyExceptions || includeWc || includeIdle || filterNm || includeTardiness || includeEarlyLeave || includeShort30Min;
  if (anyLocalFilterActive) {
    records = records.filter(r => {
      let keep = false;
      const hasAnyOverbreak = r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0 || r.wcDuration > 10 || r.idleOverbreak > 0 || (r.tardinessMinutes || 0) > 0 || (r.earlyLeaveMinutes || 0) > 0;
      
      if (onlyExceptions && hasAnyOverbreak) keep = true;
      if (includeWc && r.wcDuration > 0) keep = true;
      if (includeIdle && r.idleDuration > 0) keep = true;
      if (filterNm && r.breaks.some(b => b.type === 'non_moderating' || b.type === 'forgot_status')) keep = true;
      if (includeTardiness && (r.tardinessMinutes || 0) > 0) keep = true;
      if (includeEarlyLeave && (r.earlyLeaveMinutes || 0) > 0) keep = true;
      if (includeShort30Min && r.hasSingleShort30m) keep = true;
      
      return keep;
    });
  }

  // Se SOMENTE o WC estiver selecionado GLOBALMENTE
  const isWcOnly = globalIncludeWc && !globalIncludeShort30Min && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
  const isIdleOnly = globalIncludeIdle && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
  const isTardinessOnly = globalIncludeTardiness && !globalIncludeShort30Min && !globalIncludeIdle && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
  const isEarlyLeaveOnly = globalIncludeEarlyLeave && !globalIncludeShort30Min && !globalIncludeIdle && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeTardiness && globalTypeFilter === 'all';
  const isShort30MinOnly = globalIncludeShort30Min && !globalIncludeEarlyLeave && !globalIncludeIdle && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeTardiness && globalTypeFilter === 'all';

  if (filterNm) {
    records = records.filter(r => r.breaks.some(b => b.type === 'non_moderating'));
  } else if (onlyExceptions && !isWcOnly && !isIdleOnly && !isTardinessOnly && !isEarlyLeaveOnly && !isShort30MinOnly) {
    records = records.filter(r => 
      r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0 || (includeIdle && r.idleDuration > 0) || (includeWc && r.wcDuration > 10) || (includeTardiness && ((r.tardinessMinutes || 0) > 0)) || (includeEarlyLeave && ((r.earlyLeaveMinutes || 0) > 0)) || (includeShort30Min && r.hasSingleShort30m)
    );
  } else if (isWcOnly) {
    records = records.filter(r => r.wcDuration > 0);
  } else if (isIdleOnly) {
    records = records.filter(r => r.idleDuration > 0);
  } else if (isTardinessOnly) {
    records = records.filter(r => (r.tardinessMinutes || 0) > 0);
  } else if (isEarlyLeaveOnly) {
    records = records.filter(r => (r.earlyLeaveMinutes || 0) > 0);
  } else if (isShort30MinOnly) {
    records = records.filter(r => r.hasSingleShort30m);
  }

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
                   {s.employeeName.substring(0, 2).toUpperCase()}
                 </div>
                 <div>
                   <DialogTitle className="text-2xl font-black text-left">{s.employeeName}</DialogTitle>
                   {s.email && <p className="text-slate-400 text-xs mt-0.5">{s.email}</p>}
                   {(s.lob || s.language) && (
                      <p className="text-xs font-bold text-blue-600 uppercase mt-1">
                        {[s.lob, s.language].filter(Boolean).join(' - ')}
                      </p>
                   )}
                   {(() => {
                       const schedShifts = Array.from(new Set(records.map(r => r.scheduledShift || r.inferredShift).filter(Boolean)));
                       const realSchedShifts = schedShifts.filter(sh => sh.toLowerCase() !== 'off');
                       let dispShift = s.shift;
                       if (realSchedShifts.length === 1) {
                           dispShift = realSchedShifts[0];
                       } else if (realSchedShifts.length > 1) {
                           dispShift = "Vários Horários";
                       } else if (schedShifts.length > 0) {
                           dispShift = schedShifts[0];
                       }
                       return (s.lob || s.language || dispShift || s.supervisor) ? (
                     <div className="flex flex-wrap gap-1 mt-2">
                       {s.lob && <span className="bg-blue-50/10 text-blue-300 border border-blue-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.lob}</span>}
                       {s.language && <span className="bg-purple-50/10 text-purple-300 border border-purple-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest">{s.language}</span>}
                       {dispShift && <span className={`border text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest ${s.dailyRecords.some(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()) ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-emerald-50/10 text-emerald-300 border-emerald-500/30'}`}>{dispShift} {s.dailyRecords.some(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()) && '(CHECK)'}</span>}
                       {s.supervisor && <span className="bg-slate-800 text-slate-300 border border-slate-600 text-[9px] px-1.5 py-0.5 rounded font-bold">TL: {s.supervisor}</span>}
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
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700 w-full sm:w-auto overflow-x-auto custom-scrollbar gap-1">
                    {(['today', 'week', 'month'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => {
                            setView(v);
                        }}
                        className={`px-2 py-1 shrink-0 rounded text-[10px] font-black uppercase tracking-wider transition-colors ${view === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                      >
                        {v === 'today' ? t('filterDay') : v === 'week' ? t('days7') : t('days30')}
                      </button>
                    ))}
                  </div>
  
                  {!isWcOnly && (
                    <div className="flex flex-col bg-slate-800 rounded-md p-2 border border-slate-700 w-full gap-2">
                       <div className="grid grid-cols-3 gap-1">
                         <button
                           onClick={() => setOnlyExceptions(!onlyExceptions)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${onlyExceptions ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           {t('exceptions')}
                         </button>
                         <button
                           onClick={() => setIncludeWc(!includeWc)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${includeWc ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           Organic
                         </button>
                         <button
                           onClick={() => setFilterNm(!filterNm)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${filterNm ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           NON-MOD
                         </button>
                       </div>
                       <div className="grid grid-cols-2 gap-1">
                         <button
                           onClick={() => setIncludeTardiness(!includeTardiness)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${includeTardiness ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           TARDINESS
                         </button>
                         <button
                           onClick={() => setIncludeEarlyLeave(!includeEarlyLeave)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${includeEarlyLeave ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           EARLY LEAVE
                         </button>
                       </div>
                       <div className="grid grid-cols-2 gap-1">
                         <button
                           onClick={() => setIncludeIdle(!includeIdle)}
                           className={`px-2 py-1.5 rounded text-[9.5px] font-black uppercase tracking-wider transition-colors ${includeIdle ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                         >
                           IDLE
                         </button>
                         <div className="flex items-center justify-center gap-1 bg-slate-700/50 px-2 py-1.5 rounded border border-slate-600/50">
                            <span className="text-[9.5px] font-bold tracking-widest text-slate-400 uppercase">TOTAL</span>
                            <span className="text-[10px] font-black text-rose-400">+{totalPeriodOverbreak}m</span>
                         </div>
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
              <DayRecordCard key={`${day.date}-${idx}`} record={day} isWcOnly={isWcOnly} isIdleOnly={isIdleOnly} isTardinessOnly={isTardinessOnly} filterNm={filterNm} includeWc={includeWc} includeIdle={includeIdle} includeTardiness={includeTardiness} includeEarlyLeave={includeEarlyLeave} globalFilterMajorOverbreaks={globalFilterMajorOverbreaks} onlyExceptions={onlyExceptions} />
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

const DayRecordCard: React.FC<{ record: EmployeeDayRecord; isWcOnly?: boolean; isIdleOnly?: boolean; isTardinessOnly?: boolean; filterNm?: boolean; includeWc?: boolean; includeIdle?: boolean; includeTardiness?: boolean; includeEarlyLeave?: boolean; globalFilterMajorOverbreaks: boolean; onlyExceptions?: boolean }> = ({ record, isWcOnly, isIdleOnly, isTardinessOnly, filterNm, includeWc, includeIdle, includeTardiness, includeEarlyLeave, globalFilterMajorOverbreaks, onlyExceptions }) => {
    const isWcAlert = record.wcDuration > 10;
    const hasAnyOverbreak = record.mealOverbreak > 0 || record.shortOverbreak > 0 || record.wellnessOverbreak > 0 || record.prayingOverbreak > 0 || isWcAlert || record.idleOverbreak > 0 || (record.tardinessMinutes || 0) > 0 || (record.earlyLeaveMinutes || 0) > 0;
    
    // Check if any local filter is active
    const anyLocalFilterActive = onlyExceptions || includeWc || includeIdle || filterNm || includeTardiness || includeEarlyLeave;
    
    let isHighlighted = false;
    let borderColor = 'border-slate-100';
    
    if (anyLocalFilterActive) {
        if (onlyExceptions && hasAnyOverbreak) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-4'; }
        else if (filterNm && record.breaks.some(b => b.type === 'non_moderating' || b.type === 'forgot_status')) { isHighlighted = true; borderColor = 'border-teal-200 ring-teal-50/50 ring-4'; }
        else if (includeWc && record.wcDuration > 0) { isHighlighted = true; borderColor = 'border-amber-200 ring-amber-50/50 ring-4'; }
        else if (includeIdle && record.idleDuration > 0) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-4'; }
        else if (includeTardiness && (record.tardinessMinutes || 0) > 0) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-4'; }
        else if (includeEarlyLeave && (record.earlyLeaveMinutes || 0) > 0) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-4'; }
    } else {
        // Fallback for global or no filters
        if (isWcOnly && record.wcDuration > 0) { isHighlighted = true; borderColor = 'border-amber-200 ring-amber-50/50 ring-4'; }
        else if (isIdleOnly && record.idleDuration > 0) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-4'; }
        else if (isTardinessOnly && ((record.tardinessMinutes || 0) > 0 || (record.earlyLeaveMinutes || 0) > 0)) { isHighlighted = true; borderColor = 'border-orange-200 ring-orange-50/50 ring-4'; }
        else if (hasAnyOverbreak) { isHighlighted = true; borderColor = 'border-rose-200 ring-rose-50/50 ring-4'; }
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
        if (b.type === 'idle' || b.type === 'forgot_status') {
            if (!globalFilterMajorOverbreaks || b.durationMinutes > 2) isOverbreak = true;
        } else if (idealTime > 0) {
            if (newSum > idealTime) {
                const excess = Math.min(b.durationMinutes, newSum - idealTime);
                if (b.type === 'wc' || b.type === 'praying' || b.type === 'wellness') {
                    isOverbreak = true;
                } else {
                    if (!globalFilterMajorOverbreaks || excess > 2) isOverbreak = true;
                }
            }
        }
        
        return { ...b, isOverbreak };
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
        <div className={`flex flex-col p-5 border rounded-2xl shadow-sm transition-all relative overflow-hidden bg-white ${borderColor}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                    <span className={`text-base font-black tracking-tight ${textColor}`}>{format(new Date(record.date), 'dd/MM/yyyy')}</span>
                    {(record.scheduledShift || record.inferredShift) && (
                       <div className="flex flex-col">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                               record.scheduledShift && record.inferredShift && record.scheduledShift.trim() !== record.inferredShift.trim() 
                               ? 'bg-amber-100 text-amber-800 border-amber-300' 
                               : 'bg-blue-50 text-blue-700 border-blue-100'
                           }`}>
                              Shift: {record.inferredShift || record.scheduledShift}
                              {record.scheduledShift && record.inferredShift && record.scheduledShift.trim() !== record.inferredShift.trim() && (
                                  <span className="font-black ml-1">(CHECK)</span>
                              )}
                           </span>
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

            <div className="flex flex-wrap gap-x-6 gap-y-4 relative z-10 w-full mb-5 border-b border-slate-100 pb-5">
                {filterNm ? (
                    <div title={`Total: ${Math.floor(nmTotalDuration/60)}h ${nmTotalDuration%60}m`}>
                        <p className="text-[10px] text-teal-600 uppercase font-bold tracking-widest mb-1">Non-Moderating</p>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-black text-teal-700">{Math.floor(nmTotalDuration/60)}h {nmTotalDuration%60}m</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {!isWcOnly && (
                            <>
                                <div title={`Total: ${Math.floor(record.mealDuration/60)}h ${record.mealDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Meal (1h)</p>
                                    <div className="flex items-center gap-2">
                                        {record.mealOverbreak > 0 ? (
                                            <span className="text-base font-black text-rose-600">+{record.mealOverbreak}m</span>
                                        ) : (
                                            <span className="text-base font-black text-emerald-500">OK</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.shortDuration/60)}h ${record.shortDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Short (30m)</p>
                                    <div className="flex items-center gap-2">
                                        {record.shortOverbreak > 0 ? (
                                            <span className="text-base font-black text-rose-600">+{record.shortOverbreak}m</span>
                                        ) : (
                                            <span className="text-base font-black text-emerald-500">OK</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.wellnessDuration/60)}h ${record.wellnessDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Well. (15m)</p>
                                    <div className="flex items-center gap-2">
                                        {record.wellnessOverbreak > 0 ? (
                                            <span className="text-base font-black text-rose-600">+{record.wellnessOverbreak}m</span>
                                        ) : (
                                            <span className="text-base font-black text-emerald-500">OK</span>
                                        )}
                                    </div>
                                </div>
                                <div title={`Total: ${Math.floor(record.prayingDuration/60)}h ${record.prayingDuration%60}m`}>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Pray. (15m)</p>
                                    <div className="flex items-center gap-2">
                                        {record.prayingOverbreak > 0 ? (
                                            <span className="text-base font-black text-rose-600">+{record.prayingOverbreak}m</span>
                                        ) : (
                                            <span className="text-base font-black text-emerald-500">OK</span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div title={`Total: ${Math.floor(record.wcDuration/60)}h ${record.wcDuration%60}m`}>
                            <p className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1">Organic {isWcOnly ? '' : '(10m)'}</p>
                            <div className="flex items-center gap-2">
                                {isWcOnly ? (
                                    <span className="text-base font-black text-amber-600">{Math.floor(record.wcDuration/60)}h {record.wcDuration%60}m</span>
                                ) : isWcAlert ? (
                                    <span className="text-base font-black text-amber-600">+{record.wcOverbreak}m</span>
                                ) : (
                                    <span className="text-base font-black text-emerald-500">OK</span>
                                )}
                            </div>
                        </div>
                        
                        {!isWcOnly && (
                            <div title={`Total: ${Math.floor(record.idleDuration/60)}h ${record.idleDuration%60}m`}>
                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-widest mb-1">IDLE</p>
                                <div className="flex items-center gap-2">
                                    {record.idleDuration > 0 ? (
                                        <span className="text-base font-black text-red-600">+{record.idleDuration}m</span>
                                    ) : (
                                        <span className="text-base font-black text-emerald-500">OK</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isWcOnly && (
                            <div title={`Tardiness: ${record.tardinessMinutes || 0}m`}>
                                <p className="text-[10px] text-orange-400 uppercase font-bold tracking-widest mb-1">TARDINESS</p>
                                <div className="flex flex-col">
                                    {(record.tardinessMinutes || 0) > 0 ? (
                                        <>
                                            <span className="text-base font-black text-orange-600">+{record.tardinessMinutes}m</span>
                                            {record.actualStartTime && <span className="text-[10px] text-orange-500/80 font-bold -mt-1">{format(record.actualStartTime, 'HH:mm')}</span>}
                                        </>
                                    ) : (
                                        <span className="text-base font-black text-emerald-500">OK</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isWcOnly && (
                            <div title={`Early Leave: ${record.earlyLeaveMinutes || 0}m`}>
                                <p className="text-[10px] text-orange-400 uppercase font-bold tracking-widest mb-1">EARLY LEAVE</p>
                                <div className="flex flex-col">
                                    {(record.earlyLeaveMinutes || 0) > 0 ? (
                                        <>
                                            <span className="text-base font-black text-orange-600">+{record.earlyLeaveMinutes}m</span>
                                            {record.actualEndTime && <span className="text-[10px] text-orange-500/80 font-bold -mt-1">{format(record.actualEndTime, 'HH:mm')}</span>}
                                        </>
                                    ) : (
                                        <span className="text-base font-black text-emerald-500">OK</span>
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
                                <div key={i} className={`flex items-center px-2 py-1 rounded text-[10px] border gap-1.5 shadow-sm ${isOverbreak ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    <span className={`font-bold ${isOverbreak ? 'text-rose-900' : 'text-slate-700'}`}>
                                        {format(b.startTime, 'HH:mm')} 
                                        <span className={`font-normal mx-0.5 ${isOverbreak ? 'text-rose-400' : 'text-slate-400'}`}>a</span> 
                                        {format(b.endTime, 'HH:mm')}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase ml-1 ${textColor}`} title={b.rawStatus}>
                                        {label} ({durFormat})
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {visibleBreaks.some(b => b.originalRemark && b.originalRemark.trim().length > 0) && (
                <div className="mt-4 bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Anotações do Agente</p>
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
                                                <span className={`text-[10px] ${textClass} font-bold px-1.5 py-0.5 rounded ${fillClass}`}>({durFormat})</span>
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
