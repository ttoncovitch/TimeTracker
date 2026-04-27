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
}

export function EmployeeList({ summaries, allSummaries, latestDate, initialFilter = 'all', globalTypeFilter, globalIncludeWc }: EmployeeListProps) {
  const { t } = useLanguage();
  const isOnlyWcGlobally = globalTypeFilter === 'all' && globalIncludeWc;
  
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
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('wc')}>WC {sortBy === 'wc' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="py-4 px-2 text-center font-black whitespace-nowrap cursor-pointer hover:text-blue-600 select-none group" onClick={() => handleSort('idle')}>IDLE {sortBy === 'idle' && <span className="text-[10px] ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
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
                  const isAlertRow = hasMealOver || hasShortOver || hasWellnessOver || hasPrayingOver || hasWcExc || hasIdleExc;

                  const mealTotal = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
                  const shortTotal = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
                  const wellnessTotal = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
                  const prayingTotal = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
                  const wcTotal = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
                  const idleTotal = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);

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
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{s.email}</p>
                        )}
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

                      <td className="py-4 px-2 text-center" title={s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m ${isOnlyWcGlobally ? 'WC' : 'excedentes'}` : 'No overbreak'}>
                        <span className={`inline-flex items-center justify-center text-sm px-2 py-1 rounded transition-colors ${s.totalOverbreakMinutes > 0 ? (isOnlyWcGlobally ? 'bg-amber-100 border border-amber-200 text-amber-600 font-black' : 'bg-rose-100 text-rose-700 font-black') : 'bg-emerald-50 text-emerald-600 font-bold'}`}>
                          {s.totalOverbreakMinutes > 0 ? `${s.totalOverbreakMinutes}m` : 'OK'}
                        </span>
                      </td>

                      <td className="py-4 pl-4 pr-8 text-right">
                        {isOnlyWcGlobally && s.totalOverbreakMinutes > 0 ? (
                           <span className="inline-block px-2 py-1 bg-amber-500 text-white rounded-md text-[10px] font-black uppercase tracking-tighter">WC TOTAL</span>
                        ) : hasIdleExc ? (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase tracking-tighter">IDLE</span>
                        ) : hasWcExc ? (
                          <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-black uppercase tracking-tighter">WC EXC.</span>
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
           {selectedEmp && <EmployeeDetail summary={selectedEmp} latestDate={latestDate || new Date()} initialFilter={initialFilter} t={t} globalTypeFilter={globalTypeFilter} globalIncludeWc={globalIncludeWc} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDetail({ summary: s, latestDate, initialFilter, t, globalTypeFilter, globalIncludeWc }: { summary: EmployeeSummary; latestDate: Date, initialFilter: string, t: any, globalTypeFilter: 'all' | 'idle_overbreak_wc', globalIncludeWc: boolean }) {
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

  // Se SOMENTE o WC estiver selecionado GLOBALMENTE
  const isOnlyWcGlobally = globalTypeFilter === 'all' && globalIncludeWc;

  if (onlyExceptions && !isOnlyWcGlobally) {
    records = records.filter(r => 
      r.mealOverbreak > 0 || r.shortOverbreak > 0 || r.wellnessOverbreak > 0 || r.prayingOverbreak > 0 || r.idleDuration > 0 || (includeWc && r.wcDuration > 10)
    );
  } else if (isOnlyWcGlobally) {
    records = records.filter(r => r.wcDuration > 0);
  }

  const totalPeriodOverbreak = records.reduce((acc, r) => {
    if (isOnlyWcGlobally) {
       return acc + r.wcDuration;
    }

    let dayOverbreak = r.mealOverbreak + r.shortOverbreak + r.wellnessOverbreak + r.prayingOverbreak;
    if (includeWc) {
      dayOverbreak += r.wcOverbreak;
    }
    return acc + dayOverbreak;
  }, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-slate-900 text-white p-6 shrink-0 relative z-10 w-full overflow-y-auto max-h-[35vh]">
        <DialogHeader>
          <div className="flex flex-col gap-4">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                   {s.employeeName.substring(0, 2).toUpperCase()}
                 </div>
                 <div>
                   <DialogTitle className="text-2xl font-black text-left">{s.employeeName}</DialogTitle>
                   <div className="flex items-center gap-3 mt-1">
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
  
                  {!isOnlyWcGlobally && (
                    <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700 w-full sm:w-auto overflow-x-auto gap-1">
                      <button
                        onClick={() => setOnlyExceptions(!onlyExceptions)}
                        className={`px-3 py-1.5 shrink-0 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors w-full sm:w-auto ${onlyExceptions ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                      >
                        {t('exceptions')}
                      </button>
                      <button
                        onClick={() => setIncludeWc(!includeWc)}
                        className={`px-3 py-1.5 shrink-0 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors w-full sm:w-auto ${includeWc ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                      >
                        {t('includeWc')}
                      </button>
                      <div className="flex items-center gap-1 bg-slate-700/50 px-2 py-1.5 shrink-0 rounded-md ml-1 border border-slate-600/50">
                         <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">TOTAL</span>
                         <span className="text-[10px] font-black text-rose-400">+{totalPeriodOverbreak}m</span>
                      </div>
                    </div>
                  )}
                  {isOnlyWcGlobally && (
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full sm:w-auto mt-2 sm:mt-0 shadow-inner">
                       <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">TEMPO TOTAL (WC)</span>
                       <span className="text-sm font-black text-amber-500">{Math.floor(totalPeriodOverbreak / 60)}h {totalPeriodOverbreak % 60}m</span>
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
              <DayRecordCard key={`${day.date}-${idx}`} record={day} isOnlyWcGlobally={isOnlyWcGlobally} />
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

const DayRecordCard: React.FC<{ record: EmployeeDayRecord; isOnlyWcGlobally?: boolean }> = ({ record, isOnlyWcGlobally }) => {
    const isWcAlert = record.wcDuration > 10;
    const hasAnyOverbreak = record.mealOverbreak > 0 || record.shortOverbreak > 0 || record.wellnessOverbreak > 0 || record.prayingOverbreak > 0 || isWcAlert || record.idleDuration > 0;
    
    const isHighlighted = isOnlyWcGlobally ? record.wcDuration > 0 : hasAnyOverbreak;

    // Filter breaks to only show WC if isOnlyWcGlobally is true
    const visibleBreaks = record.breaks.filter(b => {
        if (b.type === 'offline') return false;
        if (isOnlyWcGlobally && b.type !== 'wc') return false;
        return true;
    });

    return (
        <div className={`flex flex-col p-5 border rounded-2xl shadow-sm transition-all relative overflow-hidden bg-white ${isHighlighted ? (isOnlyWcGlobally ? 'border-amber-200 ring-amber-50/50 ring-4' : 'border-rose-200 ring-rose-50/50 ring-4') : 'border-slate-100'}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-3">
                    <span className={`text-base font-black tracking-tight ${isHighlighted ? (isOnlyWcGlobally ? 'text-amber-900' : 'text-rose-900') : 'text-slate-900'}`}>{format(new Date(record.date), 'dd/MM/yyyy')}</span>
                    {record.inferredShift && (
                       <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                          Shift: {record.inferredShift}
                       </span>
                    )}
                    {hasAnyOverbreak && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-black uppercase tracking-wider">
                        Overbreak
                      </span>
                    )}
                </div>
            </div>

            {record.hasMealWithoutShortAnomaly && !isOnlyWcGlobally && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                   <AlertTriangle className="text-amber-500 shrink-0 w-4 h-4 mt-0.5" />
                   <div>
                       <p className="text-xs font-bold text-amber-800">Possível Junção de Pausas</p>
                       <p className="text-[10px] text-amber-700/80">Meal break excedeu 1h15m, porém não há registro de Short Break logo após. Overbreak não deduzido, assumido como meal + short.</p>
                   </div>
                </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-4 relative z-10 w-full mb-5 border-b border-slate-100 pb-5">
                {!isOnlyWcGlobally && (
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
                    <p className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1">WC {/*isOnlyWcGlobally ? 'Total' : '(10m)'*/}{isOnlyWcGlobally ? '' : '(10m)'}</p>
                    <div className="flex items-center gap-2">
                        {isOnlyWcGlobally ? (
                            <span className="text-base font-black text-amber-600">{Math.floor(record.wcDuration/60)}h {record.wcDuration%60}m</span>
                        ) : isWcAlert ? (
                            <span className="text-base font-black text-amber-600">+{record.wcOverbreak}m</span>
                        ) : (
                            <span className="text-base font-black text-emerald-500">OK</span>
                        )}
                    </div>
                </div>
                
                {!isOnlyWcGlobally && (
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
            </div>
            
            {visibleBreaks.length > 0 && (
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Timeline Detalhada</p>
                    <div className="flex flex-wrap gap-1.5">
                        {visibleBreaks.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()).map((b, i) => {
                            const isOverbreak = b.durationMinutes > (
                                b.type === 'wc' ? 10 : 
                                (b.type === 'wellness' || b.type === 'praying') ? 15 : 
                                b.type === 'short' ? 30 : 
                                b.type === 'meal' ? 60 : 
                                b.type === 'idle' ? 0 : Infinity
                            );
                            
                            return (
                                <div key={i} className={`flex items-center px-2 py-1 rounded text-[10px] border gap-1.5 shadow-sm ${isOverbreak ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        b.type === 'meal' ? 'bg-blue-400' : 
                                        b.type === 'wc' ? 'bg-amber-400' : 
                                        b.type === 'short' ? 'bg-emerald-400' :
                                        b.type === 'wellness' ? 'bg-indigo-400' : 
                                        b.type === 'praying' ? 'bg-purple-400' :
                                        b.type === 'idle' ? 'bg-red-500' :
                                        b.type === 'forgot_status' ? 'bg-slate-700' :
                                        'bg-slate-400'
                                    }`} />
                                    <span className={`font-bold ${isOverbreak ? 'text-rose-900' : 'text-slate-700'}`}>
                                        {format(b.startTime, 'HH:mm')} 
                                        <span className={`font-normal mx-0.5 ${isOverbreak ? 'text-rose-400' : 'text-slate-400'}`}>a</span> 
                                        {format(b.endTime, 'HH:mm')}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase ml-1 ${isOverbreak ? 'text-rose-700' : 'text-slate-400'}`} title={b.rawStatus}>
                                        {b.type === 'other' || b.type === 'forgot_status' ? (b.rawStatus || b.type) : b.type} ({b.durationMinutes}m)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
