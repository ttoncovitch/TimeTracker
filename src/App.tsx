/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, Upload, FileDown, LogOut, FileSpreadsheet, LayoutDashboard, ListFilter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from './contexts/LanguageContext';
import { EmployeeSummary } from './types';
import { parseExcelFile } from './lib/excel-parser';
import { exportToPDF } from './lib/pdf-exporter';
import { StatsDashboard } from './components/StatsDashboard';
import { EmployeeList } from './components/EmployeeList';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week' | 'day'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'idle_overbreak_wc'>('all');
  const [includeWcGlobal, setIncludeWcGlobal] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>();

  const latestDate = useMemo(() => {
    let latest = 0;
    summaries.forEach(s => {
      s.dailyRecords.forEach(r => {
        const d = new Date(r.date + 'T12:00:00').getTime();
        if (d > latest) latest = d;
      });
    });
    return latest > 0 ? new Date(latest) : new Date();
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    let filtered = summaries.map(s => {
      const records = s.dailyRecords.filter(r => {
        if (selectedDates && selectedDates.length > 0) {
           const selectedDateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
           if (!selectedDateStrings.includes(r.date)) return false;
        }
        
        if (timeFilter !== 'all') {
           const d = new Date(r.date + 'T12:00:00');
           const today = new Date();
           const diff = today.getTime() - d.getTime();
           
           if (timeFilter === 'month' && diff > 30 * 24 * 60 * 60 * 1000) return false;
           if (timeFilter === 'week' && diff > 7 * 24 * 60 * 60 * 1000) return false;
           if (timeFilter === 'day' && !(d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear())) return false;
        }

        if (typeFilter === 'idle_overbreak_wc' && !includeWcGlobal) {
           if (r.totalOverbreak <= 0) return false;
        } else if (typeFilter !== 'idle_overbreak_wc' && includeWcGlobal) {
           if (r.wcDuration <= 0) return false;
        } else if (typeFilter === 'idle_overbreak_wc' && includeWcGlobal) {
           if (r.totalOverbreak <= 0 && r.wcDuration <= 0) return false;
        }

        return true;
      });

      if (records.length === 0) return null;

      const totalOverbreak = records.reduce((acc, r) => {
        if (typeFilter === 'idle_overbreak_wc' && !includeWcGlobal) {
           return acc + r.totalOverbreak;
        } else if (typeFilter !== 'idle_overbreak_wc' && includeWcGlobal) {
           return acc + r.wcDuration;
        } else if (typeFilter === 'idle_overbreak_wc' && includeWcGlobal) {
           return acc + r.totalOverbreak + r.wcOverbreak;
        }
        return acc + r.totalOverbreak;
      }, 0);
      const wcAlerts = records.reduce((acc, r) => acc + (r.wcDuration > 10 ? 1 : 0), 0);
      const idleAlerts = records.reduce((acc, r) => acc + (r.idleDuration > 0 ? 1 : 0), 0);
      const wcTotalMinutes = records.reduce((acc, r) => acc + r.wcDuration, 0);
      const idleTotalMinutes = records.reduce((acc, r) => acc + r.idleDuration, 0);
      const totalWorkMinutes = records.reduce((acc, r) => acc + (r.totalWorkTimeMillis / 60000), 0);
      const totalBreakMinutes = records.reduce((acc, r) => {
        const breakMins = r.breaks.reduce((bAcc, b) => bAcc + b.durationMinutes, 0);
        return acc + breakMins;
      }, 0);

      return {
        ...s,
        dailyRecords: records,
        totalWorkMinutes: Math.round(totalWorkMinutes),
        totalBreakMinutes: Math.round(totalBreakMinutes),
        totalOverbreakMinutes: Math.round(totalOverbreak),
        wcAlerts,
        idleAlerts,
        wcTotalMinutes,
        idleTotalMinutes
      };
    }).filter(Boolean) as EmployeeSummary[];

    return filtered;
  }, [summaries, timeFilter, typeFilter, latestDate, selectedDates, includeWcGlobal]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error(t('invalidFormat'));
      return;
    }

    setIsLoading(true);
    
    // Add artificial delay for a better "processing" feel
    const delay = Math.floor(Math.random() * (7000 - 4000 + 1) + 4000);
    const delayPromise = new Promise(resolve => setTimeout(resolve, delay));
    
    const promise = Promise.all([parseExcelFile(file), delayPromise]).then(([data]) => data);
    
    toast.promise(promise, {
      loading: t('processingFile'),
      success: (data) => {
        setSummaries(data);
        setIsLoading(false);
        return `${data.length} ${t('agentsProcessed')}`;
      },
      error: (err) => {
        console.error(err);
        setIsLoading(false);
        return 'Erro ao processar arquivo. Verifique o formato.';
      }
    });
  }, [t]);

  const handleExport = () => {
    if (filteredSummaries.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const sortedForExport = [...filteredSummaries].sort((a, b) => {
      if (typeFilter === 'idle_overbreak_wc') {
        return b.totalOverbreakMinutes - a.totalOverbreakMinutes;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });

    let periodLabel = t('allTime');
    if (timeFilter === 'month') periodLabel = t('filterMonth');
    if (timeFilter === 'week') periodLabel = t('filterWeek');
    if (timeFilter === 'day') periodLabel = t('filterDay');

    const titleStr = typeFilter === 'idle_overbreak_wc' ? `Overbreaks & Violators Report - ${periodLabel}` : `General Report - ${periodLabel}`;
    
    let fileSuffix = periodLabel.toLowerCase().replace(' ', '_');
    if (typeFilter === 'idle_overbreak_wc') {
        fileSuffix += "_only_overbreaks";
    }

    exportToPDF(sortedForExport, titleStr, `report_${fileSuffix}`);
    toast.success('PDF gerado com sucesso!');
  };

  const clearData = () => {
    setSummaries([]);
    toast.success('Dados resetados');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <Toaster position="top-right" closeButton richColors />
      
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full"></div>
              <div className="w-24 h-24 border-4 border-blue-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileSpreadsheet className="text-blue-500 animate-pulse" size={32} />
              </div>
            </div>
            <motion.h2 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-xl font-black text-white tracking-widest uppercase"
            >
              {t('processingFile')}
            </motion.h2>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 text-sm text-slate-400 font-medium max-w-sm text-center"
            >
              {t('processingDesc')}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Geometric Theme */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6 hidden lg:flex shrink-0">
        <div className="mb-10">
          <div className="flex flex-col items-start gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">SC</div>
              <h1 className="text-[17px] font-bold tracking-tight">StatusChecker <span className="text-blue-400">Pro</span></h1>
            </div>
            <button 
              onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
              className="bg-slate-800 text-[10px] font-black uppercase text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors w-auto"
            >
              {lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-3">{t('importData')}</label>
            <label className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-700 transition-colors block">
              <Upload size={20} className="mx-auto mb-2 text-slate-400" />
              <span className="text-xs text-slate-300 font-medium">{t('dragExcel')}</span>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block px-2 mb-2">{t('viewMode')}</label>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <LayoutDashboard size={16} /> {t('overview')}
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <ListFilter size={16} /> {t('agents')}
            </button>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          {summaries.length > 0 && (
            <Button variant="ghost" onClick={clearData} className="w-full mt-4 text-slate-400 hover:text-red-400 hover:bg-red-400/10 justify-start h-9 px-3 gap-2">
              <Trash2 size={16} /> <span className="text-xs font-bold uppercase tracking-wider">{t('clear')}</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header - Geometric Balance */}
        <header className="sticky top-0 z-10 flex justify-between items-center py-4 px-8 bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 hidden sm:block">
              {summaries.length > 0 ? (activeTab === 'dashboard' ? t('overview') : t('agents')) : ''}
            </h2>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">SC</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {summaries.length > 0 && (
              <Button onClick={handleExport} className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 h-10 px-5 shadow-lg shadow-slate-200">
                <FileDown size={18} /> <span>{t('exportPdf')}</span>
              </Button>
            )}
            <div className="flex lg:hidden gap-1 bg-white border border-slate-200 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'bg-slate-100' : ''}>
                <LayoutDashboard size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('list')} className={activeTab === 'list' ? 'bg-slate-100' : ''}>
                <ListFilter size={16} />
              </Button>
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {summaries.length === 0 ? (
              <motion.div 
                key="uploader"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto text-center space-y-8"
              >
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
                    <FileSpreadsheet size={40} />
                  </div>
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {t('homeTitle1')} <span className="text-blue-600 underline decoration-4 underline-offset-8">{t('homeTitleHighlight')}</span> {t('homeTitle2')}
                  </h2>
                  <p className="text-slate-500 text-lg max-w-md mx-auto">
                    {t('homeSubtitle')}
                  </p>
                </div>

                <div className="w-full">
                  <label className="relative group flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer overflow-hidden shadow-2xl shadow-slate-200/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-6 z-10">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl group-hover:bg-blue-600 transition-colors shadow-lg">
                        <Upload size={32} />
                      </div>
                      <div>
                        <p className="mb-1 text-2xl font-bold text-slate-800">{t('homeSelectReport')}</p>
                        <p className="text-slate-400 font-medium">{t('homeLimitsInfo')}</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                  </label>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{t('realtimeMetrics')}</h3>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2 mb-2">
                      <p className="text-2xl font-black text-slate-900 hidden sm:block">{t('auditResults')}</p>
                      <div className="flex gap-2 w-full flex-wrap">
                        <div className="flex gap-1 items-center bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm overflow-x-auto w-full sm:w-auto">
                          <Popover>
                            <PopoverTrigger
                                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 bg-amber-500 text-white shadow-md hover:bg-amber-600`}
                               >
                                 <CalendarIcon size={12} />
                                 Calendário {selectedDates && selectedDates.length > 0 ? `(${selectedDates.length})` : ''}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="multiple"
                                    selected={selectedDates}
                                    onSelect={(dates) => {
                                        setSelectedDates(dates);
                                        setTimeFilter('all'); // reset time filter
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                          </Popover>
                          {(['month', 'week', 'day'] as const).map(filter => (
                             <button 
                               key={filter}
                               onClick={() => {
                                   if (timeFilter === filter) {
                                       setTimeFilter('all');
                                   } else {
                                       setTimeFilter(filter);
                                       setSelectedDates(undefined);
                                   }
                               }}
                               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${timeFilter === filter && (!selectedDates || selectedDates.length === 0) ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                             >
                               {filter === 'month' ? t('filterMonth') : filter === 'week' ? t('filterWeek') : t('filterDay')}
                             </button>
                          ))}
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                           <button 
                             onClick={() => setTypeFilter(typeFilter === 'all' ? 'idle_overbreak_wc' : 'all')}
                             className={`px-4 py-1.5 w-full sm:w-auto border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${typeFilter === 'idle_overbreak_wc' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                           >
                              {t('onlyOverbreaks')}
                           </button>
                           <button
                             onClick={() => setIncludeWcGlobal(!includeWcGlobal)}
                             className={`px-4 py-1.5 w-full sm:w-auto border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeWcGlobal ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                           >
                             WC
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-[600px]">
                  {activeTab === 'dashboard' ? (
                    <StatsDashboard summaries={filteredSummaries} latestDate={latestDate} globalTypeFilter={typeFilter} globalIncludeWc={includeWcGlobal} />
                  ) : (
                    <EmployeeList summaries={filteredSummaries} allSummaries={summaries} latestDate={latestDate} initialFilter={timeFilter} globalTypeFilter={typeFilter} globalIncludeWc={includeWcGlobal} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

