import { useState, useMemo, useCallback } from 'react';
import { EmployeeSummary, EmployeeDayRecord } from '../types';
import { isSupportRole } from './LOBAnalytics';
import { formatLOB } from '../lib/shiftUtils';
import { format, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Calendar, Clock, User, UserCheck, Search, Users, UserX, Activity, LayoutList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '../contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface SupportScheduleProps {
  summaries: EmployeeSummary[];
  allSummaries: EmployeeSummary[];
}

export function SupportSchedule({ summaries, allSummaries }: SupportScheduleProps) {
  const { t, lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'prevMonth' | 'week' | 'yesterday' | 'today'>('all');
  const [shiftFilter, setShiftFilter] = useState<string[]>([]);
  const [selectedTL, setSelectedTL] = useState<string | null>(null);

  const getLobColorClasses = (lob: string) => {
    const hash = lob.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
        'text-blue-600 bg-blue-50 border-blue-100/50',
        'text-indigo-600 bg-indigo-50 border-indigo-100/50',
        'text-violet-600 bg-violet-50 border-violet-100/50',
        'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100/50',
        'text-rose-600 bg-rose-50 border-rose-100/50',
        'text-orange-600 bg-orange-50 border-orange-100/50',
        'text-amber-600 bg-amber-50 border-amber-100/50',
        'text-emerald-600 bg-emerald-50 border-emerald-100/50',
        'text-cyan-600 bg-cyan-50 border-cyan-100/50',
    ];
    return colors[hash % colors.length];
  };

  const tlResponsibilities = useMemo(() => {
    const map: Record<string, Record<string, Set<string>>> = {};
    allSummaries.forEach(agent => {
      if (agent.supervisor) {
        const tlName = agent.supervisor;
        if (!map[tlName]) {
          map[tlName] = {};
        }
        if (agent.lob) {
           if (!map[tlName][agent.lob]) {
               map[tlName][agent.lob] = new Set<string>();
           }
           if (agent.language && agent.language.toUpperCase() !== 'ALL') {
               map[tlName][agent.lob].add(agent.language);
           }
        }
      }
    });
    
    // Also include own lob/lang if not OS
    summaries.forEach(s => {
       if (s.role && s.role.toUpperCase() === 'TL') {
           if (!map[s.employeeName]) {
              map[s.employeeName] = {};
           }
           if (s.lob && s.lob.toUpperCase() !== 'OS') {
               if (!map[s.employeeName][s.lob]) {
                   map[s.employeeName][s.lob] = new Set<string>();
               }
               if (s.language && s.language.toUpperCase() !== 'ALL') {
                   map[s.employeeName][s.lob].add(s.language);
               }
           }
       }
    });

    const finalMap: Record<string, { lob: string, langs: string[] }[]> = {};
    for (const tl in map) {
      finalMap[tl] = Object.keys(map[tl]).sort().map(lob => ({
         lob,
         langs: Array.from(map[tl][lob]).sort()
      }));
    }
    return finalMap;
  }, [allSummaries, summaries]);

  // Precompute how many NON-SUPPORT agents actually report to each TL
  const agentsCountPerTL = useMemo(() => {
    const counts: Record<string, number> = {};
    allSummaries.forEach(agent => {
      // Avoid counting themselves or other support roles
      if (!isSupportRole(agent) && agent.supervisor && agent.lob !== 'Stranded Resource') {
        counts[agent.supervisor] = (counts[agent.supervisor] || 0) + 1;
      }
    });
    return counts;
  }, [allSummaries]);

  // 1. Get support staff (redundant check but safe)
  const allSupport = useMemo(() => {
    return summaries.filter(s => isSupportRole(s));
  }, [summaries]);

  const maxDateInRecords = useMemo(() => {
    let max = 0;
    allSupport.forEach(s => s.dailyRecords.forEach(r => {
      try {
        const d = parseISO(r.date);
        if (!isNaN(d.getTime())) {
          if (d.getTime() > max) max = d.getTime();
        }
      } catch (e) {
        // ignore
      }
    }));
    if (max === 0) {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return new Date(max);
  }, [allSupport]);

  // 2. Local period filtering logic
  const recordTimeFilterFn = useCallback((r: EmployeeDayRecord) => {
    // Current period reference (uses actual system date per request)
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
    
    // Parse the record date (YYYY-MM-DD)
    const recordDate = parseISO(r.date);
    if (isNaN(recordDate.getTime())) return true;

    if (timeFilter === 'all') return true;
    
    if (timeFilter === 'month') {
      return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
    }
    
    if (timeFilter === 'prevMonth') {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return recordDate.getMonth() === prevMonthDate.getMonth() && recordDate.getFullYear() === prevMonthDate.getFullYear();
    }
    
    if (timeFilter === 'week') {
      const beginOfWeek = new Date(today);
      beginOfWeek.setDate(today.getDate() - today.getDay());
      beginOfWeek.setHours(0,0,0,0);
      const endOfWeek = new Date(beginOfWeek);
      endOfWeek.setDate(beginOfWeek.getDate() + 6);
      endOfWeek.setHours(23,59,59,999);
      return recordDate >= beginOfWeek && recordDate <= endOfWeek;
    }
    
    if (timeFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return recordDate.getFullYear() === yesterday.getFullYear() && 
             recordDate.getMonth() === yesterday.getMonth() && 
             recordDate.getDate() === yesterday.getDate();
    }
    
    if (timeFilter === 'today') {
      const isTodayDate = recordDate.getFullYear() === today.getFullYear() && 
             recordDate.getMonth() === today.getMonth() && 
             recordDate.getDate() === today.getDate();
             
      const hasWorkingShift = !r.isOFF && !r.isPTO && !r.isSL && !r.isLOA && !r.isSUSPP && !r.isATT && r.scheduledShift;
      return isTodayDate && hasWorkingShift;
    }
    
    return true;
  }, [timeFilter]);

  const cleanShift = (s: string) => {
    const trimmed = s.trim();
    // Handle both 09:00-18:00 and 09:00 - 18:00
    const match = trimmed.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    return trimmed;
  };

  // 3. Filter dailyRecords matching the exact period and exact scheduled shift
  const filteredSummaries = useMemo(() => {
    return allSupport.map(s => {
       const records = s.dailyRecords.filter(r => {
          if (!recordTimeFilterFn(r)) return false;
          
          if (shiftFilter.length > 0) {
             const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : null;
             if (!activeShift) return false;
             
             const shiftMatch = activeShift.match(/^(\d{1,2}):\d{2}/);
             if (shiftMatch) {
               const startHour = parseInt(shiftMatch[1], 10);
               let shiftType = 'Manhã';
               if (startHour >= 14 && startHour < 22) shiftType = 'Tarde';
               else if (startHour >= 22 || startHour < 5) shiftType = 'Noite';
               
               if (!shiftFilter.includes(shiftType)) return false;
             } else {
               return false;
             }
          }
          return true;
       });

       return { ...s, dailyRecords: records };
    }).filter(s => {
       if (s.dailyRecords.length === 0) return false;
       const allATT = s.dailyRecords.every(r => r.isATT);
       return !allATT;
    });
  }, [allSupport, recordTimeFilterFn, shiftFilter]);

  // 4. Identify all unique dates in the current filtered subset
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    filteredSummaries.forEach(s => {
      s.dailyRecords.forEach(r => dateSet.add(r.date));
    });
    return Array.from(dateSet).sort();
  }, [filteredSummaries]);

  // 5. Filter staff by search term
  const finalStaff = useMemo(() => {
    if (!searchTerm) return filteredSummaries;
    const term = searchTerm.toLowerCase();
    return filteredSummaries.filter(s => 
      s.employeeName.toLowerCase().includes(term) ||
      (s.role && s.role.toLowerCase().includes(term)) ||
      (s.lob && s.lob.toLowerCase().includes(term))
    );
  }, [filteredSummaries, searchTerm]);

  // 6. Group by specific function/LOB
  const groupedStaff = useMemo(() => {
    const map = new Map<string, EmployeeSummary[]>();
    finalStaff.forEach(s => {
      let groupName = t('supportOther');
      const sRole = s.role ? String(s.role).toUpperCase().trim() : '';
      const sLob = s.lob ? String(s.lob).toUpperCase().trim() : '';

      const supportRegex = /\b(QA|RTA|TRAINER|SUPERVISOR|MANAGER|TL|WFM|REAL TIME|OPS|COORDINATOR|QUALITY)\b/i;
      const osRegex = /\b(OPERATIONAL SUPPORT|OS)\b/i;
      
      const roleMatch = sRole.match(supportRegex);
      const lobMatch = sLob.match(supportRegex);

      if (roleMatch && roleMatch[1]) {
          groupName = roleMatch[1].toUpperCase();
      } else if (lobMatch && lobMatch[1]) {
          groupName = lobMatch[1].toUpperCase();
      } else if (sRole.match(osRegex)) {
          groupName = 'OS';
      } else if (sLob.match(osRegex)) {
          groupName = 'OS';
      } else if (sLob) {
          groupName = sLob;
      } else if (sRole) {
          groupName = sRole;
      }
      
      // Standardize common variations
      if (groupName === 'REAL TIME') groupName = 'RTA';
      if (groupName === 'QUALITY') groupName = 'QA';
      if (groupName === 'OPERATIONAL SUPPORT') groupName = 'OS';
      
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName)!.push(s);
    });

    const entries = Array.from(map.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [finalStaff, t]);

  const toggleShiftFilter = (shift: string) => {
    setShiftFilter(prev => 
      prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift]
    );
  };

  const availableShifts = useMemo(() => {
    return ['Manhã', 'Tarde', 'Noite'];
  }, []);


  const getStatusDisplay = (r: EmployeeDayRecord) => {
    if (r.isOFF) return { text: "OFF", color: "bg-slate-100 text-slate-500 border-slate-200" };
    if (r.isPTO) return { text: "PTO (Vacation)", color: "bg-purple-50 text-purple-600 border-purple-200" };
    if (r.isSL) return { text: "SL (Sick)", color: "bg-rose-50 text-rose-600 border-rose-200" };
    if (r.isLOA) return { text: "LOA (Leave)", color: "bg-orange-50 text-orange-600 border-orange-200" };
    if (r.isSUSPP) return { text: "SUSPP", color: "bg-red-100 text-red-800 border-red-300" };
    if (r.isATT) return { text: "ATT", color: "bg-slate-900 text-white border-slate-700" };

    if (!r.scheduledShift) return { text: "No schedule", color: "bg-slate-50 text-slate-400 border-dashed border-slate-300" };

    // Default morning color
    let color = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold shadow-sm";
    
    // Parse start time if format is HH:MM
    const shiftMatch = String(r.scheduledShift).match(/^(\d{1,2}):\d{2}/);
    if (shiftMatch) {
      const startHour = parseInt(shiftMatch[1], 10);
      if (startHour >= 12 && startHour < 18) {
        // Afternoon/Evening -> Amber
        color = "bg-amber-50 text-amber-700 border-amber-200 font-bold shadow-sm";
      } else if (startHour >= 18 || startHour < 5) {
        // Night -> Indigo
        color = "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shadow-sm";
      }
    }

    return { text: r.scheduledShift, color };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            Support Staff details
          </h2>
          <p className="text-slate-500 mt-1">Overview of shifts and availability for OS/Support team members.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input 
            placeholder="Search staff..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-y border-slate-100 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{String(t('period') || '').toUpperCase()}:</span>
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'TODOS' },
              { id: 'prevMonth', label: 'MÊS PASSADO' },
              { id: 'month', label: 'MÊS ATUAL' },
              { id: 'week', label: '7 DIAS' },
              { id: 'yesterday', label: 'ONTEM' },
              { id: 'today', label: 'HOJE' }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeFilter(opt.id as any)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all whitespace-nowrap ${
                  timeFilter === opt.id 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {opt.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{String(t('shift') || '').toUpperCase()}:</span>
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShiftFilter([])}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all whitespace-nowrap ${
                shiftFilter.length === 0 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {String(t('allShifts') || '').toUpperCase()}
            </button>
            {availableShifts.map((s) => (
              <button
                key={s}
                onClick={() => toggleShiftFilter(s)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all whitespace-nowrap ${
                  shiftFilter.includes(s) 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {groupedStaff.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center shadow-sm">
          <UserX className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-slate-700">No support staff found</h3>
          <p className="text-slate-500">Check your current filter settings or date range.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedStaff.map(([role, staff]) => (
            <div key={role} className="flex flex-col gap-3">
              <h3 className="text-lg font-black text-slate-800 border-b pb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                {role}
                <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-2">
                  {staff.length}
                </span>
              </h3>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 font-semibold text-slate-600 min-w-[250px] max-w-[250px] uppercase text-[10px] tracking-wider sticky left-0 z-20 bg-slate-50/95 backdrop-blur-sm shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-200">Agent</th>
                      {allDates.map(date => {
                        const isTodayStr = (() => {
                          const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
                          const dDate = parseISO(date);
                          return dDate.getFullYear() === today.getFullYear() && dDate.getMonth() === today.getMonth() && dDate.getDate() === today.getDate();
                        })();
                        const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6;
                        
                        let bgClass = "";
                        if (isTodayStr) bgClass = "bg-blue-100/50 backdrop-blur-sm border-blue-200/50";
                        else if (isWeekend) bgClass = "bg-rose-100 border-rose-200";

                        return (
                        <th key={date} className={`px-4 py-3 font-semibold text-slate-600 min-w-[120px] text-center ${bgClass}`}>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{format(parseISO(date), 'EEE')}</span>
                            <span className="text-sm font-black">{format(parseISO(date), 'dd/MM')}</span>
                          </div>
                        </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staff.map(s => (
                      <tr key={s.employeeName} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-900 sticky left-0 bg-white/90 backdrop-blur-sm z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-b border-slate-100/50 min-w-[250px] max-w-[250px]">
                          <div className="flex flex-col">
                            <div className="flex flex-col min-w-0">
                               <div className="flex items-center gap-2">
                                  <span className="font-bold truncate" title={s.employeeName}>{s.employeeName}</span>
                                  {(agentsCountPerTL[s.employeeName] || 0) > 0 && (
                                     <button 
                                       onClick={() => setSelectedTL(s.employeeName)}
                                       className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-1 rounded-md transition-colors shrink-0"
                                       title="View Agents Details"
                                     >
                                       <Users size={14} />
                                     </button>
                                  )}
                               </div>
                               {s.email && <span className="text-[10px] text-slate-400 truncate opacity-80 mt-0.5" title={s.email}>{s.email}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                              {s.role && s.role.toUpperCase() !== 'OS' && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded tracking-widest font-bold border border-slate-200/50">{s.role}</span>}
                              
                              {(() => {
                                 const res = tlResponsibilities[s.employeeName];
                                 const hideLanguage = s.role && ['RTA', 'REAL TIME', 'TRAINER', 'WFM'].some(r => s.role!.toUpperCase().includes(r));
                                 
                                 if (res && res.length > 0) {
                                    return (
                                       <>
                                         {res.map(({ lob, langs }) => {
                                            const formattedLob = formatLOB(lob);
                                            const comb = langs.length > 0 ? `${formattedLob} | ${langs.join('-')}` : formattedLob;
                                            const colorClass = getLobColorClasses(lob);
                                            return (
                                                <span key={comb} className={`px-1.5 py-0.5 rounded tracking-widest font-bold border ${colorClass}`}>
                                                    {comb}
                                                </span>
                                            );
                                         })}
                                       </>
                                    );
                                 }
                                 
                                 return (
                                    <>
                                       {s.lob && s.lob.toUpperCase() !== 'OS' && <span className={`px-1.5 py-0.5 rounded tracking-widest font-bold border ${getLobColorClasses(s.lob)}`}>{formatLOB(s.lob)}</span>}
                                       {s.language && s.language.toUpperCase() !== 'ALL' && !hideLanguage && <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded tracking-widest font-bold border border-purple-200/50">{s.language}</span>}
                                    </>
                                 );
                              })()}
                            </div>
                          </div>
                        </td>
                        {allDates.map(date => {
                          const isTodayStr = (() => {
                            const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
                            const dDate = parseISO(date);
                            return dDate.getFullYear() === today.getFullYear() && dDate.getMonth() === today.getMonth() && dDate.getDate() === today.getDate();
                          })();
                          const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6;
                          
                          let bgClass = "";
                          if (isTodayStr) bgClass = "bg-blue-50/30";
                          else if (isWeekend) bgClass = "bg-rose-50/80";

                          const record = s.dailyRecords.find(r => r.date === date);
                          if (!record) {
                            return (
                              <td key={date} className={`px-3 py-2 text-center text-slate-300 font-medium ${bgClass}`}>
                                -
                              </td>
                            );
                          }
                          const status = getStatusDisplay(record);
                          return (
                            <td key={date} className={`px-3 py-2 text-center ${bgClass}`}>
                              <span className={`inline-block px-2.5 py-1 text-xs rounded-lg border ${status.color}`}>
                                {status.text}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTL} onOpenChange={(open) => !open && setSelectedTL(null)}>
        <DialogContent style={{ width: '95vw', maxWidth: '1200px' }} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Users className="text-indigo-600" />
              {selectedTL}'s Agents
            </DialogTitle>
            <DialogDescription>
              Operatives mapping separated by LOB and Language.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {(() => {
              // 1. Get agents under this TL
              const agents = allSummaries.filter(a => !isSupportRole(a) && a.supervisor === selectedTL && a.lob !== 'Stranded Resource');
              
              if (agents.length === 0) return <div className="text-slate-500 italic">No agents map found for this TL.</div>;

              // 2. Group by LOB
              const lobGroups: Record<string, Record<string, EmployeeSummary[]>> = {};
              agents.forEach(a => {
                const lob = a.lob || 'Unknown';
                const lang = a.language || 'Unknown';
                if (!lobGroups[lob]) lobGroups[lob] = {};
                if (!lobGroups[lob][lang]) lobGroups[lob][lang] = [];
                lobGroups[lob][lang].push(a);
              });

              return Object.entries(lobGroups).sort().map(([lob, langGroups]) => (
                <div key={lob} className="space-y-4">
                  <h3 className="text-lg font-black text-slate-700 border-b pb-1 flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded uppercase tracking-widest ${getLobColorClasses(lob)}`}>{formatLOB(lob)}</span>
                  </h3>
                  {Object.entries(langGroups).sort().map(([lang, agentsList]) => (
                    <div key={lang} className="ml-4 space-y-3">
                        <h4 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          {lang} <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{agentsList.length}</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {agentsList.map(agent => {
                              const todayStr = format(new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" })), 'yyyy-MM-dd');
                              const todayRecord = agent.dailyRecords.find(r => r.date === todayStr);
                              const firstName = agent.employeeName.split(' ')[0];
                              
                              return (
                                <div key={agent.employeeName} className="p-3 border border-slate-200 rounded-xl shadow-sm bg-white hover:border-indigo-200 transition-colors flex flex-col h-full min-w-0">
                                  <div className="font-bold text-slate-800 text-sm truncate" title={agent.employeeName}>{firstName}</div>
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5" title={agent.email || ''}>{agent.email || 'No email provided'}</div>
                                  
                                  <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100">
                                      <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px] mr-1">Shift:</span>
                                      {todayRecord ? (
                                        <span className={`font-black px-1.5 py-0.5 rounded text-[8.5px] tracking-tight whitespace-nowrap text-center ${todayRecord.isOFF || todayRecord.isPTO || todayRecord.isSL ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
                                            {todayRecord.isOFF ? 'OFF' : (todayRecord.isPTO ? 'PTO' : (todayRecord.isSL ? 'SL' : (todayRecord.scheduledShift || 'None')))}
                                        </span>
                                      ) : (
                                        <span className="font-bold text-slate-400 italic text-[9px]">No Data</span>
                                      )}
                                  </div>
                                </div>
                              );
                          })}
                        </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
