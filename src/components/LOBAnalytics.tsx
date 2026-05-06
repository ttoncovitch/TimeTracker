import React, { useMemo, useState } from 'react';
import { EmployeeSummary } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, AlertTriangle, Clock, CalendarX, TrendingDown, Target, Globe } from 'lucide-react';

interface LOBAnalyticsProps {
  summaries: EmployeeSummary[];
}

export const SUPPORT_ROLES = ['qa', 'rta', 'sr tl', 'tl', 'trainer', 'quality assurance', 'team leader', 'supervisor', 'senior team leader'];

export function isSupportRole(lob: string): boolean {
  if (!lob) return false;
  const lowerLob = lob.toLowerCase().trim();
  if (SUPPORT_ROLES.includes(lowerLob)) return true;
  // also check if " - qa" or similar
  if (SUPPORT_ROLES.some(role => lowerLob === role || lowerLob.endsWith(` ${role}`) || lowerLob.startsWith(`${role} `))) return true;
  return false;
}

export function LOBAnalytics({ summaries }: LOBAnalyticsProps) {
  // Group summaries by LOB, excluding support roles
  const lobsData = useMemo(() => {
    const lobs: Record<string, EmployeeSummary[]> = {};
    
    summaries.forEach(s => {
      // Exclude agents who don't have any active working records in the period
      const hasWorkingSchedule = s.dailyRecords.some(r => (!r.isOFF && !r.isPTO && !r.isLOA && !r.isSL && !r.isSUSPP && !r.isATT) || r.isAbsence);
      if (!hasWorkingSchedule) return;

      const lob = (s.lob && s.lob.trim() !== '') ? s.lob : 'Unknown';
      if (isSupportRole(lob)) return; // Exclude QA, RTA, etc.
      if (lob.toUpperCase() === 'LEG') return; // Exclude LEG
      
      if (!lobs[lob]) {
        lobs[lob] = [];
      }
      lobs[lob].push(s);
    });

    return lobs;
  }, [summaries]);

  const lobNames = Object.keys(lobsData).sort();

  if (lobNames.length === 0) {
     return (
        <div className="mt-12 mb-24 px-4 text-center">
           <h2 className="text-xl font-bold text-slate-500">Nenhum LOB de operação encontrado ou selecionado.</h2>
        </div>
     );
  }

  const mostCriticalLOB = useMemo(() => {
    if (lobNames.length === 0) return null;
    
    const lobScores = lobNames.map(lobName => {
       const lobSummaries = lobsData[lobName];
       let score = 0;
       lobSummaries.forEach(s => {
           score += (s.totalOverbreakMinutes || 0);
           score += (s.totalAbsences || 0) * 60;
           score += Math.floor((s.totalTardinessMinutes || 0));
       });
       return { name: lobName, score };
    });
    
    lobScores.sort((a, b) => b.score - a.score);
    if (lobScores[0].score === 0) return null;
    
    // If exact match 'Unknown' we fallback to the second biggest if it exists
    const biggest = lobScores[0];
    if (biggest.name === 'Unknown' && lobScores.length > 1 && lobScores[1].score > 0) {
      return lobScores[1];
    }
    return biggest;
  }, [lobsData, lobNames]);

  return (
    <div className="mt-12 mb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
            <Target className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">LOB's Performance</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Análise de Pontos de Melhoria por Operação e Língua</p>
          </div>
        </div>

        {mostCriticalLOB && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200/60 rounded-2xl p-3 px-4 shadow-sm">
             <AlertTriangle className="w-5 h-5 text-rose-500" />
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Maior Infrator (No Filtro)</span>
               <span className="text-sm font-black text-rose-800">{mostCriticalLOB.name}</span>
             </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-4">
        {lobNames.map((lobName, idx) => (
           <LOBCard key={lobName} lobName={lobName} summaries={lobsData[lobName]} idx={idx} />
        ))}
      </div>
    </div>
  );
}

interface LOBCardProps {
  lobName: string;
  summaries: EmployeeSummary[];
  idx: number;
}

const LOBCard: React.FC<LOBCardProps> = ({ lobName, summaries, idx }) => {
   const languages = useMemo(() => {
      const langs = new Set<string>();
      summaries.forEach(s => {
         const l = (s.language && s.language.trim() !== '') ? s.language.toUpperCase().trim() : 'N/A';
         langs.add(l);
      });
      return ['ALL', ...Array.from(langs).sort()];
   }, [summaries]);

   const [selectedLang, setSelectedLang] = useState('ALL');

   const stats = useMemo(() => {
      const filtered = selectedLang === 'ALL' 
         ? summaries 
         : summaries.filter(s => {
             const l = (s.language && s.language.trim() !== '') ? s.language.toUpperCase().trim() : 'N/A';
             return l === selectedLang;
         });

      let agentCount = 0;
      let totalOverbreak = 0;
      let totalAbsences = 0;
      let wcAlerts = 0;
      let idleAlerts = 0;
      let employeeWithAbsences = 0;
      let totalTardiness = 0;
      const topAgents: { name: string; overbreak: number; absences: number; lang: string }[] = [];

      filtered.forEach(s => {
         agentCount++;
         totalOverbreak += s.totalOverbreakMinutes || 0;
         totalAbsences += s.totalAbsences || 0;
         if ((s.totalAbsences || 0) > 0) employeeWithAbsences++;
         wcAlerts += s.wcAlerts || 0;
         idleAlerts += s.idleAlerts || 0;
         totalTardiness += s.totalTardinessMinutes || 0;

         if (s.totalOverbreakMinutes > 0 || s.totalAbsences > 0 || Math.floor((s.totalTardinessMinutes || 0)/60) > 0) {
             topAgents.push({
                name: s.employeeName,
                overbreak: s.totalOverbreakMinutes || 0,
                absences: s.totalAbsences || 0,
                lang: (s.language && s.language.trim() !== '') ? s.language.toUpperCase().trim() : 'N/A'
             });
         }
      });

      topAgents.sort((a, b) => (b.overbreak + b.absences * 60) - (a.overbreak + a.absences * 60));

      return {
         agentCount,
         totalOverbreak,
         totalAbsences,
         wcAlerts,
         idleAlerts,
         employeeWithAbsences,
         totalTardiness,
         topAgents: topAgents.slice(0, 4)
      };
   }, [summaries, selectedLang]);

   return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: idx * 0.05 }}
        className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group relative overflow-hidden flex flex-col"
      >
        <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-110 ${stats.totalOverbreak > 500 || stats.totalAbsences > 2 ? 'bg-rose-500' : 'bg-indigo-500'}`} />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex flex-col">
              <h3 className="text-xl font-black text-slate-900 leading-tight">{lobName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                   <Users className="w-3 h-3" /> {stats.agentCount} agentes
                </span>
                {(stats.totalOverbreak > 500 || stats.totalAbsences > 3) && (
                  <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase">Crítico</span>
                  </div>
                )}
              </div>
            </div>

            {/* Language Selector */}
            {languages.length > 2 && (
               <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
                 {languages.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLang(lang)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${selectedLang === lang ? 'bg-indigo-600 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                    >
                      {lang === 'ALL' ? 'Todas' : lang}
                    </button>
                 ))}
               </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-4 mb-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> Overbreak
              </span>
              <div className="flex flex-col">
                <span className={`text-xl font-black leading-none ${stats.totalOverbreak > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {Math.floor(stats.totalOverbreak / 60)}h <span className="text-sm">{stats.totalOverbreak % 60}m</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">Méd: {stats.agentCount > 0 ? Math.round(stats.totalOverbreak / stats.agentCount) : 0}m / ag</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <CalendarX className="w-3 h-3" /> Faltas
              </span>
              <div className="flex flex-col">
                <span className={`text-xl font-black leading-none ${stats.totalAbsences > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {stats.totalAbsences}
                </span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">{stats.employeeWithAbsences} Agfaltaram</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> IDLE/WC
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-black leading-none text-amber-600">
                  {stats.idleAlerts + stats.wcAlerts}
                </span>
                <div className="flex gap-2 text-[9px] font-black text-slate-400 uppercase mt-1">
                  <span>WC:{stats.wcAlerts}</span>
                  <span>IDLE:{stats.idleAlerts}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3" /> Atrasos
              </span>
              <div className="flex flex-col">
                <span className={`text-xl font-black leading-none ${stats.totalTardiness > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {Math.floor(stats.totalTardiness / 60)}h <span className="text-sm">{stats.totalTardiness % 60}m</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">Tempo total</span>
              </div>
            </div>
          </div>

          {/* Top Agents List */}
          <div className="mt-auto pt-5 border-t border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Maiores Infratores ({selectedLang === 'ALL' ? 'Todas as Línguas' : selectedLang})
            </span>
            <div className="space-y-2">
              {stats.topAgents.length === 0 ? (
                 <div className="text-[11px] text-slate-400 font-bold py-2 bg-slate-50/50 rounded-lg text-center border border-slate-100/50">Nenhum agente crítico nesta seleção.</div>
              ) : stats.topAgents.map((agent, aIdx) => (
                <div key={`${agent.name}-${aIdx}`} className="flex items-center justify-between text-left bg-slate-50/80 p-2.5 rounded-xl border border-transparent hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className="text-[10px] font-black text-slate-300 w-4 shrink-0 text-center">#{aIdx + 1}</span>
                    <span className="text-[11px] font-bold text-slate-700 truncate">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {selectedLang === 'ALL' && agent.lang !== 'N/A' && (
                       <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 border border-indigo-100 rounded flex items-center gap-0.5">
                         {agent.lang}
                       </span>
                    )}
                    {agent.absences > 0 && (
                      <span className="text-[9px] font-black text-red-600 bg-red-50/80 px-1.5 py-0.5 border border-red-100 rounded shadow-sm">Fa: {agent.absences}</span>
                    )}
                    {agent.overbreak > 0 && (
                      <span className="text-[9px] font-black text-rose-600 bg-rose-50/80 px-1.5 py-0.5 border border-rose-100 rounded shadow-sm">
                        Exc: {agent.overbreak}m
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </motion.div>
   );
}
