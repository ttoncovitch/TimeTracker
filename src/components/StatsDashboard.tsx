import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EmployeeSummary, BreakSession } from '../types';
import { AlertCircle, Users, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';

interface StatsDashboardProps {
  summaries: EmployeeSummary[];
  latestDate?: Date;
  globalTypeFilter: 'all' | 'idle_overbreak_wc';
  globalIncludeWc: boolean;
}

const STATUS_COMBOS = [
  { id: 'rest', label: 'Rest', types: ['meal', 'short'], color: 'bg-lime-500' },
  { id: 'wellness', label: 'Wellness', types: ['wellness', 'praying'], color: 'bg-blue-400' },
  { id: 'idle', label: 'Idle', types: ['idle'], color: 'bg-rose-500' }
];

export function StatsDashboard({ summaries, latestDate, globalTypeFilter, globalIncludeWc }: StatsDashboardProps) {
  const { t } = useLanguage();
  const isOnlyWcGlobally = globalTypeFilter === 'all' && globalIncludeWc;

  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [selectedStatusCombo, setSelectedStatusCombo] = useState<string>('rest');
  const [detailsSortMode, setDetailsSortMode] = useState<'duration' | 'date'>('duration');
  
  const activeStatusFilter = statusFilterActive && selectedStatusCombo 
    ? STATUS_COMBOS.find(c => c.id === selectedStatusCombo) 
    : null;

  const dashboardSummaries = useMemo(() => {
    if (!activeStatusFilter) return summaries;

    const allowedTypes = activeStatusFilter.types;

    return summaries.map(s => {
      const newRecords = s.dailyRecords.map(r => {
        const allowedBreaks = r.breaks.filter(b => allowedTypes.includes(b.type));
        
        let wcDur = 0, idleDur = 0, mealDur = 0, shortDur = 0, wellnessDur = 0, prayingDur = 0;
        let wcOver = 0, idleOver = 0, mealOver = 0, shortOver = 0, wellnessOver = 0, prayingOver = 0;
        
        allowedBreaks.forEach(b => {
           if (b.type === 'wc') { wcDur += b.durationMinutes; }
           else if (b.type === 'idle') { idleDur += b.durationMinutes; }
           else if (b.type === 'meal') { mealDur += b.durationMinutes; }
           else if (b.type === 'short') { shortDur += b.durationMinutes; }
           else if (b.type === 'wellness') { wellnessDur += b.durationMinutes; }
           else if (b.type === 'praying') { prayingDur += b.durationMinutes; }
        });

        if (allowedTypes.includes('wc')) { wcOver = wcDur > 10 ? wcDur - 10 : 0; }
        if (allowedTypes.includes('idle')) { idleOver = idleDur; }
        if (allowedTypes.includes('meal')) { mealOver = Math.max(0, mealDur - 60); }
        if (allowedTypes.includes('short')) { shortOver = Math.max(0, shortDur - 30); }
        if (allowedTypes.includes('wellness')) { wellnessOver = Math.max(0, wellnessDur - 15); }
        if (allowedTypes.includes('praying')) { prayingOver = Math.max(0, prayingDur - 15); }

        const totalOverbreak = wcOver + idleOver + mealOver + shortOver + wellnessOver + prayingOver;
        
        return {
          ...r,
          breaks: allowedBreaks,
          wcDuration: wcDur,
          idleDuration: idleDur,
          mealDuration: mealDur,
          shortDuration: shortDur,
          wellnessDuration: wellnessDur,
          prayingDuration: prayingDur,
          wcOverbreak: wcOver,
          idleOverbreak: idleOver,
          mealOverbreak: mealOver,
          shortOverbreak: shortOver,
          wellnessOverbreak: wellnessOver,
          prayingOverbreak: prayingOver,
          totalOverbreak
        };
      });

      const totalOverbreakMinutes = newRecords.reduce((acc, r) => acc + r.totalOverbreak, 0);
      const wcAlerts = newRecords.reduce((acc, r) => acc + (r.wcDuration > 10 ? 1 : 0), 0);
      const idleAlerts = newRecords.reduce((acc, r) => acc + (r.idleDuration > 0 ? 1 : 0), 0);

      return {
        ...s,
        dailyRecords: newRecords,
        totalOverbreakMinutes,
        wcAlerts,
        idleAlerts
      };
    });
  }, [summaries, activeStatusFilter]);

  const filteredSummaries = dashboardSummaries;

  const totalEmployees = summaries.length; // Raw summaries length for agent count
  
  let affectedCount = 0;
  let affectedText = '';

  if (statusFilterActive && activeStatusFilter) {
      if (activeStatusFilter.id === 'wc') {
          affectedCount = filteredSummaries.filter(s => s.wcAlerts > 0).length;
          affectedText = "Em Excesso de WC";
      } else if (activeStatusFilter.id === 'idle') {
          affectedCount = filteredSummaries.filter(s => s.idleAlerts > 0).length;
          affectedText = "Com Ociosidade";
      } else {
          affectedCount = filteredSummaries.filter(s => s.totalOverbreakMinutes > 0).length;
          affectedText = `Em Overbreak (${activeStatusFilter.label})`;
      }
  } else if (isOnlyWcGlobally) {
      affectedCount = filteredSummaries.filter(s => s.dailyRecords.some(r => r.wcDuration > 0)).length;
      affectedText = "Com Uso de WC";
  } else if (globalTypeFilter === 'idle_overbreak_wc') {
      affectedCount = filteredSummaries.filter(s => s.totalOverbreakMinutes > 0 || (globalIncludeWc && s.wcAlerts > 0) || s.idleAlerts > 0).length;
      affectedText = "Com Exceções";
  } else {
      affectedCount = filteredSummaries.filter(s => s.totalOverbreakMinutes > 0 || s.wcAlerts > 0 || s.idleAlerts > 0).length;
      affectedText = "Com Exceções (Geral)";
  }

  const isWcApplicable = !statusFilterActive || (activeStatusFilter && activeStatusFilter.types.includes('wc'));
  const isIdleApplicable = !statusFilterActive || (activeStatusFilter && activeStatusFilter.types.includes('idle'));

  const totalOverbreak = filteredSummaries.reduce((acc, curr) => acc + curr.totalOverbreakMinutes, 0);
  const totalWcMinutes = filteredSummaries.reduce((acc, curr) => 
    acc + curr.dailyRecords.reduce((a, r) => a + r.wcDuration, 0)
  , 0);
  const totalIdleMinutes = filteredSummaries.reduce((acc, curr) => 
    acc + curr.dailyRecords.reduce((a, r) => a + r.idleDuration, 0)
  , 0);
  const totalWcAgents = filteredSummaries.filter(s => s.dailyRecords.some(r => r.wcDuration > 0)).length;
  const totalIdleAgents = filteredSummaries.filter(s => s.idleAlerts > 0).length;
  
  // Top 5 problematic
  const topProblematic = [...filteredSummaries]
    .filter(s => s.totalOverbreakMinutes > 0)
    .sort((a, b) => b.totalOverbreakMinutes - a.totalOverbreakMinutes)
    .slice(0, 5);

  const topInfrator = topProblematic[0];

  // Top WC
  const topWc = [...filteredSummaries]
    .map(s => {
      const totalWcOver = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
      return { ...s, totalWcOver };
    })
    .filter(s => s.wcAlerts > 0 || s.totalWcOver > 0)
    .sort((a, b) => b.totalWcOver - a.totalWcOver || b.wcAlerts - a.wcAlerts)
    .slice(0, 5);

  // Top Performers
  const topPerformers = [...filteredSummaries]
    .filter(s => !s.isTraining)
    .sort((a, b) => a.totalOverbreakMinutes - b.totalOverbreakMinutes)
    .slice(0, 5);

  const chartData = topProblematic.map(s => {
    const mealOver = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
    const shortOver = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
    const wellnessOver = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
    const prayingOver = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
    const wcOver = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
    const idleOver = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);
    
    const mealDur = s.dailyRecords.reduce((acc, r) => acc + r.mealDuration, 0);
    const shortDur = s.dailyRecords.reduce((acc, r) => acc + r.shortDuration, 0);
    const wellnessDur = s.dailyRecords.reduce((acc, r) => acc + r.wellnessDuration, 0);
    const prayingDur = s.dailyRecords.reduce((acc, r) => acc + r.prayingDuration, 0);
    const wcDur = s.dailyRecords.reduce((acc, r) => acc + r.wcDuration, 0);

    return {
      name: s.employeeName,
      overbreak: s.totalOverbreakMinutes,
      hours: Math.floor(s.totalOverbreakMinutes / 60),
      minutes: s.totalOverbreakMinutes % 60,
      breakdown: { mealOver, shortOver, wellnessOver, prayingOver, wcOver, idleOver, mealDur, shortDur, wellnessDur, prayingDur, wcDur }
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const b = data.breakdown;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs font-medium border border-slate-700">
          <p className="font-black mb-2 text-sm text-slate-100">{data.name}</p>
          <div className="space-y-1.5 text-slate-300">
            <p className="flex justify-between gap-4"><span>Meal</span> <strong className={b.mealOver > 0 ? "text-rose-400" : "text-emerald-400"}>{b.mealOver > 0 ? `+${b.mealOver}m` : (b.mealDur > 0 ? `OK (${b.mealDur}m/60m)` : `OK`)}</strong></p>
            <p className="flex justify-between gap-4"><span>Short</span> <strong className={b.shortOver > 0 ? "text-rose-400" : "text-emerald-400"}>{b.shortOver > 0 ? `+${b.shortOver}m` : (b.shortDur > 0 ? `OK (${b.shortDur}m/30m)` : `OK`)}</strong></p>
            <p className="flex justify-between gap-4"><span>Wellness</span> <strong className={b.wellnessOver > 0 ? "text-rose-400" : "text-emerald-400"}>{b.wellnessOver > 0 ? `+${b.wellnessOver}m` : (b.wellnessDur > 0 ? `OK (${b.wellnessDur}m/15m)` : `OK`)}</strong></p>
            <p className="flex justify-between gap-4"><span>Praying</span> <strong className={b.prayingOver > 0 ? "text-rose-400" : "text-emerald-400"}>{b.prayingOver > 0 ? `+${b.prayingOver}m` : (b.prayingDur > 0 ? `OK (${b.prayingDur}m/15m)` : `OK`)}</strong></p>
            <p className="flex justify-between gap-4"><span>WC</span> <strong className={b.wcOver > 0 ? "text-amber-400" : "text-emerald-400"}>{b.wcOver > 0 ? `+${b.wcOver}m` : (b.wcDur > 0 ? `OK (${b.wcDur}m/10m)` : `OK`)}</strong></p>
            <p className="flex justify-between gap-4"><span>Idle</span> <strong className={b.idleOver > 0 ? "text-red-400" : "text-emerald-400"}>{b.idleOver > 0 ? `+${b.idleOver}m` : `OK`}</strong></p>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-700/50 text-rose-300 font-bold flex justify-between gap-4">
              <span>Total Overbreak</span>
              <span>{data.hours}h {data.minutes}m</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Banner Section: Total Agents and Status Filter */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-stretch">
        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6 flex items-center gap-6 h-full">
            <div className="w-14 h-14 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/50 shadow-inner hidden sm:flex">
              <Users size={28} strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-6 divide-x divide-slate-200 w-full">
              <div className="pr-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Agentes no Período</p>
                <div className="flex items-baseline gap-1.5">
                   <p className="text-3xl font-black text-slate-900 tracking-tight">{totalEmployees}</p>
                   <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Total</span>
                </div>
              </div>
              <div className="pl-6 flex-1">
                <p className={`text-[11px] font-black uppercase tracking-widest mb-1 truncate ${affectedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{affectedText}</p>
                <div className="flex items-baseline gap-1.5">
                   <p className={`text-3xl font-black tracking-tight ${affectedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{affectedCount}</p>
                   <span className={`text-xs font-bold tracking-wide uppercase ${affectedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Afetados</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-visible w-full md:w-auto shrink-0">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Filtro de Status Específico</p>
            <div className="flex items-center gap-4">
              {/* Custom Hover Dropdown */}
              <div className="relative group/dropdown z-50">
                <button className="flex items-center justify-between gap-3 w-56 px-4 py-3 bg-slate-100 text-slate-800 font-bold text-sm rounded-xl border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-all shadow-sm">
                   <div className="flex items-center gap-2.5">
                     <span className={`w-3 h-3 rounded-full ${STATUS_COMBOS.find(c => c.id === selectedStatusCombo)?.color || 'bg-slate-400'}`}></span>
                     <span>{STATUS_COMBOS.find(c => c.id === selectedStatusCombo)?.label || 'Selecione'}</span>
                   </div>
                   <div className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black flex items-center justify-center">
                     <span className="group-hover/dropdown:rotate-180 transition-transform duration-300">▼</span>
                   </div>
                </button>
                
                <div className="absolute top-[calc(100%+8px)] left-0 w-56 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all overflow-hidden transform origin-top-left scale-95 group-hover/dropdown:scale-100">
                  <div className="p-1.5 space-y-0.5">
                     {STATUS_COMBOS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedStatusCombo(c.id); setStatusFilterActive(true); }}
                          className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors ${selectedStatusCombo === c.id ? 'text-white bg-slate-700/80 shadow-inner' : 'text-slate-300'}`}
                        >
                           <div className="flex items-center gap-2.5">
                             <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${c.color}`}></span>
                             {c.label}
                           </div>
                           <span className="text-slate-500 font-medium">›</span>
                        </button>
                     ))}
                  </div>
                </div>
              </div>

              {/* On-Off Switch */}
              <button 
                onClick={() => setStatusFilterActive(!statusFilterActive)}
                className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${statusFilterActive ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className="sr-only">Ativar Filtro de Status</span>
                <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out ${statusFilterActive ? 'translate-x-3.5' : '-translate-x-3.5'}`} />
              </button>
              
              <span className={`text-xs font-bold uppercase tracking-widest ${statusFilterActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {statusFilterActive ? 'ON' : 'OFF'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('avgOverbreak')}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-slate-900">
                {totalEmployees ? Math.round(totalOverbreak / totalEmployees) : 0}
              </p>
              <span className="text-xs font-bold text-slate-400">min</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('wcAlerts')}</p>
            {!isWcApplicable ? (
              <p className="text-2xl font-black text-slate-300">N/A</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-amber-600">{totalWcMinutes}<span className="text-xs">m</span></p>
                <p className="text-xs font-bold text-amber-700/60 uppercase">/ {totalWcAgents} {t('agents')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-red-50">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">{t('idleAlerts')}</p>
            {!isIdleApplicable ? (
              <p className="text-2xl font-black text-red-300">N/A</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-red-600">{totalIdleMinutes}<span className="text-xs">m</span></p>
                <p className="text-xs font-bold text-red-700/60 uppercase">/ {totalIdleAgents} {t('agents')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-r from-rose-50 to-white overflow-hidden relative group" title={topInfrator ? `${Math.floor(topInfrator.totalOverbreakMinutes / 60)}h ${topInfrator.totalOverbreakMinutes % 60}m` : ''}>
          <div className="absolute right-0 top-0 w-32 h-full bg-rose-100/20 translate-x-12 -skew-x-12 group-hover:translate-x-8 transition-transform" />
          <CardContent className="p-5 flex justify-between items-center relative z-10 w-full h-full">
            <div>
              <p className="text-[10px] text-rose-900 font-black uppercase tracking-tighter mb-1">{t('topViolator')}</p>
              <p className="text-xl font-black text-rose-700 break-words">{topInfrator?.employeeName || 'Nenhum'}</p>
              <p className="text-[10px] font-bold text-rose-600/80 mt-1">{topInfrator ? `${topInfrator.totalOverbreakMinutes}m Overbreak` : t('withoutRecords')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-4 rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">{t('needAttention')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] p-6">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis 
                     dataKey="name" 
                     type="category" 
                     width={80} 
                     axisLine={false}
                     tickLine={false}
                     style={{ fontSize: '10px', fontWeight: 700, fill: '#64748b' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="overbreak" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#e11d48' : index < 3 ? '#f43f5e' : '#fb7185'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm font-bold text-slate-400">{t('noViolators')}</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100/50 py-4 shrink-0 rounded-t-2xl">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
              <AlertCircle size={16} /> {t('topWc')}
            </CardTitle>
            <CardDescription className="text-xs text-amber-600/80 mt-1">{t('topWcDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y divide-slate-50">
              {topWc.map((s, i) => (
                 <div key={`${s.employeeName}-${i}`} className="flex items-center justify-between p-3.5 hover:bg-amber-50/30 transition-colors relative group">
                  <div className="flex items-center gap-3 w-full">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-amber-100 text-amber-700'}`}>{i+1}</span>
                    <div className="min-w-0 pr-4">
                      <p className="font-bold text-xs text-slate-800 truncate">{s.employeeName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {s.totalWcOver > 0 ? `${s.totalWcOver}m ${t('exceededTime')}` : ''}{s.wcAlerts > 0 && s.totalWcOver > 0 ? ' • ' : ''}{s.wcAlerts > 0 ? `${s.wcAlerts} ${t('alerts').toLowerCase()}` : ''}
                      </p>
                    </div>
                  </div>
                 </div>
              ))}
              {topWc.length === 0 && (
                <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 py-4 shrink-0 rounded-t-2xl">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} /> {t('topPerformers')}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600/80 mt-1">{t('topPerformersDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y divide-slate-50">
              {topPerformers.map((s, i) => {
                const mealObj = s.dailyRecords.reduce((acc, r) => acc + r.mealDuration, 0);
                const shortObj = s.dailyRecords.reduce((acc, r) => acc + r.shortDuration, 0);
                const mealOver = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
                const shortOver = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
                const wellnessObj = s.dailyRecords.reduce((acc, r) => acc + r.wellnessDuration, 0);
                const wellnessOver = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
                const prayingObj = s.dailyRecords.reduce((acc, r) => acc + r.prayingDuration, 0);
                const prayingOver = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
                const wcObj = s.dailyRecords.reduce((acc, r) => acc + r.wcDuration, 0);
                const wcOver = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
                const idleObj = s.dailyRecords.reduce((acc, r) => acc + r.idleDuration, 0);
                
                const hasAnyOverbreak = s.totalOverbreakMinutes > 0 || s.wcAlerts > 0 || s.idleAlerts > 0;

                return (
                 <div key={`${s.employeeName}-${i}`} className="flex items-center justify-between p-3.5 hover:bg-emerald-50/30 transition-colors relative group">
                  <div className="flex items-center gap-3 w-full">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 ${i === 0 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-emerald-100 text-emerald-700'}`}>{i+1}</span>
                    <div className="min-w-0 pr-4 cursor-help">
                      <p className="font-bold text-xs text-slate-800 truncate">{s.employeeName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {!hasAnyOverbreak 
                           ? t('perfectPerformance') 
                           : `${s.totalOverbreakMinutes}m exc • ${s.wcAlerts} wc`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Tooltip Hover */}
                  <div className="absolute right-full mr-2 top-0 z-50 hidden group-hover:block w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-white">
                    {!hasAnyOverbreak ? (
                       <div className="flex items-center gap-2 text-emerald-400 mb-2 border-b border-slate-700/50 pb-2">
                         <CheckCircle2 size={16} />
                         <span className="font-bold text-xs">Tudo OK!</span>
                       </div>
                    ) : (
                       <div className="font-bold text-xs text-rose-400 mb-2 border-b border-slate-700/50 pb-2">Exceções:</div>
                    )}
                    <div className="space-y-1 text-[10px] font-medium text-slate-300">
                      <div className="flex justify-between"><span>Meal:</span> <span className={mealOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{mealOver > 0 ? `+${mealOver}m` : (mealObj > 0 ? `OK (${mealObj}m/60m)` : `OK`)}</span></div>
                      <div className="flex justify-between"><span>Short:</span> <span className={shortOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{shortOver > 0 ? `+${shortOver}m` : (shortObj > 0 ? `OK (${shortObj}m/30m)` : `OK`)}</span></div>
                      <div className="flex justify-between"><span>Wellness:</span> <span className={wellnessOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{wellnessOver > 0 ? `+${wellnessOver}m` : (wellnessObj > 0 ? `OK (${wellnessObj}m/15m)` : `OK`)}</span></div>
                      <div className="flex justify-between"><span>Praying:</span> <span className={prayingOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{prayingOver > 0 ? `+${prayingOver}m` : (prayingObj > 0 ? `OK (${prayingObj}m/15m)` : `OK`)}</span></div>
                      <div className="flex justify-between"><span>WC:</span> <span className={wcOver > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>{wcOver > 0 ? `+${wcOver}m` : (wcObj > 0 ? `OK (${wcObj}m/10m)` : `OK`)}</span></div>
                      <div className="flex justify-between"><span>Idle:</span> <span className={idleObj > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>{idleObj > 0 ? `+${idleObj}m` : `OK`}</span></div>
                    </div>
                  </div>
                 </div>
                );
              })}
              {topPerformers.length === 0 && (
                <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12 rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">{t('auditLogOverbreak')}</CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">{t('needAttentionDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {topProblematic.map((s, i) => (
                <div key={`${s.employeeName}-${i}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shrink-0 ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>{i+1}</span>
                    <div>
                      <span className="font-bold text-sm text-slate-800">{s.employeeName}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isOnlyWcGlobally ? "Uso de WC contabilizado." : s.idleAlerts > 0 ? "Apresentou ociosidade crítica." : s.wcAlerts > 0 ? "Uso excessivo de status (WC)." : "Excedeu tempo de pausas."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Dialog>
                      <DialogTrigger className={`px-3 py-1.5 text-xs font-black rounded-lg uppercase shadow-sm flex items-center gap-1 group transition-colors ${isOnlyWcGlobally ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                           {Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m {isOnlyWcGlobally ? 'WC' : 'OVER'}
                           <span className={`rounded px-1 group-hover:bg-opacity-80 ml-1 ${isOnlyWcGlobally ? 'bg-amber-200 text-amber-800' : 'bg-rose-200 text-rose-800'}`}>Detalhes</span>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border-slate-200 p-0 overflow-hidden shadow-2xl">
                         <div className="bg-slate-900 text-white p-6 shrink-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                              <DialogHeader>
                                 <DialogTitle className="text-xl font-black">{s.employeeName} - {isOnlyWcGlobally ? 'WC' : 'Exceções'}</DialogTitle>
                              </DialogHeader>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m {isOnlyWcGlobally ? 'Registrados' : 'Excedidos'}</p>
                            </div>
                            <div className="flex bg-slate-800 p-1 rounded-lg shrink-0">
                              <button onClick={() => setDetailsSortMode('duration')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${detailsSortMode === 'duration' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Mais Longos</button>
                              <button onClick={() => setDetailsSortMode('date')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${detailsSortMode === 'date' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Cronológico</button>
                            </div>
                         </div>
                         <div className="flex-1 overflow-y-auto w-full bg-slate-50">
                            <div className="space-y-3 p-6 min-h-max">
                               {s.dailyRecords
                                  .flatMap(r => r.breaks.map(b => ({ ...b, date: r.date })))
                                  .filter(b => b.type !== 'forgot_status' && b.type !== 'offline')
                                  .filter(b => isOnlyWcGlobally ? (b.type === 'wc' && b.durationMinutes > 0) : b.durationMinutes > (b.type === 'wc' ? 10 : b.type === 'wellness' || b.type === 'praying' ? 15 : b.type === 'short' ? 30 : b.type === 'meal' ? 60 : b.type === 'idle' ? 0 : Infinity))
                                  .sort((a,b) => detailsSortMode === 'duration' ? b.durationMinutes - a.durationMinutes : new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                  .map((b, idx) => {
                                    const idealTime = (b.type === 'meal') ? 60 : (b.type === 'short') ? 30 : (b.type === 'wellness' || b.type === 'praying') ? 15 : (b.type === 'wc') ? 10 : 0;
                                    const exceededTime = b.durationMinutes - idealTime;
                                    return (
                                      <div key={idx} className={`flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm ${b.type === 'forgot_status' ? 'border-slate-200' : isOnlyWcGlobally ? 'border-amber-100' : 'border-rose-100'}`}>
                                        <div>
                                          <p className={`text-sm font-black uppercase tracking-tight ${b.type === 'forgot_status' ? 'text-slate-800' : isOnlyWcGlobally ? 'text-amber-800' : 'text-rose-800'}`} title={b.rawStatus}>{b.type === 'forgot_status' ? 'Esqueceu Status' : b.type === 'other' ? (b.rawStatus || b.type) : b.type}</p>
                                          <p className="text-xs font-bold text-slate-500">{format(new Date(b.date), 'dd/MM/yyyy')} • das {format(new Date(b.startTime), 'HH:mm')} às {format(new Date(b.endTime), 'HH:mm')}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                          {isOnlyWcGlobally || idealTime === 0 ? (
                                             <>
                                               <p className={`text-xl font-black ${b.type === 'forgot_status' ? 'text-slate-700' : isOnlyWcGlobally ? 'text-amber-600' : 'text-rose-600'}`}>{Math.floor(b.durationMinutes / 60)}h {b.durationMinutes % 60}m</p>
                                               <p className={`text-[10px] font-bold uppercase ${b.type === 'forgot_status' ? 'text-slate-400' : isOnlyWcGlobally ? 'text-amber-400' : 'text-rose-400'}`}>{b.durationMinutes} minutos totais</p>
                                             </>
                                          ) : (
                                             <>
                                               <div className="flex items-baseline gap-2 justify-end">
                                                 <p className="text-xs font-medium text-slate-400">{idealTime}m ideal</p>
                                                 <p className={`text-xl font-black ${b.type === 'forgot_status' ? 'text-slate-700' : 'text-rose-600'}`}>+{exceededTime}m</p>
                                               </div>
                                               <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5">({b.durationMinutes}m totais)</p>
                                             </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                               {s.dailyRecords.flatMap(r => r.breaks).filter(b => isOnlyWcGlobally ? (b.type === 'wc' && b.durationMinutes > 0) : b.durationMinutes > (b.type === 'wc' ? 10 : b.type === 'wellness' || b.type === 'praying' ? 15 : b.type === 'short' ? 30 : b.type === 'meal' ? 60 : b.type === 'idle' ? 0 : b.type === 'forgot_status' ? 0 : Infinity)).length === 0 && (
                                   <div className="text-center p-8 text-slate-400 font-bold text-sm">Nenhuma quebra de pausa detalhada individualmente.</div>
                               )}
                            </div>
                         </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
            {totalEmployees === 0 && (
              <div className="text-center py-20 text-slate-400 italic text-sm">
                Aguardando importação de dados...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
