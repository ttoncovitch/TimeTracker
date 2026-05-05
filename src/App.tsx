/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, Upload, FileDown, LogOut, FileSpreadsheet, LayoutDashboard, ListFilter, Trash2, Target } from 'lucide-react';
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
import { parseCalendarFile } from './lib/calendar-parser';
import { StatsDashboard } from './components/StatsDashboard';
import { EmployeeList } from './components/EmployeeList';
import { motion, AnimatePresence } from 'motion/react';

import { CustomCalendar } from './components/CustomCalendar';
import { LOBAnalytics, isSupportRole } from './components/LOBAnalytics';

// LOB exclusion removed per user request

export default function App() {
  const { lang, setLang, t } = useLanguage();

  const getFullMonthName = (text: string, language: string) => {
    if (!text) return '';
    const upperText = text.toUpperCase();
    
    const pMonths = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const eMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    let foundIndex = -1;
    for (let i = 0; i < 12; i++) {
       // Search for English or Portuguese month string in the uppercase text
       // Using word boundary or simple includes. Since it's often like 2604.APR or ABRIL,
       // .includes is fine, but we should make sure we don't accidentally match substrings.
       // Actually includes is fine because months are usually clearly separated.
       if (upperText.includes(eMonths[i]) || upperText.includes(pMonths[i])) {
          foundIndex = i;
          break;
       }
    }

    if (foundIndex === -1) return text.toUpperCase();

    const en = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST',
      'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    const pt = [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
      'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ];
    
    return language === 'en' ? en[foundIndex] : pt[foundIndex];
  };
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarNote, setCalendarNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'prev_month' | 'week' | 'day' | 'yesterday'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'idle_overbreak_wc'>('all');
  const [shiftFilter, setShiftFilter] = useState<string[]>([]);
  const [includeWcGlobal, setIncludeWcGlobal] = useState(false);
  const [includeIdleGlobal, setIncludeIdleGlobal] = useState(false);
  const [includeNonModGlobal, setIncludeNonModGlobal] = useState(false);
  const [includeTardinessGlobal, setIncludeTardinessGlobal] = useState(false);
  const [includeEarlyLeaveGlobal, setIncludeEarlyLeaveGlobal] = useState(false);
  const [includeShort30MinGlobal, setIncludeShort30MinGlobal] = useState(false);
  const [includeAbsencesGlobal, setIncludeAbsencesGlobal] = useState(false);
  const [includeOffboardedGlobal, setIncludeOffboardedGlobal] = useState(false);
  const [includeATTGlobal, setIncludeATTGlobal] = useState(false);
  const [includeLOAGlobal, setIncludeLOAGlobal] = useState(false);
  const [includePTOGlobal, setIncludePTOGlobal] = useState(false);
  const [includeSLGlobal, setIncludeSLGlobal] = useState(false);
  const [includeSUSPPGlobal, setIncludeSUSPPGlobal] = useState(false);
  const [includeOFFGlobal, setIncludeOFFGlobal] = useState(false);
  const [includeSupportStaff, setIncludeSupportStaff] = useState(false);
  const [includeCheckGlobal, setIncludeCheckGlobal] = useState(false);
  const [filterMinorOverbreaks, setFilterMinorOverbreaks] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>();

  const cleanShift = (shift: string) => {
    const match = shift.match(/\b(\d{2}:\d{2}-\d{2}:\d{2})\b/);
    return match ? match[1] : shift;
  };

  const availableShifts = useMemo(() => {
    const shifts = new Set<string>();
    summaries.forEach(s => s.dailyRecords.forEach(r => {
      if (r.inferredShift) shifts.add(cleanShift(r.inferredShift));
    }));
    return Array.from(shifts).sort((a, b) => {
      const orderMap: Record<string, number> = {
        '07:00': 1,
        '08:00': 2,
        '09:00': 3,
        '14:00': 4,
        '22:30': 5
      };
      const getOrder = (str: string) => {
        for (const k in orderMap) {
          if (str.startsWith(k)) return orderMap[k];
        }
        return 99;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [summaries]);

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

  const { globalMinDate, globalMaxDate } = useMemo(() => {
    let min = new Date('2099-01-01');
    let max = new Date('2000-01-01');
    summaries.forEach(s => s.dailyRecords.forEach(r => {
      const d = new Date(r.date + 'T12:00:00');
      if (d < min) min = d;
      if (d > max) max = d;
    }));

    calendarData.forEach(c => {
       if (c.schedule) {
           Object.keys(c.schedule).forEach(k => {
               let d: Date | null = null;
               if (k.includes('-')) {
                  d = new Date(k + 'T12:00:00');
               } else if (k.includes('/')) {
                  const parts = k.split('/');
                  if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     if (parseInt(parts[0]) > 12) {
                        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                     } else {
                        d = new Date(`${parts[2]}-${parts[0]}-${parts[1]}T12:00:00`);
                     }
                  }
               }
               
               if (d && !isNaN(d.getTime())) {
                   if (d < min) min = d;
                   if (d > max) max = d;
               }
           });
       }
    });

    if (min.getFullYear() === 2099) min = new Date();
    if (max.getFullYear() === 2000) max = new Date();

    return { globalMinDate: min, globalMaxDate: max };
  }, [summaries, calendarData]);

  const mergedSummaries = useMemo(() => {
    if (calendarData.length === 0) return summaries;

    const filtered = summaries.map(s => {
       let calEntry = calendarData.find(c => c.email && c.email.toLowerCase() === s.email?.toLowerCase());

       if (!calEntry) {
           const summaryNameLower = s.employeeName.toLowerCase().trim().replace(/\./g, ' ');
           calEntry = calendarData.find(c => c.name.toLowerCase().trim() === summaryNameLower);
           
           if (!calEntry) {
             calEntry = calendarData.find(c => {
               const calNameParts = c.name.toLowerCase().trim().split(/\s+/);
               const sumNameParts = summaryNameLower.split(/\s+/);
               
               if (calNameParts.length > 0 && sumNameParts.length > 0) {
                  if (calNameParts[0] === sumNameParts[0]) {
                     if (calNameParts.length === 1 || sumNameParts.length === 1) return true;
                     const overlap = calNameParts.filter(p => sumNameParts.includes(p));
                     if (overlap.length > 1) return true;
                  }
               }
               return false;
             });
           }
       }
       
       // Filter out excluded LOBs removed
       
       if (calEntry) {
          const existingDates = new Set(s.dailyRecords.map(r => r.date));
          const newRecords = [...s.dailyRecords];
          
          if (globalMinDate <= globalMaxDate && calEntry.schedule && !s.isOffboarded) {
              let d = new Date(globalMinDate);
              while (d <= globalMaxDate) {
                 const dateStr = format(d, 'yyyy-MM-dd');
                 const dateKey = format(d, 'dd/MM/yyyy');
                 const dateKeyAlt = format(d, 'MM/dd/yyyy');
                 
                 if (!existingDates.has(dateStr)) {
                    const scheduleForDay = calEntry.schedule[dateStr] || calEntry.schedule[dateKey] || calEntry.schedule[dateKeyAlt];
                    
                    if (scheduleForDay) {
                        const schedUpper = scheduleForDay.toUpperCase();
                        const isWorkday = !schedUpper.includes('OFF') && !schedUpper.includes('VAC') && !schedUpper.includes('FESTA') && !schedUpper.includes('HOLIDAY') && !schedUpper.includes('LOA') && !schedUpper.includes('PTO') && !schedUpper.includes('SL') && !schedUpper.includes('ATT') && !schedUpper.includes('SUSPP');
                        const latestDateStr = format(latestDate, 'yyyy-MM-dd');
                        
                        newRecords.push({
                           date: dateStr,
                           totalWorkTimeMillis: 0,
                           totalOfflineTimeMillis: 0,
                           breaks: [],
                           mealDuration: 0,
                           mealOverbreak: 0,
                           shortDuration: 0,
                           shortOverbreak: 0,
                           wellnessDuration: 0,
                           wellnessOverbreak: 0,
                           prayingDuration: 0,
                           prayingOverbreak: 0,
                           wcDuration: 0,
                           wcOverbreak: 0,
                           idleDuration: 0,
                           idleOverbreak: 0,
                           totalBreakMinutes: 0,
                           tardinessMinutes: 0,
                           earlyLeaveMinutes: 0,
                           inferredShift: scheduleForDay,
                           scheduledShift: scheduleForDay,
                           isAbsence: isWorkday && dateStr < latestDateStr
                        });
                    }
                 }
                 d.setDate(d.getDate() + 1);
              }
          }
       
           const updatedDailyRecords = newRecords.map(r => {
              const dateKey = format(new Date(r.date + 'T12:00:00'), 'dd/MM/yyyy');
              const dateKeyAlt = format(new Date(r.date + 'T12:00:00'), 'MM/dd/yyyy');
              let specificShift = undefined;
              let specificLob = undefined;
              if (calEntry) {
                 if (calEntry.schedule) {
                   specificShift = calEntry.schedule[r.date] || calEntry.schedule[dateKey] || calEntry.schedule[dateKeyAlt];
                 }
                 if (calEntry.lobSchedule) {
                   specificLob = calEntry.lobSchedule[r.date] || calEntry.lobSchedule[dateKey] || calEntry.lobSchedule[dateKeyAlt];
                 }
              }
              const scheduledShift = specificShift || calEntry?.shift || r.scheduledShift;
              const inferredShift = r.inferredShift || scheduledShift;
              const currentLob = specificLob || calEntry?.lob || s.lob;
              
              const shiftUpper = (scheduledShift || inferredShift || '').toUpperCase();
              
              const isWorkingShift = /\d{1,2}:\d{2}/.test(shiftUpper);
              const isOffShift = shiftUpper.includes('OFF') || shiftUpper.includes('FOLGA');
              const isVacationShift = (shiftUpper.includes('VAC') || shiftUpper.includes('PTO') || shiftUpper.includes('FÉRIAS')) && !isWorkingShift;
              const isSickShift = (shiftUpper.includes('SL') || shiftUpper.includes('SICK') || shiftUpper.includes('MEDICO') || shiftUpper.includes('ATESTADO')) && !isWorkingShift;
              const isLoaShift = (shiftUpper.includes('LOA') || shiftUpper.includes('LICENÇA')) && !isWorkingShift;
              const isSusppShift = (shiftUpper.includes('SUSPP') || shiftUpper.includes('SUSPENSÃO')) && !isWorkingShift;
              const isAttShift = (shiftUpper.includes('ATT') || shiftUpper.includes('ATTRITION') || shiftUpper.includes('RESIGN') || shiftUpper.includes('SAÍDA')) && !isWorkingShift;
              
              return {
                 ...r,
                 scheduledShift: scheduledShift,
                 inferredShift: inferredShift,
                 lob: currentLob,
                 isATT: isAttShift || (specificShift ? false : (isWorkingShift ? false : r.isATT)),
                 isLOA: isLoaShift || (specificShift ? false : (isWorkingShift ? false : r.isLOA)),
                 isPTO: isVacationShift || (specificShift ? false : (isWorkingShift ? false : r.isPTO)),
                 isSL: isSickShift || (specificShift ? false : (isWorkingShift ? false : r.isSL)),
                 isSUSPP: isSusppShift || (specificShift ? false : (isWorkingShift ? false : r.isSUSPP)),
                 isOFF: isOffShift || (specificShift ? false : (isWorkingShift ? false : r.isOFF))
              };
           }).sort((a, b) => a.date.localeCompare(b.date));

           const totalAbsences = updatedDailyRecords.filter(r => r.isAbsence).length;

           return {
              ...s,
              shift: calEntry.shift,
              lob: calEntry.lob,
              language: calEntry.language,
              totalAbsences,
              dailyRecords: updatedDailyRecords
           };
       }
       return s;
    }).filter((s): s is EmployeeSummary => s !== null);

    return filtered;
  }, [summaries, calendarData, globalMinDate, globalMaxDate]);

  const basePeriodSummaries = useMemo(() => {
    return mergedSummaries.map(s => {
      const records = s.dailyRecords.filter(r => {
        if (selectedDates && selectedDates.length > 0) {
           const selectedDateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
           if (!selectedDateStrings.includes(r.date)) return false;
        }
        
        if (timeFilter !== 'all') {
           const d = new Date(r.date + 'T12:00:00');
           const today = new Date();
           
           if (timeFilter === 'month') {
              if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return false;
           }
           if (timeFilter === 'prev_month') {
              const pm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              if (d.getMonth() !== pm.getMonth() || d.getFullYear() !== pm.getFullYear()) return false;
           }
           if (timeFilter === 'week') {
              const dow = today.getDay();
              const diffToMon = dow === 0 ? -6 : 1 - dow;
              
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() + diffToMon);
              startOfWeek.setHours(0, 0, 0, 0);
              
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              endOfWeek.setHours(23, 59, 59, 999);

              if (d < startOfWeek || d > endOfWeek) return false;
           }
           if (timeFilter === 'day') {
              const today = new Date();
              if (!(d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear())) return false;
           }
           if (timeFilter === 'yesterday') {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              if (!(d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear())) return false;
           }
        }

        const otherShifts = shiftFilter.filter(s => s !== 'CHECK');
        if (otherShifts.length > 0) {
            const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : (r.inferredShift ? cleanShift(r.inferredShift) : null);
            const isShiftMatch = activeShift ? otherShifts.includes(activeShift) : false;
            if (!isShiftMatch) return false;
        }

        return true;
      });
      const isATTInfo = records.some(r => r.isATT) || s.isOffboarded;
      const isLOAInfo = records.some(r => r.isLOA);
      const isPTOInfo = records.some(r => r.isPTO);
      const isSLInfo = records.some(r => r.isSL);
      const isSUSPPInfo = records.some(r => r.isSUSPP);
      const isOFFInfo = records.some(r => r.isOFF);

      const isGlobalView = (timeFilter === 'month' || timeFilter === 'all') && (!selectedDates || selectedDates.length === 0);

      const finalIsATT = isGlobalView ? (s.dailyRecords.some(r => r.isATT) || s.isOffboarded) : isATTInfo;
      const finalIsLOA = isGlobalView ? s.dailyRecords.some(r => r.isLOA) : isLOAInfo;
      const finalIsPTO = isGlobalView ? s.dailyRecords.some(r => r.isPTO) : isPTOInfo;
      const finalIsSL = isGlobalView ? s.dailyRecords.some(r => r.isSL) : isSLInfo;
      const finalIsSUSPP = isGlobalView ? s.dailyRecords.some(r => r.isSUSPP) : isSUSPPInfo;
      const finalIsOFF = isGlobalView ? s.dailyRecords.some(r => r.isOFF) : isOFFInfo;
      const totalAbsences = records.reduce((acc, r) => acc + (r.isAbsence && !r.isATT ? 1 : 0), 0);
      
      const activeLob = records.find(r => r.lob)?.lob || s.lob;

      return (records.length > 0 || s.isOffboarded || finalIsATT || finalIsLOA || finalIsPTO || finalIsSL || finalIsSUSPP || finalIsOFF) ? { 
          ...s, 
          dailyRecords: records,
          lob: activeLob,
          totalAbsences,
          isATT: finalIsATT,
          isLOA: finalIsLOA,
          isPTO: finalIsPTO,
          isSL: finalIsSL,
          isSUSPP: finalIsSUSPP,
          isOFF: finalIsOFF
      } : null;
    }).filter(Boolean) as EmployeeSummary[];
  }, [mergedSummaries, timeFilter, shiftFilter, selectedDates]);

  const periodSummaries = useMemo(() => {
    return mergedSummaries.map(s => {
      const records = s.dailyRecords.filter(r => {
        if (selectedDates && selectedDates.length > 0) {
           const selectedDateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
           if (!selectedDateStrings.includes(r.date)) return false;
        }
        
        if (timeFilter !== 'all') {
           const d = new Date(r.date + 'T12:00:00');
           const today = new Date();
           
           if (timeFilter === 'month') {
              if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return false;
           }
           if (timeFilter === 'prev_month') {
              const pm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              if (d.getMonth() !== pm.getMonth() || d.getFullYear() !== pm.getFullYear()) return false;
           }
           if (timeFilter === 'week') {
              const dow = today.getDay();
              const diffToMon = dow === 0 ? -6 : 1 - dow;
              
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() + diffToMon);
              startOfWeek.setHours(0, 0, 0, 0);
              
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              endOfWeek.setHours(23, 59, 59, 999);

              if (d < startOfWeek || d > endOfWeek) return false;
           }
           if (timeFilter === 'day') {
              const today = new Date();
              if (!(d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear())) return false;
           }
           if (timeFilter === 'yesterday') {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              if (!(d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear())) return false;
           }
        }

        if (shiftFilter.length > 0) {
            const hasCheck = shiftFilter.includes('CHECK');
            const otherShifts = shiftFilter.filter(s => s !== 'CHECK');
            
            const isCheckMatch = r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim();
            const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : (r.inferredShift ? cleanShift(r.inferredShift) : null);
            const isShiftMatch = activeShift ? otherShifts.includes(activeShift) : false;

            if (hasCheck && otherShifts.length > 0) {
                if (!isShiftMatch) return false;
            } else if (hasCheck) {
                if (!isCheckMatch) return false;
            } else {
                if (!isShiftMatch) return false;
            }
        }

        return true;
      });
      const isATTInfo = records.some(r => r.isATT) || s.isOffboarded;
      const isLOAInfo = records.some(r => r.isLOA);
      const isPTOInfo = records.some(r => r.isPTO);
      const isSLInfo = records.some(r => r.isSL);
      const isSUSPPInfo = records.some(r => r.isSUSPP);
      const isOFFInfo = records.some(r => r.isOFF);

      const isGlobalView = (timeFilter === 'month' || timeFilter === 'all') && (!selectedDates || selectedDates.length === 0);

      const finalIsATT = isGlobalView ? (s.dailyRecords.some(r => r.isATT) || s.isOffboarded) : isATTInfo;
      const finalIsLOA = isGlobalView ? s.dailyRecords.some(r => r.isLOA) : isLOAInfo;
      const finalIsPTO = isGlobalView ? s.dailyRecords.some(r => r.isPTO) : isPTOInfo;
      const finalIsSL = isGlobalView ? s.dailyRecords.some(r => r.isSL) : isSLInfo;
      const finalIsSUSPP = isGlobalView ? s.dailyRecords.some(r => r.isSUSPP) : isSUSPPInfo;
      const finalIsOFF = isGlobalView ? s.dailyRecords.some(r => r.isOFF) : isOFFInfo;
      const totalAbsences = records.reduce((acc, r) => acc + (r.isAbsence && !r.isATT ? 1 : 0), 0);
      
      const activeLob = records.find(r => r.lob)?.lob || s.lob;

      return (records.length > 0 || s.isOffboarded || finalIsATT || finalIsLOA || finalIsPTO || finalIsSL || finalIsSUSPP || finalIsOFF) ? { 
          ...s, 
          dailyRecords: records,
          lob: activeLob,
          totalAbsences,
          isATT: finalIsATT,
          isLOA: finalIsLOA,
          isPTO: finalIsPTO,
          isSL: finalIsSL,
          isSUSPP: finalIsSUSPP,
          isOFF: finalIsOFF
      } : null;
    }).filter(Boolean) as EmployeeSummary[];
  }, [mergedSummaries, timeFilter, shiftFilter, selectedDates, includeCheckGlobal]);

  const processedSummaries = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

      let filtered = periodSummaries.map(s => {
        const records = s.dailyRecords.map(r => {
        let wcDur = 0, mealDur = 0, shortDur = 0, wellnessDur = 0, prayingDur = 0, idleDur = 0;

        r.breaks.forEach(b => {
           if (b.type === 'wc') wcDur += b.durationMinutes;
           else if (b.type === 'meal') mealDur += b.durationMinutes;
           else if (b.type === 'short') shortDur += b.durationMinutes;
           else if (b.type === 'wellness') wellnessDur += b.durationMinutes;
           else if (b.type === 'praying') prayingDur += b.durationMinutes;
           else if (b.type === 'idle') idleDur += b.durationMinutes;
        });

        let wcOverbreak = Math.max(0, wcDur - 10);
        let mealOverbreak = Math.max(0, mealDur - 60);
        let shortOverbreak = Math.max(0, shortDur - 30);
        if (r.hasSingleShort30m && shortOverbreak <= 2) {
            shortOverbreak = 0;
        }
        let wellnessOverbreak = Math.max(0, wellnessDur - 15);
        let prayingOverbreak = Math.max(0, prayingDur - 15);
        let idleOverbreak = idleDur;

        const isWcOnly = includeWcGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isIdleOnly = includeIdleGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isNonModOnly = includeNonModGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isTardinessOnly = includeTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isEarlyLeaveOnly = includeEarlyLeaveGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && typeFilter === 'all';
        const isShort30MinOnly = includeShort30MinGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isAbsencesOnly = includeAbsencesGlobal && !includeOffboardedGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isOffboardedOnly = includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isOverbreakOnly = typeFilter === 'idle_overbreak_wc' && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal;

        let dailyOverbreak = mealOverbreak + shortOverbreak + wellnessOverbreak + prayingOverbreak;
        if (isIdleOnly) {
          dailyOverbreak += idleOverbreak;
        } else if (!isOverbreakOnly && !isWcOnly) {
          if (includeIdleGlobal) dailyOverbreak += idleOverbreak;
        }

        // We explicitly compute wcTotalOverbreak instead of pushing it into dailyOverbreak
        // So that "OVERBREAKS" metric genuinely ignores Organic per user request.
        
        return { 
          ...r, 
          wcDuration: wcDur,
          mealDuration: mealDur,
          shortDuration: shortDur,
          wellnessDuration: wellnessDur,
          prayingDuration: prayingDur,
          idleDuration: idleDur,
          totalOverbreak: dailyOverbreak, 
          wcOverbreak, 
          mealOverbreak, 
          shortOverbreak, 
          wellnessOverbreak, 
          prayingOverbreak, 
          idleOverbreak 
        };
      }).filter(r => {
        if (selectedDates && selectedDates.length > 0) {
           const selectedDateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
           if (!selectedDateStrings.includes(r.date)) return false;
        }
        
        if (timeFilter !== 'all') {
           const d = new Date(r.date + 'T12:00:00');
           const today = new Date();
           
            if (timeFilter === 'month') {
               if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return false;
            }
            if (timeFilter === 'prev_month') {
               const pm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
               if (d.getMonth() !== pm.getMonth() || d.getFullYear() !== pm.getFullYear()) return false;
            }
           if (timeFilter === 'week') {
              // Standard week check (Monday start)
              const today = new Date();
              const day = today.getDay();
              const diffToMon = day === 0 ? -6 : 1 - day;
              
              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() + diffToMon);
              startOfWeek.setHours(0, 0, 0, 0);
              
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              endOfWeek.setHours(23, 59, 59, 999);

              if (d < startOfWeek || d > endOfWeek) return false;
           }
           if (timeFilter === 'day') {
              if (!(d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear())) return false;
           }
           if (timeFilter === 'yesterday') {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              if (!(d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear())) return false;
           }
        }

        if (shiftFilter.length > 0 || includeCheckGlobal) {
            const hasCheck = shiftFilter.includes('CHECK') || includeCheckGlobal;
            const otherShifts = shiftFilter.filter(s => s !== 'CHECK');
            
            const isCheckMatch = r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim();
            const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : (r.inferredShift ? cleanShift(r.inferredShift) : null);
            const isShiftMatch = activeShift ? otherShifts.includes(activeShift) : false;

            if (hasCheck && otherShifts.length > 0) {
                if (!isShiftMatch) return false;
            } else if (hasCheck) {
                if (!isCheckMatch) return false;
            } else {
                if (!isShiftMatch) return false;
            }
        }

        const isWcOnly = includeWcGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isIdleOnly = includeIdleGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isNonModOnly = includeNonModGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isTardinessOnly = includeTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isEarlyLeaveOnly = includeEarlyLeaveGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && typeFilter === 'all';
        const isShort30MinOnly = includeShort30MinGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isAbsencesOnly = includeAbsencesGlobal && !includeOffboardedGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isOffboardedOnly = includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';

        if (isWcOnly) {
           if (r.wcDuration <= 0) return false;
        } else if (isIdleOnly) {
           if (r.idleDuration <= 0) return false;
        } else if (isNonModOnly) {
           if (!r.breaks.some(b => b.type === 'non_moderating')) return false;
        } else if (isTardinessOnly) {
           if ((r.tardinessMinutes || 0) <= 0) return false;
        } else if (isEarlyLeaveOnly) {
           if ((r.earlyLeaveMinutes || 0) <= 0) return false;
        } else if (isShort30MinOnly) {
           // Agent took exactly one shortbreak in the day, > 20min (hasSingleShort30m is already true if it was)
           if (!r.hasSingleShort30m) return false;
        } else if (isAbsencesOnly) {
           if (!r.isAbsence) return false;
        } else if (typeFilter === 'idle_overbreak_wc' && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal) {
           if (r.totalOverbreak <= 0 && (r.wcDuration || 0) <= 0 && (r.idleDuration || 0) <= 0) return false;
        } else if (includeWcGlobal || includeIdleGlobal || includeNonModGlobal || includeTardinessGlobal || includeEarlyLeaveGlobal || includeShort30MinGlobal || includeAbsencesGlobal || includeOffboardedGlobal || typeFilter === 'idle_overbreak_wc') {
           // Mixed filters logic
           let keep = false;
           if (includeWcGlobal && r.wcDuration > 0) keep = true;
           if (includeIdleGlobal && r.idleDuration > 0) keep = true;
           if (includeNonModGlobal && r.breaks.some(b => b.type === 'non_moderating')) keep = true;
           if (includeTardinessGlobal && (r.tardinessMinutes || 0) > 0) keep = true;
           if (includeEarlyLeaveGlobal && (r.earlyLeaveMinutes || 0) > 0) keep = true;
           if (includeShort30MinGlobal && r.hasSingleShort30m) keep = true;
           if (includeAbsencesGlobal && r.isAbsence) keep = true;
           if (includeOffboardedGlobal && s.isOffboarded) keep = true;
           if (typeFilter === 'idle_overbreak_wc' && r.totalOverbreak > 0) keep = true;
           if (!keep) return false;
        }

        return true;
      });

      if (records.length === 0 && !s.isOffboarded && !s.isATT && !s.isLOA && !s.isPTO && !s.isSL && !s.isSUSPP && !s.isOFF) return null;

      const totalOverbreak = records.length > 0 ? records.reduce((acc, r) => acc + r.totalOverbreak, 0) : 0;
      const wcTotalOverbreak = records.length > 0 ? records.reduce((acc, r) => acc + r.wcOverbreak, 0) : 0;
      const wcAlerts = records.length > 0 ? records.reduce((acc, r) => acc + (r.wcDuration > 10 ? 1 : 0), 0) : 0;
      const idleAlerts = records.length > 0 ? records.reduce((acc, r) => acc + (r.idleDuration > 0 ? 1 : 0), 0) : 0;
      const wcTotalMinutes = records.length > 0 ? records.reduce((acc, r) => acc + r.wcDuration, 0) : 0;
      const idleTotalMinutes = records.length > 0 ? records.reduce((acc, r) => acc + r.idleDuration, 0) : 0;
      const totalTardinessMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.tardinessMinutes || 0), 0) : 0;
      const totalEarlyLeaveMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.earlyLeaveMinutes || 0), 0) : 0;
      const totalShort30MinRecords = records.length > 0 ? records.reduce((acc, r) => acc + (r.hasSingleShort30m ? 1 : 0), 0) : 0;
      const totalNonModMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.nonModDuration || 0), 0) : 0;
      const totalReviewAndAppealMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.reviewAndAppealDuration || 0), 0) : 0;
      const totalAwaitingTasksMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.awaitingTasksDuration || 0), 0) : 0;
      const totalForgotStatusMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.forgotStatusDuration || 0), 0) : 0;
      const totalAbsences = records.length > 0 ? records.reduce((acc, r) => acc + (r.isAbsence ? 1 : 0), 0) : 0;
      const totalWorkMinutes = records.length > 0 ? records.reduce((acc, r) => acc + (r.totalWorkTimeMillis / 60000), 0) : 0;
      const totalBreakMinutes = records.length > 0 ? records.reduce((acc, r) => {
        const breakMins = r.breaks.reduce((bAcc, b) => bAcc + b.durationMinutes, 0);
        return acc + breakMins;
      }, 0) : 0;

      if (filterMinorOverbreaks && (totalOverbreak > 2 || totalOverbreak === 0)) return null;

      return {
        ...s,
        dailyRecords: records,
        totalWorkMinutes: Math.round(totalWorkMinutes),
        totalBreakMinutes: Math.round(totalBreakMinutes),
        totalOverbreakMinutes: Math.round(totalOverbreak),
        wcTotalOverbreak: Math.round(wcTotalOverbreak),
        totalTardinessMinutes: Math.round(totalTardinessMinutes),
        totalEarlyLeaveMinutes: Math.round(totalEarlyLeaveMinutes),
        totalShort30MinRecords,
        totalNonModMinutes: Math.round(totalNonModMinutes),
        totalReviewAndAppealMinutes: Math.round(totalReviewAndAppealMinutes),
        totalAwaitingTasksMinutes: Math.round(totalAwaitingTasksMinutes),
        totalForgotStatusMinutes: Math.round(totalForgotStatusMinutes),
        totalAbsences,
        wcAlerts,
        idleAlerts,
        wcTotalMinutes,
        idleTotalMinutes
      };
    }).filter(Boolean) as EmployeeSummary[];

    return filtered;
  }, [periodSummaries, timeFilter, typeFilter, shiftFilter, latestDate, selectedDates, includeWcGlobal, includeIdleGlobal, includeNonModGlobal, includeTardinessGlobal, includeEarlyLeaveGlobal, filterMinorOverbreaks, includeShort30MinGlobal, includeAbsencesGlobal, includeOffboardedGlobal, includeATTGlobal, includeLOAGlobal, includePTOGlobal, includeSLGlobal, includeSUSPPGlobal, includeOFFGlobal, includeCheckGlobal]);

  const activeAnyStatus = includeATTGlobal || includeLOAGlobal || includePTOGlobal || includeSLGlobal || includeSUSPPGlobal || includeOFFGlobal || includeOffboardedGlobal || includeAbsencesGlobal;

  const filteredSummaries = useMemo(() => {
    if (!activeAnyStatus) return processedSummaries;
    
    return processedSummaries.map(s => {
       const isSupport = isSupportRole(s.lob || '');
       if (includeSupportStaff && !isSupport) return null;
       if (!includeSupportStaff && isSupport) return null;

       let recs = s.dailyRecords;

       if (includeOFFGlobal) {
           recs = s.dailyRecords.filter(r => r.isOFF);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isOFF && s.dailyRecords.length === 0) return s;
           return null;
       } 
       if (includeATTGlobal) {
           recs = s.dailyRecords.filter(r => r.isATT);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isATT || s.isOffboarded) return s;
           return null;
       }
       if (includeLOAGlobal) {
           recs = s.dailyRecords.filter(r => r.isLOA);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isLOA) return s;
           return null;
       }
       if (includePTOGlobal) {
           recs = s.dailyRecords.filter(r => r.isPTO);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isPTO) return s;
           return null;
       }
       if (includeSLGlobal) {
           recs = s.dailyRecords.filter(r => r.isSL);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isSL) return s;
           return null;
       }
       if (includeSUSPPGlobal) {
           recs = s.dailyRecords.filter(r => r.isSUSPP);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if (s.isSUSPP) return s;
           return null;
       }
       if (includeAbsencesGlobal) {
           recs = s.dailyRecords.filter(r => r.isAbsence);
           if (recs.length > 0) return { ...s, dailyRecords: recs };
           if ((s.totalAbsences || 0) > 0) return s;
           return null;
       }
       if (includeOffboardedGlobal) {
           if (s.isOffboarded) return s;
           return null;
       }
       return null;
    }).filter(Boolean) as EmployeeSummary[];
  }, [processedSummaries, includeATTGlobal, includeLOAGlobal, includePTOGlobal, includeSLGlobal, includeSUSPPGlobal, includeOFFGlobal, includeOffboardedGlobal, includeAbsencesGlobal, includeSupportStaff]);

  const hasSupportStaffWithStatus = useMemo(() => {
    if (!activeAnyStatus) return false;
    
    return processedSummaries.some(s => {
       if (!isSupportRole(s.lob || '')) return false;

       let recs = s.dailyRecords;

       if (includeOFFGlobal) {
           if (s.dailyRecords.some(r => r.isOFF)) return true;
           if (s.isOFF && s.dailyRecords.length === 0) return true;
       } 
       if (includeATTGlobal) {
           if (s.dailyRecords.some(r => r.isATT)) return true;
           if (s.isATT || s.isOffboarded) return true;
       }
       if (includeLOAGlobal) {
           if (s.dailyRecords.some(r => r.isLOA)) return true;
           if (s.isLOA) return true;
       }
       if (includePTOGlobal) {
           if (s.dailyRecords.some(r => r.isPTO)) return true;
           if (s.isPTO) return true;
       }
       if (includeSLGlobal) {
           if (s.dailyRecords.some(r => r.isSL)) return true;
           if (s.isSL) return true;
       }
       if (includeSUSPPGlobal) {
           if (s.dailyRecords.some(r => r.isSUSPP)) return true;
           if (s.isSUSPP) return true;
       }
       if (includeAbsencesGlobal) {
           if (s.dailyRecords.some(r => r.isAbsence)) return true;
           if ((s.totalAbsences || 0) > 0) return true;
       }
       if (includeOffboardedGlobal) {
           if (s.isOffboarded) return true;
       }
       return false;
    });
  }, [processedSummaries, includeATTGlobal, includeLOAGlobal, includePTOGlobal, includeSLGlobal, includeSUSPPGlobal, includeOFFGlobal, includeOffboardedGlobal, includeAbsencesGlobal]);

  const dashboardStats = useMemo(() => {
    return {
      totalEmployees: filteredSummaries.length,
      totalOverbreakMinutes: filteredSummaries.reduce((acc, s) => acc + s.totalOverbreakMinutes, 0),
      topProblematicEmployees: [...filteredSummaries]
        .sort((a, b) => b.totalOverbreakMinutes - a.totalOverbreakMinutes)
        .slice(0, 5)
        .map(s => ({ name: s.employeeName, overbreak: s.totalOverbreakMinutes })),
      wcAlertCount: filteredSummaries.reduce((acc, s) => acc + s.wcAlerts, 0)
    };
  }, [filteredSummaries]);

  const workingSummaries = useMemo(() => {
    return processedSummaries.filter(s => {
      // Allow if they have daily records (they worked during the filtered period).
      if (s.dailyRecords.length > 0) return true;
      // If they have no records, and they have an absence/offboard status, exclude them.
      return false;
    });
  }, [processedSummaries]);

  const clearExtraStatuses = () => {
    setIncludeATTGlobal(false);
    setIncludeLOAGlobal(false);
    setIncludePTOGlobal(false);
    setIncludeSLGlobal(false);
    setIncludeSUSPPGlobal(false);
    setIncludeOFFGlobal(false);
    setIncludeSupportStaff(false);
  };

  const clearNormalStatuses = () => {
    setTypeFilter('all');
    setIncludeShort30MinGlobal(false);
    setIncludeWcGlobal(false);
    setIncludeIdleGlobal(false);
    setIncludeNonModGlobal(false);
    setIncludeTardinessGlobal(false);
    setIncludeEarlyLeaveGlobal(false);
    setIncludeAbsencesGlobal(false);
    setIncludeOffboardedGlobal(false);
    setIncludeCheckGlobal(false);
    setFilterMinorOverbreaks(false);
  };

  const handleCalendarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error(t('invalidFormat'));
      return;
    }

    setIsCalendarLoading(true);

    const delay = Math.floor(Math.random() * (4000 - 2000 + 1) + 2000);
    const delayPromise = new Promise(resolve => setTimeout(resolve, delay));
    
    const promise = Promise.all([parseCalendarFile(file), delayPromise]).then(([result]) => result);
    
    toast.promise(promise, {
      loading: 'Processando calendário...',
      success: ({ data, note }) => {
        setCalendarData(data);
        setIsCalendarLoading(false);
        let finalNote = getFullMonthName(note, lang);
        if (finalNote === note.toUpperCase() || finalNote === "SHEET1") {
           const fileMonth = getFullMonthName(file.name, lang);
           if (fileMonth !== file.name.toUpperCase()) {
              finalNote = fileMonth;
           } else {
              finalNote = "OK";
           }
        }
        setCalendarNote(finalNote);
        const filteredCount = data.length;
        return `${filteredCount} agentes mapeados.`;
      },
      error: (err) => {
        console.error(err);
        setIsCalendarLoading(false);
        return 'Erro ao processar calendário.';
      }
    });

    // Reset input
    event.target.value = '';
  }, []);

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
    if (timeFilter === 'yesterday') periodLabel = t('filterYesterday');
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
        
        {isCalendarLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="w-24 h-24 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <CalendarIcon className="text-indigo-500 animate-pulse" size={32} />
              </div>
            </div>
            <motion.h2 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-xl font-black text-white tracking-widest uppercase"
            >
              Processando Calendário
            </motion.h2>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 text-sm text-slate-400 font-medium max-w-sm text-center"
            >
              Mapeando horários de turnos e idiomas...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Geometric Theme */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6 hidden lg:flex shrink-0">
        <div className="mb-10">
          <div className="flex flex-col items-start gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">LO</div>
              <h1 className="text-[17px] font-bold tracking-tight">Live <span className="text-blue-400">Overview</span></h1>
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
            <button 
              onClick={() => setActiveTab('lobs')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'lobs' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Target size={16} /> {t('lobsPerformance')}
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
        <header className="sticky top-0 z-[60] flex justify-between items-center py-4 px-8 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 hidden sm:block">
              {summaries.length > 0 ? (activeTab === 'dashboard' ? t('overview') : activeTab === 'lobs' ? t('lobsPerformance') : t('agents')) : ''}
            </h2>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">SC</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {summaries.length > 0 && (
              <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold flex items-center gap-2 h-10 px-4 shadow-sm cursor-pointer transition-colors relative">
                 <Upload size={18} className="text-emerald-600" /> 
                 <span className="hidden sm:inline">{summaries.length > 0 ? t('updateExtract') : t('addExtract')}</span>
                 <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              </label>
            )}
            {summaries.length > 0 && (
              <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold flex items-center gap-2 h-10 px-4 shadow-sm cursor-pointer transition-colors relative">
                 <CalendarIcon size={18} className="text-blue-600" /> 
                 <span className="hidden sm:inline">{calendarData.length > 0 ? t('updateCalendar') : t('addCalendar')}</span>
                 {calendarData.length > 0 && calendarNote && (
                    <span className="absolute -top-2.5 -right-2 bg-indigo-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm border border-indigo-600">
                       {calendarNote}
                    </span>
                 )}
                 <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleCalendarUpload} />
              </label>
            )}
            {summaries.length > 0 && (
              <Button onClick={handleExport} className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 h-10 px-5 shadow-lg shadow-slate-200">
                <FileDown size={18} /> <span className="hidden sm:inline">{t('exportPdf')}</span>
              </Button>
            )}
                <div className="flex lg:hidden gap-1 bg-white border border-slate-200 rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'bg-slate-100' : ''}>
                    <LayoutDashboard size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('list')} className={activeTab === 'list' ? 'bg-slate-100' : ''}>
                    <ListFilter size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('lobs')} className={activeTab === 'lobs' ? 'bg-slate-100' : ''}>
                    <Target size={16} />
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

                <div className="w-full flex flex-col sm:flex-row gap-6">
                  <label className="relative group flex flex-col items-center justify-center w-full sm:w-1/2 h-80 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer overflow-hidden shadow-2xl shadow-slate-200/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-6 z-10 text-center px-4">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl group-hover:bg-blue-600 transition-colors shadow-lg">
                        <Upload size={32} />
                      </div>
                      <div>
                        <p className="mb-1 text-2xl font-bold text-slate-800">{t('homeSelectReport')}</p>
                        <p className="text-slate-400 font-medium text-sm">{t('homeLimitsInfo')}</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                  </label>

                  <label className="relative group flex flex-col items-center justify-center w-full sm:w-1/2 h-80 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white hover:bg-slate-50 hover:border-green-400 transition-all cursor-pointer overflow-hidden shadow-xl shadow-slate-200/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-6 z-10 text-center px-4">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl group-hover:bg-green-600 transition-colors shadow-lg">
                        <CalendarIcon size={32} />
                      </div>
                      <div>
                        <p className="mb-1 text-2xl font-bold text-slate-800">1. Opcional: Calendário</p>
                        <p className="text-slate-400 font-medium text-sm">Carregue o calendário (.csv ou ext) primeiro ou depois para o mapping de LOB e Language.</p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleCalendarUpload} />
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
                <div className="sticky lg:top-[72px] top-[72px] z-[50] bg-slate-50/95 backdrop-blur-md border-b border-slate-200 pb-4 pt-4 px-8 -mx-8 -mt-8 mb-8 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-none">{t('realtimeMetrics')}</h3>
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between w-full">
                      <p className="text-2xl font-black text-slate-900 hidden sm:block whitespace-nowrap">{t('auditResults')}</p>
                      <div className="flex flex-col items-end gap-2 w-full">
                        {/* Top Filter Row: Shift Select */}
                        <div className="flex gap-1 items-center bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm overflow-x-auto w-full sm:w-auto">
                          <span className="text-[10px] font-black uppercase text-slate-400 px-2">Shift:</span>
                          <button 
                             onClick={() => setShiftFilter([])}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${shiftFilter.length === 0 ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                           >
                             Todos
                          </button>
                          {availableShifts.map(shift => (
                             <button 
                               key={shift}
                               onClick={() => {
                                 if (shiftFilter.includes(shift)) {
                                   setShiftFilter(shiftFilter.filter(s => s !== shift));
                                 } else {
                                   setShiftFilter([...shiftFilter, shift]);
                                 }
                               }}
                               className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${shiftFilter.includes(shift) ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                             >
                               {shift}
                             </button>
                          ))}
                          <button 
                             onClick={() => {
                               if (shiftFilter.includes('CHECK')) {
                                 setShiftFilter(shiftFilter.filter(s => s !== 'CHECK'));
                               } else {
                                 setShiftFilter([...shiftFilter, 'CHECK']);
                               }
                             }}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${shiftFilter.includes('CHECK') ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                           >
                             CHECK
                          </button>
                        </div>

                        {/* Bottom Filter Row: Calendars and Options */}
                        <div className="flex gap-2 flex-wrap justify-end w-full">
                          <div className="flex gap-1 items-center bg-white border border-slate-200 p-1.5 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto">
                            <span className="text-[10px] font-black uppercase text-slate-400 px-2">Período:</span>
                            <Popover>
                              <PopoverTrigger
                                   className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 bg-amber-500 text-white shadow-md hover:bg-amber-600`}
                                 >
                                   <CalendarIcon size={12} />
                                   Calendário {selectedDates && selectedDates.length > 0 ? `(${selectedDates.length})` : ''}
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                  <div className="p-2 border-b border-slate-100 flex justify-between gap-2 bg-slate-50">
                                     <Button 
                                       variant="outline" 
                                       size="sm" 
                                       className="text-[10px] font-bold uppercase h-7 px-2 border-slate-200 rounded-full"
                                       onClick={() => {
                                          const now = new Date();
                                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                                          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                                          const days = [];
                                          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                             days.push(new Date(d));
                                          }
                                          setSelectedDates(days);
                                          setTimeFilter('all');
                                       }}
                                     >
                                       {t('filterMonth')}
                                     </Button>
                                     <Button 
                                       variant="outline" 
                                       size="sm" 
                                       className="text-[10px] font-bold uppercase h-7 px-2 border-slate-200 rounded-full"
                                       onClick={() => {
                                          const now = new Date();
                                          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                          const end = new Date(now.getFullYear(), now.getMonth(), 0);
                                          const days = [];
                                          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                             days.push(new Date(d));
                                          }
                                          setSelectedDates(days);
                                          setTimeFilter('all');
                                       }}
                                     >
                                       {t('filterPrevMonth')}
                                     </Button>
                                     <Button 
                                       variant="ghost" 
                                       size="sm" 
                                       className="text-[10px] font-bold uppercase h-7 px-2 text-rose-500 hover:text-rose-600 rounded-full"
                                       onClick={() => setSelectedDates(undefined)}
                                     >
                                       Limpar
                                     </Button>
                                  </div>
                                  <CustomCalendar
                                      summaries={mergedSummaries}
                                      selectedDates={selectedDates}
                                      onSelectDates={(dates) => {
                                          setSelectedDates(dates);
                                          if (dates && dates.length > 0) setTimeFilter('all');
                                      }}
                                  />
                              </PopoverContent>
                            </Popover>
                            {(['month', 'prev_month', 'week', 'yesterday', 'day'] as const).map(filter => (
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
                                 className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${timeFilter === filter && (!selectedDates || selectedDates.length === 0) ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                               >
                                 {filter === 'month' ? t('filterMonth') : filter === 'prev_month' ? t('filterPrevMonth') : filter === 'week' ? t('filterWeek') : filter === 'yesterday' ? t('filterYesterday') : t('filterDay')}
                               </button>
                            ))}
                          </div>
                          
                          <div className="flex gap-1 items-center bg-white border border-slate-200 p-1.5 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto">
                             <span className="text-[10px] font-black uppercase text-slate-400 px-2 shrink-0">Status:</span>
                             <button 
                               onClick={() => { setTypeFilter(typeFilter === 'all' ? 'idle_overbreak_wc' : 'all'); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${typeFilter === 'idle_overbreak_wc' ? 'bg-rose-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               OVERBREAKS
                             </button>
                             <button
                               onClick={() => { setIncludeShort30MinGlobal(!includeShort30MinGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${includeShort30MinGlobal ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'}`}
                             >
                               30MIN
                             </button>
                             <button
                               onClick={() => { setIncludeWcGlobal(!includeWcGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeWcGlobal ? 'bg-amber-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               Organic
                             </button>
                             <button
                               onClick={() => { setIncludeIdleGlobal(!includeIdleGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeIdleGlobal ? 'bg-rose-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               IDLE
                             </button>
                             <button
                               onClick={() => { setIncludeNonModGlobal(!includeNonModGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeNonModGlobal ? 'bg-teal-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               NON-MOD
                             </button>
                             <button
                               onClick={() => { setIncludeTardinessGlobal(!includeTardinessGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeTardinessGlobal ? 'bg-orange-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               TARDINESS
                             </button>
                             <button
                               onClick={() => { setIncludeEarlyLeaveGlobal(!includeEarlyLeaveGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeEarlyLeaveGlobal ? 'bg-orange-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               EARLY LEAVE
                             </button>
                             <button
                               onClick={() => { setIncludeAbsencesGlobal(!includeAbsencesGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap overflow-hidden relative flex items-center gap-2 ${includeAbsencesGlobal ? 'bg-red-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               <span className="relative z-10 hidden sm:inline">FALTAS</span>
                               <span className="relative z-10 sm:hidden">FALTAS</span>
                               
                               <span className="hidden">
                                  {filteredSummaries.reduce((acc, s) => acc + (s.totalAbsences || 0), 0) > 0 ? (
                                     <span>{filteredSummaries.reduce((acc, s) => acc + (s.totalAbsences || 0), 0)}</span>
                                  ) : (
                                     <span className={includeAbsencesGlobal ? 'text-white' : 'text-emerald-500'}>0</span>
                                  )}
                               </span>
                             </button>
                             <button
                               onClick={() => { setIncludeOffboardedGlobal(!includeOffboardedGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap overflow-hidden relative flex items-center gap-2 ${includeOffboardedGlobal ? 'bg-slate-700 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                                <span className="relative z-10 hidden sm:inline">OFFBOARDED</span>
                                <span className="relative z-10 sm:hidden">OFFBOARDED</span>
                                <span className="hidden">
                                  {summaries.filter(s => s.isOffboarded).length}
                                </span>
                             </button>
                             <button
                               onClick={() => { setIncludeCheckGlobal(!includeCheckGlobal); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeCheckGlobal ? 'bg-amber-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               CHECK
                             </button>
                             <button
                               onClick={() => { setFilterMinorOverbreaks(!filterMinorOverbreaks); clearExtraStatuses(); }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filterMinorOverbreaks ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                               title="Mostra apenas agentes com total de 2 minutos ou menos"
                             >
                               2min or less
                             </button>
                           </div>
                           
                           <div className="flex gap-1 items-center bg-white border border-slate-200 p-1.5 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto mt-1">
                             <span className="text-[10px] font-black uppercase text-slate-400 px-2 shrink-0">Status Extras:</span>
                             <button
                               onClick={() => {
                                 setIncludeATTGlobal(!includeATTGlobal);
                                 clearNormalStatuses();
                                 if (!includeATTGlobal) { setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeATTGlobal ? 'bg-slate-800 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               ATT
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeLOAGlobal(!includeLOAGlobal);
                                 clearNormalStatuses();
                                 if (!includeLOAGlobal) { setIncludeATTGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeLOAGlobal ? 'bg-indigo-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               LOA
                             </button>
                             <button
                               onClick={() => {
                                 setIncludePTOGlobal(!includePTOGlobal);
                                 clearNormalStatuses();
                                 if (!includePTOGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includePTOGlobal ? 'bg-cyan-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               PTO (VAC)
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeSLGlobal(!includeSLGlobal);
                                 clearNormalStatuses();
                                 if (!includeSLGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeSLGlobal ? 'bg-rose-400 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               SL
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeSUSPPGlobal(!includeSUSPPGlobal);
                                 clearNormalStatuses();
                                 if (!includeSUSPPGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeSUSPPGlobal ? 'bg-red-700 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               SUSPP
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeOFFGlobal(!includeOFFGlobal);
                                 clearNormalStatuses();
                                 if (!includeOFFGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); }
                               }}
                               className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeOFFGlobal ? 'bg-slate-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               OFF
                             </button>
                             
                             <AnimatePresence>
                               {activeAnyStatus && hasSupportStaffWithStatus && (
                                 <motion.button
                                   initial={{ opacity: 0, scale: 0.8 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   exit={{ opacity: 0, scale: 0.8 }}
                                   onClick={() => setIncludeSupportStaff(!includeSupportStaff)}
                                   className={`px-3 py-1.5 w-full sm:w-auto rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative flex items-center gap-2 ${includeSupportStaff ? 'bg-fuchsia-600 text-white shadow-md' : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 hover:bg-fuchsia-100 shadow-[0_0_12px_rgba(192,38,211,0.5)] animate-pulse'}`}
                                 >
                                   SUPPORT STAFF
                                 </motion.button>
                               )}
                             </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-[600px]">
                  {activeTab === 'dashboard' ? (
                    <StatsDashboard 
                      summaries={activeAnyStatus ? filteredSummaries : workingSummaries} 
                      allSummaries={mergedSummaries} 
                      periodSummaries={periodSummaries} 
                      basePeriodCount={basePeriodSummaries.length} 
                      latestDate={latestDate} 
                      globalTypeFilter={typeFilter}
                      globalTimeFilter={timeFilter}
                      globalIncludeWc={includeWcGlobal} 
                      globalIncludeIdle={includeIdleGlobal} 
                      globalIncludeNonMod={includeNonModGlobal} 
                      globalIncludeTardiness={includeTardinessGlobal} 
                      globalIncludeEarlyLeave={includeEarlyLeaveGlobal} 
                      globalIncludeShort30Min={includeShort30MinGlobal} 
                      globalIncludeAbsences={includeAbsencesGlobal}
                      globalIncludeOffboarded={includeOffboardedGlobal}
                      globalIncludeATT={includeATTGlobal}
                      globalIncludeLOA={includeLOAGlobal}
                      globalIncludePTO={includePTOGlobal}
                      globalIncludeSL={includeSLGlobal}
                      globalIncludeSUSPP={includeSUSPPGlobal}
                      globalIncludeOFF={includeOFFGlobal}
                      globalFilterMajorOverbreaks={false} 
                      globalShiftFilter={shiftFilter} 
                    />
                  ) : activeTab === 'lobs' ? (
                    <LOBAnalytics summaries={filteredSummaries} />
                  ) : (
                    <EmployeeList summaries={filteredSummaries} allSummaries={mergedSummaries} latestDate={latestDate} initialFilter={timeFilter} globalTypeFilter={typeFilter} globalIncludeWc={includeWcGlobal} globalIncludeIdle={includeIdleGlobal} globalIncludeNonMod={includeNonModGlobal} globalIncludeTardiness={includeTardinessGlobal} globalIncludeEarlyLeave={includeEarlyLeaveGlobal} globalIncludeShort30Min={includeShort30MinGlobal} globalIncludeCheck={includeCheckGlobal} globalFilterMajorOverbreaks={false} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Summary Banner */}
          <AnimatePresence>
            {filteredSummaries.length > 0 && !isLoading && !isCalendarLoading && (
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 px-6 py-3 rounded-full shadow-2xl shadow-indigo-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col border-r border-slate-700 pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('agents')}</span>
                    <span className="text-sm font-black text-white">{filteredSummaries.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('totalOverbreak')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-rose-400">
                        {Math.floor(dashboardStats.totalOverbreakMinutes / 60)}h {dashboardStats.totalOverbreakMinutes % 60}m
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col border-l border-slate-700 pl-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('avgOverbreak')}</span>
                    <span className="text-sm font-black text-indigo-400">
                      {summaries.length > 0 ? Math.round(dashboardStats.totalOverbreakMinutes / summaries.length) : 0}m
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

