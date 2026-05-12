/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Upload, FileDown, LogOut, FileSpreadsheet, LayoutDashboard, ListFilter, Trash2, Target, HelpCircle, Users, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Toaster } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from 'sonner';
import { isShiftMismatch } from './lib/shiftUtils';
import { format } from 'date-fns';
import { useLanguage } from './contexts/LanguageContext';
import { EmployeeSummary, EmployeeDayRecord } from './types';
import { parseExcelFile } from './lib/excel-parser';
import { exportToPDF } from './lib/pdf-exporter';
import { parseCalendarFile } from './lib/calendar-parser';
import { parseStaffInfoFile, StaffInfoEntry } from './lib/staff-info-parser';
import { StatsDashboard } from './components/StatsDashboard';
import { EmployeeList } from './components/EmployeeList';
import { motion, AnimatePresence } from 'motion/react';

import { CustomCalendar } from './components/CustomCalendar';
import { LOBAnalytics, isSupportRole } from './components/LOBAnalytics';
import { SupportSchedule } from './components/SupportSchedule';
import { HowTo } from './components/HowTo';

// LOB exclusion removed per user request

export default function App() {
  const { lang, setLang, t } = useLanguage();

  const normalizeLanguage = (lang?: string): string => {
    if (!lang) return '';
    const upper = lang.toUpperCase().trim();
    if (upper === 'GERMAN') return 'DE';
    if (upper === 'PORTUGUESE') return 'PT';
    if (upper === 'SPANISH') return 'ES';
    if (upper === 'ITALIAN') return 'IT';
    if (upper === 'ROMANIAN') return 'RO';
    if (upper === 'FRENCH') return 'FR';
    if (upper === 'ENGLISH') return 'EN';
    return upper;
  };

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
  const [lastExtractTime, setLastExtractTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [staffInfoData, setStaffInfoData] = useState<StaffInfoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isStaffInfoLoading, setIsStaffInfoLoading] = useState(false);
  const [calendarNote, setCalendarNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'prev_month' | 'week' | 'day' | 'yesterday'>('day');
  const [typeFilter, setTypeFilter] = useState<'all' | 'idle_overbreak_wc'>('all');
  const [shiftFilter, setShiftFilter] = useState<string[]>([]);
  const [includeWcGlobal, setIncludeWcGlobal] = useState(false);
  const [includeIdleGlobal, setIncludeIdleGlobal] = useState(false);
  const [includeNonModGlobal, setIncludeNonModGlobal] = useState(false);
  const [includeTardinessGlobal, setIncludeTardinessGlobal] = useState(false);
  const [includeMinorTardinessGlobal, setIncludeMinorTardinessGlobal] = useState(false);
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
  const [showRealTime, setShowRealTime] = useState(false);
  const [isStaffInChargeOpen, setIsStaffInChargeOpen] = useState(false);
  const [isMissingStaffOpen, setIsMissingStaffOpen] = useState(false);

  const normalizeName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\.,\-]/g, ' ');

  const findCalendarEntry = useCallback((staffEmail: string, staffName: string) => {
      // 1. Email matching
      let calEntry = calendarData.find(c => c.email && c.email.toLowerCase() === staffEmail.toLowerCase());

      if (!calEntry) {
          // 2. Exact name matching
          const staffNameNormalized = normalizeName(staffName);
          calEntry = calendarData.find(c => normalizeName(c.name) === staffNameNormalized);
          
          if (!calEntry) {
            // 3. Partial name matching
            calEntry = calendarData.find(c => {
              const rawCalParts = normalizeName(c.name).split(/\s+/);
              const rawStaffParts = staffNameNormalized.split(/\s+/);
              
              if (rawCalParts.length > 0 && rawStaffParts.length > 0) {
                 if (rawCalParts[0] === rawStaffParts[0] && (rawCalParts.length === 1 || rawStaffParts.length === 1)) {
                     return true;
                 }
                 
                 const calNameParts = rawCalParts.filter(p => p.length > 2);
                 const staffNameParts = rawStaffParts.filter(p => p.length > 2);
                 
                 const overlap = calNameParts.filter(p => staffNameParts.includes(p));
                 if (overlap.length > 1) return true;
              }
              return false;
            });
          }
      }
      return calEntry;
  }, [calendarData]);

  const missingStaffNames = useMemo(() => {
     if (staffInfoData.length === 0 || calendarData.length === 0) return [];
     
     const missing: string[] = [];
     for (const staff of staffInfoData) {
         if (staff.status !== 'ACTIVE' || staff.role !== 'CSR') continue;
         if (!findCalendarEntry(staff.email, staff.fullName)) {
             missing.push(staff.fullName);
         }
     }
     return missing;
  }, [staffInfoData, findCalendarEntry]);

  const cleanShift = (shift: string) => {
    if (!shift) return shift;
    const match = shift.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
    if (!match) return shift;

    const parseTimeComp = (t: string) => {
        const tUpper = t.toUpperCase();
        const isPM = tUpper.includes('PM');
        const isAM = tUpper.includes('AM');
        let parts = tUpper.replace(/[A-Z\s]/g, '').split(':');
        let h = parseInt(parts[0]) || 0;
        let m = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
        if (isPM && h !== 12) h += 12;
        if (isAM && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    return `${parseTimeComp(match[1])}-${parseTimeComp(match[2])}`;
  };

  const availableShifts = useMemo(() => {
    const shifts = new Set<string>();
    summaries.forEach(s => s.dailyRecords.forEach(r => {
      if (r.scheduledShift) shifts.add(cleanShift(r.scheduledShift));
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
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  }, []);

  const { globalMinDate, globalMaxDate } = useMemo(() => {
    let min = new Date('2099-01-01');
    let max = new Date('2000-01-01');
    summaries.forEach(s => s.dailyRecords.forEach(r => {
      const d = new Date(r.date + 'T12:00:00');
      if (d < min) min = d;
      if (d > max) max = d;
    }));

    // Also include calendar dates
    calendarData.forEach(c => {
      if (c.schedule) {
        Object.keys(c.schedule).forEach(dateStr => {
          // calendar keys are either yyyy-MM-dd or dd/MM/yyyy
          let d: Date | null = null;
          if (dateStr.includes('-')) {
             const parts = dateStr.split('-');
             if (parts.length === 3) {
                // Check if YYYY-MM-DD
                if (parts[0].length === 4) {
                   d = new Date(dateStr + 'T12:00:00');
                } else if (parts[2].length === 4) {
                   // DD-MM-YYYY
                   d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                }
             }
          } else if (dateStr.includes('/')) {
             const parts = dateStr.split('/');
             if (parts.length === 3) {
                if (parts[2].length === 4) {
                  d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                } else if (parts[0].length === 4) {
                  d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`);
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
    // 1. Appply Staff Info overrides to all staff (even those not in Byteworks)
    const allStaff = [...staffInfoData.filter(s => s.status === 'ACTIVE' && s.lob !== 'Stranded Resource')];
    const emailToStaff = new Map(allStaff.map(s => [s.email.toLowerCase(), s]));

    // Map summary to staff info if possible
    let mergedSummaries = summaries.map(s => {
       const staffEntry = (s.email && emailToStaff.get(s.email.toLowerCase())) || 
                          allStaff.find(si => normalizeName(si.fullName) === normalizeName(s.employeeName));
       
       if (!staffEntry) return null; // "Somente os agentes cujo email está no byteworks e consecutivamente no staff info"

       let finalLob = s.lob;
       let finalLang = s.language;
       let finalRole = s.role;
       let finalSup = s.supervisor;
       let finalName = s.employeeName;
       let finalEmail = s.email;

       if (staffEntry) {
          finalName = staffEntry.fullName;
          finalLob = staffEntry.lob || s.lob;
          finalLang = staffEntry.language || s.language;
          finalRole = staffEntry.role || s.role;
          finalSup = staffEntry.tl || s.supervisor;
          finalEmail = staffEntry.email || s.email;
       }

       if (finalLob && finalLob.toUpperCase() === 'LMG LATAM') {
          finalLob = 'LMEG LATAM';
       }
       if (finalLob && finalLob.toUpperCase() === 'BPO LED QUALITY') {
          finalLob = 'BPO LED Quality';
       }
       if (finalLob && finalLob.toUpperCase() === 'HIGH REPORTED QUEUE') {
          finalLob = 'HRQ';
       }

       return {
          ...s,
          employeeName: finalName,
          email: finalEmail,
          lob: finalLob,
          language: normalizeLanguage(finalLang),
          role: finalRole,
          supervisor: finalSup,
          dailyRecords: s.dailyRecords.map(r => ({ 
              ...r, 
              employeeName: finalName, 
              lob: finalLob 
          }))
       };
    });

    const dedupedMap = new Map<string, EmployeeSummary>();
    mergedSummaries.forEach(s => {
        if (!s) return;
        const key = normalizeName(s.employeeName);
        if (dedupedMap.has(key)) {
            const existing = dedupedMap.get(key)!;
            s.dailyRecords.forEach(dr => {
                const existingDr = existing.dailyRecords.find(e => e.date === dr.date);
                if (existingDr) {
                    existingDr.tasks = (existingDr.tasks || 0) + (dr.tasks || 0);
                    existingDr.breaks.push(...dr.breaks);
                    existingDr.totalWorkTimeMillis += dr.totalWorkTimeMillis;
                    existingDr.totalOfflineTimeMillis += dr.totalOfflineTimeMillis;
                } else {
                    existing.dailyRecords.push(dr);
                }
            });
            existing.totalTasks = (existing.totalTasks || 0) + (s.totalTasks || 0);
            if (s.email && !existing.email) existing.email = s.email;
        } else {
            dedupedMap.set(key, s);
        }
    });
    mergedSummaries = Array.from(dedupedMap.values()).filter(Boolean) as EmployeeSummary[];

    if (calendarData.length === 0) return mergedSummaries;

    const matchedCalendarNames = new Set<string>();

    const updatedSummaries = mergedSummaries.map(s => {
       let calEntry = findCalendarEntry(s.email || '', s.employeeName);
       
       if (calEntry) {
          matchedCalendarNames.add(normalizeName(calEntry.name));
          const existingDates = new Set(s.dailyRecords.map(r => r.date));
          const newRecords = [...s.dailyRecords];
          
          if (globalMinDate <= globalMaxDate && calEntry.schedule && !s.isOffboarded) {
              let d = new Date(globalMinDate);
              while (d <= globalMaxDate) {
                 const dateStr = format(d, 'yyyy-MM-dd');
                 const dateKey = format(d, 'dd/MM/yyyy');
                 const dateKeyAlt = format(d, 'MM/dd/yyyy');
                 
                 if (!existingDates.has(dateStr)) {
                    let shiftForDay = calEntry.schedule[dateStr] || calEntry.schedule[dateKey] || calEntry.schedule[dateKeyAlt];
                    
                    // If not in schedule, look in byteworks records for this day
                    if (!shiftForDay) {
                        const byteworksRecord = s.dailyRecords.find(r => r.date === dateStr);
                        if (byteworksRecord && (byteworksRecord.scheduledShift || byteworksRecord.inferredShift)) {
                            shiftForDay = byteworksRecord.scheduledShift || byteworksRecord.inferredShift;
                        }
                    }
                    
                    if (shiftForDay) {
                        const schedUpper = String(shiftForDay).toUpperCase();
                        const isWorkingShift = /\d{1,2}:\d{2}/.test(schedUpper);
                        const isWorkday = !schedUpper.includes('OFF') && !schedUpper.includes('VAC') && !schedUpper.includes('FESTA') && !schedUpper.includes('HOLIDAY') && !schedUpper.includes('LOA') && !schedUpper.includes('PTO') && !schedUpper.includes('SL') && !schedUpper.includes('ATT') && !schedUpper.includes('SUSPP');
                        const latestDateStr = format(latestDate, 'yyyy-MM-dd');
                        
                        let hasShiftStarted = true;
                        
                        if (isWorkday) {
                          const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
                          const todayStr = format(now, 'yyyy-MM-dd');
                          
                          if (dateStr > latestDateStr) {
                             hasShiftStarted = false;
                          } else if (dateStr === latestDateStr && isWorkingShift) {
                             const match = schedUpper.match(/(\d{1,2}):(\d{2})/);
                             if (match) {
                                const h = parseInt(match[1], 10);
                                const m = parseInt(match[2], 10);
                                const shiftStartMinutes = h * 60 + m;
                                const latestMinutes = latestDate.getHours() * 60 + latestDate.getMinutes();
                                if (shiftStartMinutes > latestMinutes) {
                                   hasShiftStarted = false;
                                }
                             }
                          }
                          
                          if (hasShiftStarted) {
                              if (dateStr > todayStr) {
                                 hasShiftStarted = false;
                              } else if (dateStr === todayStr && isWorkingShift) {
                                 const match = schedUpper.match(/(\d{1,2}):(\d{2})/);
                                 if (match) {
                                    const h = parseInt(match[1], 10);
                                    const m = parseInt(match[2], 10);
                                    const shiftStartMinutes = h * 60 + m;
                                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                                    
                                    if (shiftStartMinutes > currentMinutes) {
                                       hasShiftStarted = false;
                                    }
                                 }
                              }
                          }
                        }

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
                           inferredShift: shiftForDay,
                           scheduledShift: shiftForDay,
                           isAbsence: isWorkday && hasShiftStarted
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
              const currentLob = specificLob || s.lob || calEntry?.lob;
              
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

           let finalAgentLob = s.lob || calEntry?.lob;
           if (finalAgentLob && finalAgentLob.toUpperCase() === 'LMG LATAM') {
               finalAgentLob = 'LMEG LATAM';
           }
           if (finalAgentLob && finalAgentLob.toUpperCase() === 'BPO LED QUALITY') {
               finalAgentLob = 'BPO LED Quality';
           }
           if (finalAgentLob && finalAgentLob.toUpperCase() === 'HIGH REPORTED QUEUE') {
               finalAgentLob = 'HRQ';
           }

           const updatedRecordsWithLMEG = updatedDailyRecords.map(r => {
                let rLob = r.lob;
                if (rLob && rLob.toUpperCase() === 'LMG LATAM') {
                    rLob = 'LMEG LATAM';
                }
                if (rLob && rLob.toUpperCase() === 'BPO LED QUALITY') {
                    rLob = 'BPO LED Quality';
                }
                return { ...r, lob: rLob };
           });

           return {
              ...s,
              calendarName: calEntry.name,
              lob: finalAgentLob,
              totalAbsences,
              dailyRecords: updatedRecordsWithLMEG
           };
       }
       return s;
    });

    return updatedSummaries;
  }, [summaries, calendarData, staffInfoData, globalMinDate, globalMaxDate, latestDate]);

  // Data exclusively for the "OS - Schedule" tab
  const supportScheduleData = useMemo(() => {
    // Per user: this tab should only use information from the schedule file
    return calendarData.filter(c => isSupportRole({ role: c.role, lob: c.lob }))
      .map(c => {
         const dailyRecords: EmployeeDayRecord[] = [];
         if (globalMinDate <= globalMaxDate && c.schedule) {
            let d = new Date(globalMinDate);
            while (d <= globalMaxDate) {
               const dateStr = format(d, 'yyyy-MM-dd');
               const dateKey = format(d, 'dd/MM/yyyy');
               const dateKeyAlt = format(d, 'MM/dd/yyyy');
               const schedule = c.schedule[dateStr] || c.schedule[dateKey] || c.schedule[dateKeyAlt];
               if (schedule) {
                  const shiftUpper = String(schedule).toUpperCase();
                  dailyRecords.push({
                     date: dateStr,
                     employeeName: c.name,
                     totalWorkTimeMillis: 0,
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
                     totalOverbreak: 0,
                     tardinessMinutes: 0,
                     earlyLeaveMinutes: 0,
                     nonModDuration: 0,
                     reviewAndAppealDuration: 0,
                     awaitingTasksDuration: 0,
                     forgotStatusDuration: 0,
                     scheduledShift: schedule,
                     inferredShift: schedule,
                     lob: c.lob?.toUpperCase() === 'LMG LATAM' ? 'LMEG LATAM' : (c.lob?.toUpperCase() === 'BPO LED QUALITY' ? 'BPO LED Quality' : (c.lob?.toUpperCase() === 'HIGH REPORTED QUEUE' ? 'HRQ' : c.lob)),
                     isOFF: shiftUpper.includes('OFF') || shiftUpper.includes('FOLGA'),
                     isPTO: shiftUpper.includes('VAC') || shiftUpper.includes('PTO') || shiftUpper.includes('FÉRIAS'),
                     isSL: shiftUpper.includes('SL') || shiftUpper.includes('SICK'),
                     isLOA: shiftUpper.includes('LOA'),
                     isSUSPP: shiftUpper.includes('SUSPP'),
                     isATT: shiftUpper.includes('ATT'),
                     isAbsence: false
                  });
               }
               d.setDate(d.getDate() + 1);
            }
         }

         return {
            employeeName: c.name,
            email: c.email || '',
            lob: c.lob?.toUpperCase() === 'LMG LATAM' ? 'LMEG LATAM' : (c.lob?.toUpperCase() === 'BPO LED QUALITY' ? 'BPO LED Quality' : (c.lob?.toUpperCase() === 'HIGH REPORTED QUEUE' ? 'HRQ' : c.lob)),
            role: c.role,
            shift: c.shift,
            language: normalizeLanguage(c.language),
            calendarName: c.name,
            dailyRecords: dailyRecords.sort((a, b) => a.date.localeCompare(b.date))
         } as EmployeeSummary;
      });
  }, [calendarData, globalMinDate, globalMaxDate]);

  const availableFilters = useMemo(() => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
    const tm = today.getMonth();
    const ty = today.getFullYear();
    const td = today.getDate();
    
    const pm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const pmM = pm.getMonth();
    const pmY = pm.getFullYear();
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const ym = yesterday.getMonth();
    const yy = yesterday.getFullYear();
    const yd = yesterday.getDate();
    
    const dow = today.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMon);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const filters = new Set<string>();
    const distinctMonths = new Set<string>();

    filters.add('day'); // ALWAYS add 'day' so "HOJE" is available

    if (summaries) {
        summaries.forEach(s => {
            if (s.dailyRecords) {
                s.dailyRecords.forEach(r => {
                    const d = new Date(r.date + 'T12:00:00');
                    distinctMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
                    if (d >= startOfWeek && d <= endOfWeek) filters.add('week');
                    if (d.getDate() === td && d.getMonth() === tm && d.getFullYear() === ty) filters.add('day');
                    if (d.getDate() === yd && d.getMonth() === ym && d.getFullYear() === yy) filters.add('yesterday');
                });
            }
        });

        if (distinctMonths.size > 1) {
            summaries.forEach(s => {
                if (s.dailyRecords) {
                    s.dailyRecords.forEach(r => {
                        const d = new Date(r.date + 'T12:00:00');
                        if (d.getMonth() === tm && d.getFullYear() === ty) filters.add('month');
                        if (d.getMonth() === pmM && d.getFullYear() === pmY) filters.add('prev_month');
                    });
                }
            });
        }
    }
    
    return Array.from(filters);
  }, [summaries]);

  const isRecordActiveNow = (r: EmployeeDayRecord, requireActivity: boolean = true) => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
    const todayDateStr = format(now, 'yyyy-MM-dd');
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    if (r.date !== todayDateStr && r.date !== yesterdayStr) return false;

    const shiftStr = r.scheduledShift || r.inferredShift;
    if (!shiftStr) return false;

    const cleaned = cleanShift(shiftStr);
    const times = cleaned.split('-');
    if (times.length === 2) {
        const [sh, sm] = times[0].split(':').map(Number);
        const [eh, em] = times[1].split(':').map(Number);
        
        if (!isNaN(sh) && !isNaN(eh)) {
            let startTotal = sh * 60 + (sm || 0);
            let endTotal = eh * 60 + (em || 0);
            if (endTotal <= startTotal) endTotal += 24 * 60; // passes midnight

            const curTotal = now.getHours() * 60 + now.getMinutes();
            
            let shiftMatchesNow = false;

            if (r.date === yesterdayStr) {
                if (endTotal > 24 * 60) {
                    if (curTotal <= (endTotal - 24 * 60)) { 
                        shiftMatchesNow = true;
                    }
                }
            } else if (r.date === todayDateStr) {
                if (endTotal > 24 * 60) {
                    if (curTotal >= startTotal) shiftMatchesNow = true;
                } else {
                    if (curTotal >= startTotal && curTotal <= endTotal) shiftMatchesNow = true;
                }
            }

            if (shiftMatchesNow) {
                if (requireActivity) {
                    const hasRealActivity = r.actualStartTime != null || r.totalWorkTimeMillis > 0 || (r.breaks && r.breaks.length > 0);
                    if (!hasRealActivity) {
                        return false;
                    }
                }
                let latestBreak: any = null;
                if (r.breaks && r.breaks.length > 0) {
                    for (const b of r.breaks) {
                        if (!latestBreak || b.endTime.getTime() > latestBreak.endTime.getTime()) {
                            latestBreak = b;
                        }
                    }
                }

                if (!latestBreak || (latestBreak.type !== 'offline' && latestBreak.type !== 'forgot_status')) {
                    return true;
                }
            }
        }
    }
    return false;
  };

  const isAgentActiveNow = (records: EmployeeDayRecord[], requireActivity: boolean = true) => {
    return records.some(r => isRecordActiveNow(r, requireActivity));
  };

  const recordTimeFilterFn = useMemo(() => {
    const selectedDateStrings = selectedDates && selectedDates.length > 0 ? selectedDates.map(d => format(d, 'yyyy-MM-dd')) : [];
    
    const today = showRealTime ? new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" })) : new Date(latestDate);
    const tm = today.getMonth();
    const ty = today.getFullYear();
    const td = today.getDate();
    
    // For Real Time explicitly
    const realToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
    const td_rt = realToday.getDate();
    const tm_rt = realToday.getMonth();
    const ty_rt = realToday.getFullYear();
    const realYesterday = new Date(realToday);
    realYesterday.setDate(realYesterday.getDate() - 1);
    const yd_rt = realYesterday.getDate();
    const ym_rt = realYesterday.getMonth();
    const yy_rt = realYesterday.getFullYear();
    
    const pm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const pmM = pm.getMonth();
    const pmY = pm.getFullYear();
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const ym = yesterday.getMonth();
    const yy = yesterday.getFullYear();
    const yd = yesterday.getDate();
    
    const dow = today.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMon);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return (r: EmployeeDayRecord) => {
        if (showRealTime) {
           // When in Real Time mode, only the specifically active record matters.
           // Setting requireActivity to false here because the overall agent active check
           // handles requiring activity. We just want to retain the record that *could* be active.
           return isRecordActiveNow(r, false);
        }

        if (selectedDateStrings.length > 0) {
           if (!selectedDateStrings.includes(r.date)) return false;
        }
        
        const isShiftCrossingMidnight = (shiftStr: string | null | undefined) => {
            if (!shiftStr) return false;
            let cleaned = cleanShift(shiftStr).replace(/\s+/g, '').toUpperCase();
            
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

        if (timeFilter !== 'all') {
           const d = new Date(r.date + 'T12:00:00');
           if (timeFilter === 'month') {
              if (d.getMonth() !== tm || d.getFullYear() !== ty) return false;
           }
           if (timeFilter === 'prev_month') {
              if (d.getMonth() !== pmM || d.getFullYear() !== pmY) return false;
           }
           if (timeFilter === 'week') {
              if (d < startOfWeek || d > endOfWeek) return false;
           }
           if (timeFilter === 'day') {
              const isToday = d.getDate() === td && d.getMonth() === tm && d.getFullYear() === ty;
              const isYesterday = d.getDate() === yd && d.getMonth() === ym && d.getFullYear() === yy;
              if (isToday) return true;
              if (isYesterday && (isShiftCrossingMidnight(r.scheduledShift) || isShiftCrossingMidnight(r.inferredShift))) return true;
              return false;
           }
           if (timeFilter === 'yesterday') {
              const isYesterday = d.getDate() === yd && d.getMonth() === ym && d.getFullYear() === yy;
              const b4Date = new Date(yesterday);
              b4Date.setDate(b4Date.getDate() - 1);
              const isDayBeforeYesterday = d.getDate() === b4Date.getDate() && d.getMonth() === b4Date.getMonth() && d.getFullYear() === b4Date.getFullYear();
              if (isYesterday) return true;
              if (isDayBeforeYesterday && (isShiftCrossingMidnight(r.scheduledShift) || isShiftCrossingMidnight(r.inferredShift))) return true;
              return false;
           }
        }
        return true;
    };
  }, [timeFilter, selectedDates, showRealTime]);

  const basePeriodSummaries = useMemo(() => {
    const otherShifts = shiftFilter;
    
    return mergedSummaries.map(s => {
      const records = s.dailyRecords.filter(r => {
        if (!recordTimeFilterFn(r)) return false;

        if (otherShifts.length > 0) {
            const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : (r.inferredShift ? cleanShift(r.inferredShift) : null);
            const isShiftMatch = activeShift ? otherShifts.includes(activeShift) : false;
            if (!isShiftMatch) return false;
        }

        return true;
      });

      if (showRealTime && !isAgentActiveNow(records)) return null;

      const isATTInfo = records.some(r => r.isATT) || s.isOffboarded;
      const isLOAInfo = records.some(r => r.isLOA);
      const isPTOInfo = records.some(r => r.isPTO);
      const isSLInfo = records.some(r => r.isSL);
      const isSUSPPInfo = records.some(r => r.isSUSPP);
      const isOFFInfo = records.some(r => r.isOFF);

      const isGlobalView = !showRealTime && (timeFilter === 'month' || timeFilter === 'all') && (!selectedDates || selectedDates.length === 0);

      const finalIsATT = isGlobalView ? (s.dailyRecords.some(r => r.isATT) || s.isOffboarded) : isATTInfo;
      const finalIsLOA = isGlobalView ? s.dailyRecords.some(r => r.isLOA) : isLOAInfo;
      const finalIsPTO = isGlobalView ? s.dailyRecords.some(r => r.isPTO) : isPTOInfo;
      const finalIsSL = isGlobalView ? s.dailyRecords.some(r => r.isSL) : isSLInfo;
      const finalIsSUSPP = isGlobalView ? s.dailyRecords.some(r => r.isSUSPP) : isSUSPPInfo;
      const finalIsOFF = isGlobalView ? s.dailyRecords.some(r => r.isOFF) : isOFFInfo;
      const totalAbsences = records.reduce((acc, r) => acc + (r.isAbsence && !r.isATT ? 1 : 0), 0);
      
      const activeLob = [...records].reverse().find(r => r.lob)?.lob || s.lob;

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
  }, [mergedSummaries, timeFilter, shiftFilter, selectedDates, showRealTime]);

  const periodSummaries = useMemo(() => {
    const hasCheck = includeCheckGlobal;
    const otherShifts = shiftFilter;

    return mergedSummaries.map(s => {
      const records = s.dailyRecords.filter(r => {
        if (!recordTimeFilterFn(r)) return false;

        if (shiftFilter.length > 0 || includeCheckGlobal) {
            
            const isCheckMatch = isShiftMismatch(r.scheduledShift, r.inferredShift);
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

      if (showRealTime && !isAgentActiveNow(records)) return null;

      const isATTInfo = records.some(r => r.isATT) || s.isOffboarded;
      const isLOAInfo = records.some(r => r.isLOA);
      const isPTOInfo = records.some(r => r.isPTO);
      const isSLInfo = records.some(r => r.isSL);
      const isSUSPPInfo = records.some(r => r.isSUSPP);
      const isOFFInfo = records.some(r => r.isOFF);

      const isGlobalView = !showRealTime && (timeFilter === 'month' || timeFilter === 'all') && (!selectedDates || selectedDates.length === 0);

      const finalIsATT = isGlobalView ? (s.dailyRecords.some(r => r.isATT) || s.isOffboarded) : isATTInfo;
      const finalIsLOA = isGlobalView ? s.dailyRecords.some(r => r.isLOA) : isLOAInfo;
      const finalIsPTO = isGlobalView ? s.dailyRecords.some(r => r.isPTO) : isPTOInfo;
      const finalIsSL = isGlobalView ? s.dailyRecords.some(r => r.isSL) : isSLInfo;
      const finalIsSUSPP = isGlobalView ? s.dailyRecords.some(r => r.isSUSPP) : isSUSPPInfo;
      const finalIsOFF = isGlobalView ? s.dailyRecords.some(r => r.isOFF) : isOFFInfo;
      const totalAbsences = records.reduce((acc, r) => acc + (r.isAbsence && !r.isATT ? 1 : 0), 0);
      
      const activeLob = [...records].reverse().find(r => r.lob)?.lob || s.lob;

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
  }, [mergedSummaries, timeFilter, shiftFilter, selectedDates, includeCheckGlobal, showRealTime]);

  const supportStaffSummaries = useMemo(() => {
    return supportScheduleData.map(s => {
       const records = s.dailyRecords.filter(r => {
          if (!recordTimeFilterFn(r)) return false;
          
          if (shiftFilter.length > 0) {
             const activeShift = r.scheduledShift ? cleanShift(r.scheduledShift) : null;
             const isShiftMatch = activeShift ? shiftFilter.includes(activeShift) : false;
             if (!isShiftMatch) return false;
          }
          return true;
       });

       return { ...s, dailyRecords: records };
    }).filter(s => s.dailyRecords.length > 0 || (s.dailyRecords.length === 0 && (s as any).isOFF));
  }, [supportScheduleData, recordTimeFilterFn, shiftFilter]);

  const hasMismatchesInSelection = useMemo(() => {
    return mergedSummaries.some(s => {
      const records = s.dailyRecords.filter(r => recordTimeFilterFn(r));
      if (records.length === 0) return false;
      
      // If Real Time is on, only count mismatches for agents that are currently active
      if (showRealTime && !isAgentActiveNow(records)) return false;

      return records.some(r => isShiftMismatch(r.scheduledShift, r.inferredShift));
    });
  }, [mergedSummaries, recordTimeFilterFn, showRealTime]);

  const processedSummaries = useMemo(() => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
    const todayStr = format(today, 'yyyy-MM-dd');
    const hasCheck = includeCheckGlobal;
    const otherShifts = shiftFilter;

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
        const isTardinessOnly = includeTardinessGlobal && !includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isMinorTardinessOnly = includeTardinessGlobal && includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
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
        if (!recordTimeFilterFn(r)) return false;

        if (shiftFilter.length > 0 || includeCheckGlobal) {
            const isCheckMatch = isShiftMismatch(r.scheduledShift, r.inferredShift);
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
        const isTardinessOnly = includeTardinessGlobal && !includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
        const isMinorTardinessOnly = includeTardinessGlobal && includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
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
           if ((r.tardinessMinutes || 0) < 15) return false;
        } else if (isMinorTardinessOnly) {
           if ((r.tardinessMinutes || 0) <= 0 || (r.tardinessMinutes || 0) >= 15) return false;
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
           if (includeTardinessGlobal) {
               if (includeMinorTardinessGlobal) {
                   if ((r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15) keep = true;
               } else {
                   if ((r.tardinessMinutes || 0) >= 15) keep = true;
               }
           }
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

      const totalTasks = records.length > 0 ? records.reduce((acc, r) => acc + (r.tasks || 0), 0) : 0;

      if (filterMinorOverbreaks && (totalOverbreak > 2 || totalOverbreak === 0)) return null;

      return {
        ...s,
        isOFF: showRealTime ? false : s.isOFF,
        dailyRecords: records,
        totalWorkMinutes: Math.round(totalWorkMinutes),
        totalBreakMinutes: Math.round(totalBreakMinutes),
        totalOverbreakMinutes: Math.round(totalOverbreak),
        totalTasks: totalTasks,
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
  }, [periodSummaries, timeFilter, typeFilter, shiftFilter, latestDate, selectedDates, includeWcGlobal, includeIdleGlobal, includeNonModGlobal, includeTardinessGlobal, includeMinorTardinessGlobal, includeEarlyLeaveGlobal, filterMinorOverbreaks, includeShort30MinGlobal, includeAbsencesGlobal, includeOffboardedGlobal, includeATTGlobal, includeLOAGlobal, includePTOGlobal, includeSLGlobal, includeSUSPPGlobal, includeOFFGlobal, includeCheckGlobal, showRealTime]);

  const activeAnyStatus = includeATTGlobal || includeLOAGlobal || includePTOGlobal || includeSLGlobal || includeSUSPPGlobal || includeOFFGlobal || includeOffboardedGlobal || includeAbsencesGlobal;

  const filteredSummaries = useMemo(() => {
    let base = processedSummaries;
    
    if (!activeAnyStatus) {
       base = processedSummaries.filter(s => {
          return s.dailyRecords.some(r => {
             const isPureNotWorkingStatus = r.isOFF || r.isPTO || r.isLOA || r.isSL || r.isSUSPP || r.isATT;
             if (isPureNotWorkingStatus) {
                 return r.totalWorkTimeMillis > 0 || r.totalOfflineTimeMillis > 0 || r.breaks.length > 0;
             }
             return true;
          });
       });
       if (!includeSupportStaff) {
          base = base.filter(s => !isSupportRole(s));
       } else {
          base = base.filter(s => isSupportRole(s));
       }
       return base;
    }
    
    return processedSummaries.map(s => {
       const isSupport = isSupportRole(s);
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
       if (!isSupportRole(s)) return false;

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

  const clearExtraStatuses = () => {
    setIncludeATTGlobal(false);
    setIncludeLOAGlobal(false);
    setIncludePTOGlobal(false);
    setIncludeSLGlobal(false);
    setIncludeSUSPPGlobal(false);
    setIncludeOFFGlobal(false);
    setIncludeMinorTardinessGlobal(false);
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
      loading: t('processingCalendarStatus'),
      success: ({ data, note }) => {
        setCalendarData(data);
        setIsCalendarLoading(false);
        let finalNote = getFullMonthName(note, lang);
        if (finalNote === String(note || '').toUpperCase() || finalNote === "SHEET1") {
           const fileName = file.name || '';
           const fileMonth = getFullMonthName(fileName, lang);
           if (fileMonth !== fileName.toUpperCase()) {
              finalNote = fileMonth;
           } else {
              finalNote = "OK";
           }
        }
        setCalendarNote(finalNote);
        const filteredCount = data.length;
        return `${filteredCount} ${t('agentsMapped')}`;
      },
      error: (err) => {
        console.error(err);
        setIsCalendarLoading(false);
        return t('errorProcessingCalendar');
      }
    });

    // Reset input
    event.target.value = '';
  }, []);

  const handleStaffInfoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error(t('invalidFormat'));
      return;
    }

    setIsStaffInfoLoading(true);
    
    // Simulate delay for UI responsiveness
    const delayPromise = new Promise(resolve => setTimeout(resolve, 500));
    
    // Parse
    const promise = Promise.all([parseStaffInfoFile(file), delayPromise]).then(([result]) => result);
    
    toast.promise(promise, {
      loading: "Processing Staff Info...",
      success: ({ data }) => {
        setStaffInfoData(data);
        setIsStaffInfoLoading(false);
        return `${data.length} staff entries loaded`;
      },
      error: (err) => {
        console.error(err);
        setIsStaffInfoLoading(false);
        return "Error loading Staff Info";
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
        setLastExtractTime(new Date());
        setIsLoading(false);
        return `${data.length} ${t('agentsProcessed')}`;
      },
      error: (err) => {
        console.error(err);
        setIsLoading(false);
        return t('errorProcessingFile');
      }
    });
  }, [t]);

  const handleExport = () => {
    if (filteredSummaries.length === 0) {
      toast.error(t('noDataExport'));
      return;
    }

    const sortedForExport = [...filteredSummaries].sort((a, b) => {
      if (typeFilter === 'idle_overbreak_wc') {
        return b.totalOverbreakMinutes - a.totalOverbreakMinutes;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });

    const isWcOnly = includeWcGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isIdleOnly = includeIdleGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isNonModOnly = includeNonModGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isTardinessOnly = includeTardinessGlobal && !includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isMinorTardinessOnly = includeTardinessGlobal && includeMinorTardinessGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isEarlyLeaveOnly = includeEarlyLeaveGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && typeFilter === 'all';
    const isShort30MinOnly = includeShort30MinGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isAbsencesOnly = includeAbsencesGlobal && !includeOffboardedGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';
    const isCheckOnly = includeCheckGlobal && !includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all';

    const baseNoFilters = !includeShort30MinGlobal && !includeAbsencesGlobal && !includeOffboardedGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && !includeCheckGlobal && typeFilter === 'all';
    const isATTOnly = includeATTGlobal && baseNoFilters && !includeLOAGlobal && !includePTOGlobal && !includeSLGlobal && !includeSUSPPGlobal && !includeOFFGlobal;
    const isLOAOnly = includeLOAGlobal && baseNoFilters && !includeATTGlobal && !includePTOGlobal && !includeSLGlobal && !includeSUSPPGlobal && !includeOFFGlobal;
    const isPTOOnly = includePTOGlobal && baseNoFilters && !includeATTGlobal && !includeLOAGlobal && !includeSLGlobal && !includeSUSPPGlobal && !includeOFFGlobal;
    const isSLOnly = includeSLGlobal && baseNoFilters && !includeATTGlobal && !includeLOAGlobal && !includePTOGlobal && !includeSUSPPGlobal && !includeOFFGlobal;
    const isSUSPPOnly = includeSUSPPGlobal && baseNoFilters && !includeATTGlobal && !includeLOAGlobal && !includePTOGlobal && !includeSLGlobal && !includeOFFGlobal;
    const isOFFOnly = includeOFFGlobal && baseNoFilters && !includeATTGlobal && !includeLOAGlobal && !includePTOGlobal && !includeSLGlobal && !includeSUSPPGlobal;

    const activeExtraStatus = isATTOnly ? 'ATT' : isLOAOnly ? 'LOA' : isPTOOnly ? 'PTO/VAC' : isSLOnly ? 'SL' : isSUSPPOnly ? 'SUSPP' : isOFFOnly ? 'OFF' : null;
    const attrKey = isATTOnly ? 'isATT' : isLOAOnly ? 'isLOA' : isPTOOnly ? 'isPTO' : isSLOnly ? 'isSL' : isSUSPPOnly ? 'isSUSPP' : isOFFOnly ? 'isOFF' : null;

    let periodLabel = t('allTime');
    if (timeFilter === 'month') periodLabel = t('filterMonth');
    if (timeFilter === 'week') periodLabel = t('filterWeek');
    if (timeFilter === 'yesterday') periodLabel = t('filterYesterday');
    if (timeFilter === 'day') periodLabel = t('filterDay');

    let specificFilterLabel = '';
    if (isTardinessOnly) specificFilterLabel = t('reportTardiness');
    else if (isMinorTardinessOnly) specificFilterLabel = t('reportMinorTardiness');
    else if (isEarlyLeaveOnly) specificFilterLabel = t('reportEarlyLeave');
    else if (isAbsencesOnly) specificFilterLabel = t('reportAbsences');
    else if (isWcOnly) specificFilterLabel = t('reportWcOverbreaks');
    else if (isIdleOnly) specificFilterLabel = t('reportIdleOverbreaks');
    else if (isNonModOnly) specificFilterLabel = t('reportNonModerating');
    else if (isShort30MinOnly) specificFilterLabel = t('reportShortBreak');
    else if (isCheckOnly) specificFilterLabel = t('reportScheduleMismatch');
    else if (activeExtraStatus) specificFilterLabel = `${t('reportStatusPrefix')} ${activeExtraStatus}`;
    else if (includeOffboardedGlobal && !includeAbsencesGlobal && !includeShort30MinGlobal && !includeWcGlobal && !includeIdleGlobal && !includeNonModGlobal && !includeTardinessGlobal && !includeEarlyLeaveGlobal && typeFilter === 'all') specificFilterLabel = t('reportOffboarded');

    const titleStr = specificFilterLabel 
        ? `${specificFilterLabel} ${t('reportSuffix')} - ${periodLabel}`
        : typeFilter === 'idle_overbreak_wc' 
            ? `${t('reportOverbreakViolators')} - ${periodLabel}` 
            : `${t('reportGeneral')} - ${periodLabel}`;
    
    const baseLabel = specificFilterLabel 
        ? specificFilterLabel 
        : typeFilter === 'idle_overbreak_wc' 
            ? 'Overbreaks_Outliers' 
            : 'General';
            
    let fileSuffix = `${baseLabel}_${periodLabel}`.replace(/[^A-Za-z0-9]+/g, '_');
    
    if (typeFilter === 'idle_overbreak_wc' && specificFilterLabel) {
        fileSuffix += "_only_overbreaks";
    }

    const nonSupportExport = sortedForExport.filter(s => !isSupportRole(s));
    const totalAgentsCount = periodSummaries.filter(s => !isSupportRole(s)).length;
    const affectedAgentsCount = nonSupportExport.length;

    exportToPDF(nonSupportExport, titleStr, `Report_${fileSuffix}`, {
      isTardiness: isTardinessOnly,
      isMinorTardiness: isMinorTardinessOnly,
      isEarlyLeave: isEarlyLeaveOnly,
      isAbsences: isAbsencesOnly,
      isShort30Min: isShort30MinOnly,
      isWc: isWcOnly,
      isIdle: isIdleOnly,
      isNonMod: isNonModOnly,
      isCheck: isCheckOnly,
      activeExtraStatus: activeExtraStatus,
      attrKey: attrKey,
      totalAgentsCount,
      affectedAgentsCount,
      lang: lang as 'pt' | 'en'
    });
    toast.success(t('pdfSuccess'));
  };

  const clearData = () => {
    setSummaries([]);
    toast.success(t('dataReset'));
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
              {t('processingCalendar')}
            </motion.h2>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 text-sm text-slate-400 font-medium max-w-sm text-center"
            >
              {t('mappingShiftsDesc')}
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
              <div className="flex flex-col">
                <h1 className="text-[17px] font-bold tracking-tight">Live <span className="text-blue-400">Overview</span></h1>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest -mt-1">Beta v1</span>
              </div>
            </div>
            <button 
              onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
              className="bg-slate-800 text-[9px] font-black uppercase text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors w-auto"
            >
              {lang === 'pt' ? t('switchToEnglish') : t('switchToPortuguese')}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-500 block px-2 mb-2">{t('viewMode')}</label>
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
            <button 
              onClick={() => setActiveTab('support_schedule')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'support_schedule' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Users size={16} /> Staff Schedule
            </button>
            
            <div className="my-3 border-t border-slate-800/80 mx-2"></div>
            
            <button 
              onClick={() => setActiveTab('howto')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mt-2 ${activeTab === 'howto' ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <HelpCircle size={16} className={activeTab === 'howto' ? "text-indigo-200" : ""} /> {t('howtoMenu')}
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header - Geometric Balance */}
        <header className="sticky top-0 z-[60] flex justify-between items-center py-3 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 hidden sm:block">
              {summaries.length > 0 ? (activeTab === 'howto' ? t('howtoMenu') : activeTab === 'dashboard' ? t('overview') : activeTab === 'lobs' ? t('lobsPerformance') : activeTab === 'support_schedule' ? 'Staff Schedule' : t('agents')) : ''}
            </h2>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">SC</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-2 h-8 px-3 shadow-sm cursor-pointer transition-colors relative">
                <Users size={14} className="text-purple-600" /> 
                <span className="hidden sm:inline">Upload Staff Info</span>
                {staffInfoData.length > 0 && (
                   <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-sm border border-purple-600">
                      ✓
                   </span>
                )}
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleStaffInfoUpload} />
             </label>
            {summaries.length > 0 && (
              <div className="relative">
                <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-2 h-8 px-3 shadow-sm cursor-pointer transition-colors relative">
                   <Upload size={14} className="text-emerald-600" /> 
                   <span className="hidden sm:inline">{summaries.length > 0 ? t('updateExtract') : t('addExtract')}</span>
                   <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                </label>
                {lastExtractTime && (
                  <span className="absolute top-8 left-0 text-[9px] text-slate-400 whitespace-nowrap">
                    {t('lastUpdate')}{format(lastExtractTime, 'HH:mm:ss')}
                  </span>
                )}
              </div>
            )}
            {summaries.length > 0 && (
              <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-2 h-8 px-3 shadow-sm cursor-pointer transition-colors relative">
                 <CalendarIcon size={14} className="text-blue-600" /> 
                 <span className="hidden sm:inline">{calendarData.length > 0 ? t('updateCalendar') : t('addCalendar')}</span>
                 {calendarData.length > 0 && calendarNote && (
                    <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-sm border border-indigo-600">
                       {calendarNote}
                    </span>
                 )}
                 <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleCalendarUpload} />
              </label>
            )}
            {summaries.length > 0 && (
              <div className="flex items-center gap-2">
                <Button onClick={handleExport} className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 h-8 px-4 shadow-sm shadow-slate-200">
                  <FileDown size={14} /> <span className="hidden sm:inline">{t('exportPdf')}</span>
                </Button>
              </div>
            )}
                <div className="flex lg:hidden gap-1 bg-white border border-slate-200 rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('dashboard')} className={`h-8 w-8 p-0 ${activeTab === 'dashboard' ? 'bg-slate-100' : ''}`}>
                    <LayoutDashboard size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('list')} className={`h-8 w-8 p-0 ${activeTab === 'list' ? 'bg-slate-100' : ''}`}>
                    <ListFilter size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('lobs')} className={`h-8 w-8 p-0 ${activeTab === 'lobs' ? 'bg-slate-100' : ''}`}>
                    <Target size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('support_schedule')} className={`h-8 w-8 p-0 ${activeTab === 'support_schedule' ? 'bg-slate-100' : ''}`}>
                    <Users size={14} />
                  </Button>
                  <div className="w-px bg-slate-200 mx-0.5"></div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('howto')} className={`h-8 w-8 p-0 ${activeTab === 'howto' ? 'bg-indigo-50 text-indigo-600' : ''}`}>
                    <HelpCircle size={14} />
                  </Button>
                </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 flex flex-col overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {summaries.length === 0 ? (
              activeTab === 'howto' ? (
                <HowTo />
              ) : (
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
                  <label className="relative group flex flex-col items-center justify-center w-full sm:w-1/2 h-80 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white hover:bg-slate-50 hover:border-green-400 transition-all cursor-pointer overflow-hidden shadow-xl shadow-slate-200/50 p-6">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-6 z-10 text-center">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl group-hover:bg-green-600 transition-colors shadow-lg">
                        <CalendarIcon size={32} />
                      </div>
                      <div>
                        <p className="mb-1 text-2xl font-bold text-slate-800">{t('homeCalendarTitle')}</p>
                        <p className="text-slate-500 font-medium text-[13px] leading-tight" dangerouslySetInnerHTML={{ __html: t('homeCalendarDesc') }}></p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleCalendarUpload} />
                  </label>

                  <label className="relative group flex flex-col items-center justify-center w-full sm:w-1/2 h-80 border-2 border-dashed border-slate-300 rounded-[2.5rem] bg-white hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer overflow-hidden shadow-2xl shadow-slate-200/50 p-6">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-6 z-10 text-center">
                      <div className="p-5 bg-slate-900 text-white rounded-2xl group-hover:bg-blue-600 transition-colors shadow-lg">
                        <Upload size={32} />
                      </div>
                      <div>
                        <p className="mb-1 text-2xl font-bold text-slate-800">{t('homeExtractTitle')}</p>
                        <p className="text-slate-500 font-medium text-[13px] leading-tight" dangerouslySetInnerHTML={{ __html: t('homeExtractDesc') }}></p>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                  </label>
                </div>
                
                <div className="mt-4 text-sm text-amber-600 bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                  {t('homeRetroactiveNote')}
                </div>
              </motion.div>
              )
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col overflow-hidden space-y-0 min-h-0"
              >
                {activeTab !== 'howto' && activeTab !== 'support_schedule' && (
                  <div className="shrink-0 z-[50] bg-slate-50/95 backdrop-blur-md border-b border-slate-200 pb-4 pt-4 sm:pt-6 px-4 sm:px-6 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-8 shadow-sm">
                    <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 items-start">
                      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-none">{t('realtimeMetrics')}</h3>
                      <button 
                         onClick={() => {
                           const nextValue = !showRealTime;
                           setShowRealTime(nextValue);
                           if (nextValue) {
                               setTimeFilter('all');
                               setSelectedDates(undefined);
                           }
                         }}
                         className={`px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1 min-w-max shadow-sm w-fit ${showRealTime ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                       >
                         <div className={`w-2 h-2 rounded-full ${showRealTime ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                         {t('realTime')}
                       </button>
                       <button 
                         onClick={() => setIsStaffInChargeOpen(true)}
                         className="px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm w-fit mt-1"
                       >
                         <Users size={12} className="text-blue-500" />
                         Staff now
                       </button>
                       {missingStaffNames.length > 0 && (
                         <button 
                           onClick={() => setIsMissingStaffOpen(true)}
                           className="px-2 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1 bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 shadow-sm w-fit mt-1"
                         >
                           <UserX size={12} className="text-amber-500" />
                           Missing in Schedule ({missingStaffNames.length})
                         </button>
                       )}
                    </div>
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between w-full mt-2">
                      <p className="text-2xl font-black text-slate-900 hidden sm:block whitespace-nowrap">{t('auditResults')}</p>
                      <div className="flex flex-col items-end gap-2 w-full">
                        {/* Top Filter Row: Shift Select */}
                        <div className="flex gap-1 items-center overflow-x-auto w-full sm:w-auto">
                           <div className="flex gap-1 items-center bg-white border border-slate-200 p-1 rounded-xl shadow-sm min-w-max">
                             <span className="text-[9px] font-black uppercase text-slate-400 px-2">{t('shift')}:</span>
                             <button 
                                onClick={() => {
                                   setShowRealTime(false);
                                   setShiftFilter([]);
                                }}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${shiftFilter.length === 0 ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                              >
                                {t('all')}
                             </button>
                          {availableShifts.map(shift => (
                             <button 
                               key={shift}
                               onClick={() => {
                                 setShowRealTime(false);
                                 if (shiftFilter.includes(shift)) {
                                   setShiftFilter(shiftFilter.filter(s => s !== shift));
                                 } else {
                                   setShiftFilter([...shiftFilter, shift]);
                                 }
                               }}
                               className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${shiftFilter.includes(shift) ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                             >
                               {shift}
                             </button>
                          ))}

                           </div>
                         </div>

                        {/* Bottom Filter Row: Calendars and Options */}
                        <div className="flex gap-2 flex-wrap justify-end w-full">
                          <div className="flex gap-1 items-center bg-white border border-slate-200 p-1 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto">
                            <span className="text-[9px] font-black uppercase text-slate-400 px-2">{t('period')}:</span>
                            <Popover>
                              <PopoverTrigger
                                   className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${(!showRealTime && selectedDates && selectedDates.length > 0) ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                 >
                                   <CalendarIcon size={12} />
                                   {t('calendar')} {selectedDates && selectedDates.length > 0 ? `(${selectedDates.length})` : ''}
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                  <div className="p-2 border-b border-slate-100 flex justify-between gap-2 bg-slate-50">
                                     <Button 
                                       variant="outline" 
                                       size="sm" 
                                       className="text-[9px] font-bold uppercase h-7 px-2 border-slate-200 rounded-full"
                                       onClick={() => {
                                          setShowRealTime(false);
                                          const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
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
                                       className="text-[9px] font-bold uppercase h-7 px-2 border-slate-200 rounded-full"
                                       onClick={() => {
                                          setShowRealTime(false);
                                          const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
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
                                       className="text-[9px] font-bold uppercase h-7 px-2 text-rose-500 hover:text-rose-600 rounded-full"
                                       onClick={() => setSelectedDates(undefined)}
                                     >
                                       {t('clearBtn')}
                                     </Button>
                                  </div>
                                  <CustomCalendar
                                      summaries={summaries}
                                      selectedDates={selectedDates}
                                      onSelectDates={(dates) => {
                                          setShowRealTime(false);
                                          setSelectedDates(dates);
                                          if (dates && dates.length > 0) setTimeFilter('all');
                                      }}
                                  />
                              </PopoverContent>
                            </Popover>
                            {(['month', 'prev_month', 'week', 'yesterday', 'day'] as const)
                               .filter(filter => availableFilters.includes(filter))
                               .map(filter => (
                               <button 
                                 key={filter}
                                 onClick={() => {
                                     setShowRealTime(false);
                                     if (timeFilter === filter) {
                                         setTimeFilter('all');
                                     } else {
                                         setTimeFilter(filter);
                                         setSelectedDates(undefined);
                                     }
                                 }}
                                 className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${(!showRealTime && timeFilter === filter && (!selectedDates || selectedDates.length === 0)) ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                               >
                                 {filter === 'month' ? t('filterMonth') : filter === 'prev_month' ? t('filterPrevMonth') : filter === 'week' ? t('filterWeek') : filter === 'yesterday' ? t('filterYesterday') : t('filterDay')}
                               </button>
                            ))}
                          </div>
                          
                          <div className="flex gap-1 items-center bg-white border border-slate-200 p-1 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto">
                             <span className="text-[9px] font-black uppercase text-slate-400 px-2 shrink-0">Status:</span>
                             <button 
                               onClick={() => { setTypeFilter(typeFilter === 'all' ? 'idle_overbreak_wc' : 'all'); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${typeFilter === 'idle_overbreak_wc' ? 'bg-rose-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {String(t('overbreaks') || '').toUpperCase()}
                             </button>
                             <button
                               onClick={() => { setIncludeShort30MinGlobal(!includeShort30MinGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${includeShort30MinGlobal ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'}`}
                             >
                               {t('short30Min')}
                             </button>
                             <button
                               onClick={() => { setIncludeWcGlobal(!includeWcGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeWcGlobal ? 'bg-amber-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               Organic
                             </button>
                             <button
                               onClick={() => { setIncludeIdleGlobal(!includeIdleGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeIdleGlobal ? 'bg-rose-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               IDLE
                             </button>
                             <button
                               onClick={() => { setIncludeNonModGlobal(!includeNonModGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeNonModGlobal ? 'bg-teal-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               NON-MOD
                             </button>
                             <button
                               onClick={() => { setIncludeTardinessGlobal(!includeTardinessGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeTardinessGlobal ? 'bg-orange-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               TARDINESS
                             </button>
                             <button
                               onClick={() => { setIncludeEarlyLeaveGlobal(!includeEarlyLeaveGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeEarlyLeaveGlobal ? 'bg-orange-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               EARLY LEAVE
                             </button>
                             <button
                               onClick={() => { setIncludeAbsencesGlobal(!includeAbsencesGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap overflow-hidden relative flex items-center gap-2 ${includeAbsencesGlobal ? 'bg-red-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               <span className="relative z-10 hidden sm:inline">{t('absences')}</span>
                               <span className="relative z-10 sm:hidden">{t('absences')}</span>
                               
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
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap overflow-hidden relative flex items-center gap-2 ${includeOffboardedGlobal ? 'bg-slate-700 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                                <span className="relative z-10 hidden sm:inline">{t('offboarded')}</span>
                                <span className="relative z-10 sm:hidden">{t('offboarded')}</span>
                                <span className="hidden">
                                  {summaries.filter(s => s.isOffboarded).length}
                                </span>
                             </button>
                             <button
                               onClick={() => { setIncludeCheckGlobal(!includeCheckGlobal); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeCheckGlobal ? 'bg-amber-500 text-white shadow-md' : (hasMismatchesInSelection ? 'bg-amber-100 text-amber-700 animate-pulse border border-amber-300' : 'bg-transparent text-slate-500 hover:bg-slate-100')}`}
                             >
                               {t('check')}
                             </button>
                             <button
                               onClick={() => { setFilterMinorOverbreaks(!filterMinorOverbreaks); clearExtraStatuses(); }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filterMinorOverbreaks ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                               title="Mostra apenas agentes com total de 2 minutos ou menos"
                             >
                               2min or less
                             </button>
                           </div>
                           
                           <div className="flex gap-1 items-center bg-white border border-slate-200 p-1 rounded-[2rem] shadow-sm overflow-x-auto w-full sm:w-auto mt-1">
                             <span className="text-[9px] font-black uppercase text-slate-400 px-2 shrink-0">{t('additionalStatus')}:</span>
                             <AnimatePresence>
                               {includeTardinessGlobal && (
                                 <motion.button
                                   initial={{ opacity: 0, scale: 0.8 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   exit={{ opacity: 0, scale: 0.8 }}
                                   onClick={() => setIncludeMinorTardinessGlobal(!includeMinorTardinessGlobal)}
                                   className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeMinorTardinessGlobal ? 'bg-orange-600 text-white shadow-md' : 'bg-transparent animate-pulse text-orange-500 border border-orange-300 hover:bg-orange-50'}`}
                                 >
                                   &lt; 15min
                                 </motion.button>
                               )}
                             </AnimatePresence>
                             <button
                               onClick={() => {
                                 setIncludeATTGlobal(!includeATTGlobal);
                                 clearNormalStatuses();
                                 if (!includeATTGlobal) { setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeATTGlobal ? 'bg-slate-800 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusAtt')}
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeLOAGlobal(!includeLOAGlobal);
                                 clearNormalStatuses();
                                 if (!includeLOAGlobal) { setIncludeATTGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeLOAGlobal ? 'bg-indigo-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusLoa')}
                             </button>
                             <button
                               onClick={() => {
                                 setIncludePTOGlobal(!includePTOGlobal);
                                 clearNormalStatuses();
                                 if (!includePTOGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includePTOGlobal ? 'bg-cyan-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusPto')}
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeSLGlobal(!includeSLGlobal);
                                 clearNormalStatuses();
                                 if (!includeSLGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSUSPPGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeSLGlobal ? 'bg-rose-400 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusSl')}
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeSUSPPGlobal(!includeSUSPPGlobal);
                                 clearNormalStatuses();
                                 if (!includeSUSPPGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeOFFGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeSUSPPGlobal ? 'bg-red-700 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusSuspp')}
                             </button>
                             <button
                               onClick={() => {
                                 setIncludeOFFGlobal(!includeOFFGlobal);
                                 clearNormalStatuses();
                                 if (!includeOFFGlobal) { setIncludeATTGlobal(false); setIncludeLOAGlobal(false); setIncludePTOGlobal(false); setIncludeSLGlobal(false); setIncludeSUSPPGlobal(false); }
                               }}
                               className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${includeOFFGlobal ? 'bg-slate-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
                             >
                               {t('statusOff')}
                             </button>
                             
                             <AnimatePresence>
                               {activeAnyStatus && hasSupportStaffWithStatus && (
                                 <motion.button
                                   initial={{ opacity: 0, scale: 0.8 }}
                                   animate={{ opacity: 1, scale: 1 }}
                                   exit={{ opacity: 0, scale: 0.8 }}
                                   onClick={() => setIncludeSupportStaff(!includeSupportStaff)}
                                   className={`px-2 py-1 w-full sm:w-auto rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap relative flex items-center gap-2 ${includeSupportStaff ? 'bg-fuchsia-600 text-white shadow-md' : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 hover:bg-fuchsia-100 shadow-[0_0_12px_rgba(192,38,211,0.5)] animate-pulse'}`}
                                 >
                                   {t('supportStaff')}
                                 </motion.button>
                               )}
                             </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                <div className={`flex-1 relative flex flex-col pb-20 min-h-0 ${activeTab !== 'list' ? 'overflow-y-auto w-full custom-scrollbar pt-8' : 'pt-4'}`}>
                  {activeTab === 'dashboard' ? (
                    <StatsDashboard 
                      summaries={filteredSummaries} 
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
                      showRealTime={showRealTime}
                    />
                  ) : activeTab === 'lobs' ? (
                    <LOBAnalytics summaries={filteredSummaries} showRealTime={showRealTime} />
                  ) : activeTab === 'support_schedule' ? (
                    <SupportSchedule summaries={supportScheduleData} allSummaries={mergedSummaries} />
                  ) : activeTab === 'howto' ? (
                    <HowTo />
                  ) : (
                    <EmployeeList availableFilters={availableFilters} summaries={filteredSummaries} allSummaries={mergedSummaries} latestDate={latestDate} initialFilter={timeFilter} globalTypeFilter={typeFilter} globalIncludeWc={includeWcGlobal} globalIncludeIdle={includeIdleGlobal} globalIncludeNonMod={includeNonModGlobal} globalIncludeTardiness={includeTardinessGlobal} globalIncludeEarlyLeave={includeEarlyLeaveGlobal} globalIncludeShort30Min={includeShort30MinGlobal} globalIncludeCheck={includeCheckGlobal} globalShiftFilter={shiftFilter} globalFilterMajorOverbreaks={false} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Summary Banner */}
          <AnimatePresence>
            {filteredSummaries.length > 0 && !isLoading && !isCalendarLoading && activeTab !== 'support_schedule' && activeTab !== 'lobs' && (
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 px-5 py-2 rounded-full shadow-2xl shadow-indigo-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col border-r border-slate-700 pr-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('agents')}</span>
                    <span className="text-sm font-black text-white">{filteredSummaries.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('totalOverbreak')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-rose-400">
                        {Math.floor(dashboardStats.totalOverbreakMinutes / 60)}h {dashboardStats.totalOverbreakMinutes % 60}m
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col border-l border-slate-700 pl-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{t('avgOverbreak')}</span>
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
      <Dialog open={isStaffInChargeOpen} onOpenChange={setIsStaffInChargeOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <Users className="text-blue-600" />
              Support Staff in Charge
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Team members currently scheduled or working right now.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            {(() => {
              const activeStaff = supportScheduleData.filter(s => isAgentActiveNow(s.dailyRecords, false));
              if (activeStaff.length === 0) {
                 return (
                   <div className="py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                     <UserX className="mx-auto text-slate-300 mb-2" size={40} />
                     <p className="text-slate-500 font-bold tracking-tight">No support staff active at this moment.</p>
                   </div>
                 );
              }

              const getLobColorClassesStaff = (lob: string) => {
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

              const tlResponsibilities: Record<string, Record<string, Set<string>>> = {};
              mergedSummaries.forEach(agent => {
                if (agent.supervisor && agent.lob !== 'Stranded Resource') {
                  const tlName = agent.supervisor;
                  if (!tlResponsibilities[tlName]) {
                    tlResponsibilities[tlName] = {};
                  }
                  if (agent.lob) {
                     if (!tlResponsibilities[tlName][agent.lob]) {
                         tlResponsibilities[tlName][agent.lob] = new Set<string>();
                     }
                     if (agent.language && agent.language.toUpperCase() !== 'ALL') {
                         tlResponsibilities[tlName][agent.lob].add(agent.language);
                     }
                  }
                }
              });

              // Fallback for TLs without agents correctly parsed
              mergedSummaries.forEach(s => {
                 if (s.role && s.role.toUpperCase() === 'TL') {
                     if (!tlResponsibilities[s.employeeName]) {
                        tlResponsibilities[s.employeeName] = {};
                     }
                     if (s.lob && s.lob.toUpperCase() !== 'OS' && s.lob !== 'Stranded Resource') {
                         if (!tlResponsibilities[s.employeeName][s.lob]) {
                             tlResponsibilities[s.employeeName][s.lob] = new Set<string>();
                         }
                         if (s.language && s.language.toUpperCase() !== 'ALL') {
                             tlResponsibilities[s.employeeName][s.lob].add(s.language);
                         }
                     }
                 }
              });

              const groupedStaff = activeStaff.reduce((acc, s) => {
                const category = (s.role && !['OS', 'CSR', 'AGENT', 'OPERATIONAL SUPPORT'].includes(s.role.toUpperCase())) 
                                  ? s.role 
                                  : ((s.lob && !['OS', 'OPERATIONAL SUPPORT'].includes(s.lob.toUpperCase())) ? s.lob : 'Other Support');
                if (!acc[category]) acc[category] = [];
                acc[category].push(s);
                return acc;
              }, {} as Record<string, EmployeeSummary[]>);

              return (
                 <div className="space-y-6">
                   {Object.entries(groupedStaff).map(([category, st]) => (
                     <div key={category} className="space-y-3">
                       <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-2">{category}</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {(st as EmployeeSummary[]).map(s => {
                            const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
                            const todayStr = format(now, 'yyyy-MM-dd');
                            const record = s.dailyRecords.find(r => r.date === todayStr);
                            return (
                              <div key={s.employeeName} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-slate-900 truncate">{s.employeeName}</span>
                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    {s.role && !['OS', 'CSR', 'AGENT', 'OPERATIONAL SUPPORT'].includes(s.role.toUpperCase()) && (
                                      <span className="text-[9px] font-black uppercase text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 truncate">
                                        {s.role}
                                      </span>
                                    )}
                                    {(() => {
                                       const resArr = tlResponsibilities[s.employeeName];
                                       const hideLanguage = s.role && ['RTA', 'REAL TIME', 'TRAINER', 'WFM'].some(r => s.role!.toUpperCase().includes(r));
                                       
                                       if (resArr && Object.keys(resArr).length > 0) {
                                          return Object.keys(resArr).sort().map(lob => {
                                             const langs = Array.from(resArr[lob]).sort();
                                             const comb = langs.length > 0 ? `${lob} | ${langs.join('-')}` : lob;
                                             const colorClass = getLobColorClassesStaff(lob);
                                             return (
                                                 <span key={comb} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border truncate ${colorClass}`}>
                                                     {comb}
                                                 </span>
                                             );
                                          });
                                       }
                                       return (
                                          <>
                                            {s.lob && !['OS', 'OPERATIONAL SUPPORT'].includes(s.lob.toUpperCase()) && (
                                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border truncate ${getLobColorClassesStaff(s.lob)}`}>
                                                {s.lob}
                                              </span>
                                            )}
                                            {s.language && s.language.toUpperCase() !== 'ALL' && !hideLanguage && (
                                              <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 truncate">
                                                {s.language}
                                              </span>
                                            )}
                                          </>
                                       );
                                    })()}
                                    {record?.scheduledShift && (
                                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                        {record.scheduledShift}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                         })}
                       </div>
                     </div>
                   ))}
                 </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isMissingStaffOpen} onOpenChange={setIsMissingStaffOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <UserX className="text-amber-600" />
              Missing in Schedule
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Agents present in Staff Info but not found in the uploaded Schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
             {missingStaffNames.length === 0 ? (
                 <div className="py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                     <p className="text-slate-500 font-bold tracking-tight">All Staff Info agents were found in the schedule.</p>
                 </div>
             ) : (
                <div className="grid grid-cols-1 gap-3">
                   {missingStaffNames.map((name, index) => (
                      <div key={`${name}-${index}`} className="flex flex-col p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <span className="font-bold text-slate-900">{name}</span>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

