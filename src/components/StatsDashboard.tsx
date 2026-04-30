import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { EmployeeSummary, BreakSession } from '../types';
import { AlertCircle, Users, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';

interface StatsDashboardProps {
  summaries: EmployeeSummary[];
  allSummaries: EmployeeSummary[];
  periodSummaries?: EmployeeSummary[];
  latestDate?: Date;
  globalTypeFilter: 'all' | 'idle_overbreak_wc';
  globalIncludeWc: boolean;
  globalIncludeIdle: boolean;
  globalIncludeNonMod: boolean;
  globalIncludeTardiness: boolean;
  globalIncludeEarlyLeave: boolean;
  globalIncludeShort30Min?: boolean;
  globalIncludeCheck?: boolean;
  globalFilterMajorOverbreaks: boolean;
  globalShiftFilter?: string[];
  basePeriodCount?: number;
}

export function StatsDashboard({ summaries, allSummaries, periodSummaries = [], latestDate, globalTypeFilter, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalIncludeTardiness, globalIncludeEarlyLeave, globalIncludeShort30Min, globalIncludeCheck, globalFilterMajorOverbreaks, globalShiftFilter = [], basePeriodCount }: StatsDashboardProps) {
  const { t } = useLanguage();
  
  const isWcOnly = globalIncludeWc && !globalIncludeShort30Min && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && !globalIncludeCheck && globalTypeFilter === 'all';
  const isIdleOnly = globalIncludeIdle && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && !globalIncludeCheck && globalTypeFilter === 'all';
  const isNonModOnly = globalIncludeNonMod && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave && !globalIncludeCheck && globalTypeFilter === 'all';
  const isTardinessOnly = globalIncludeTardiness && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeEarlyLeave && !globalIncludeCheck && globalTypeFilter === 'all';
  const isEarlyLeaveOnly = globalIncludeEarlyLeave && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeCheck && globalTypeFilter === 'all';
  const isShort30MinOnly = globalIncludeShort30Min && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && !globalIncludeCheck && globalTypeFilter === 'all';
  const isCheckOnly = (globalIncludeCheck && !globalIncludeShort30Min && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all') || (globalShiftFilter.length === 1 && globalShiftFilter[0] === 'CHECK');

  const hasCheckFilter = globalShiftFilter.includes('CHECK') || !!globalIncludeCheck;
  const specificShifts = globalShiftFilter.filter(s => s !== 'CHECK');
  const isCheckAndShift = hasCheckFilter && specificShifts.length > 0;

  const cleanShift = (shift: string) => {
    const match = shift.match(/\b(\d{2}:\d{2}-\d{2}:\d{2})\b/);
    return match ? match[1] : shift;
  };

  const agentsDoPeriodoCount = isCheckAndShift ? periodSummaries.filter(s => s.dailyRecords.some(r => r.scheduledShift && specificShifts.includes(cleanShift(r.scheduledShift)))).length : 0;
  
  const agentsNoPeriodoCount = isCheckAndShift ? periodSummaries.filter(s => s.dailyRecords.some(r => r.inferredShift && specificShifts.includes(cleanShift(r.inferredShift)))).length : 0;

  const agentsDeOutroPeriodoCount = isCheckAndShift ? periodSummaries.filter(s => s.dailyRecords.some(r => r.inferredShift && specificShifts.includes(cleanShift(r.inferredShift)) && r.scheduledShift && !specificShifts.includes(cleanShift(r.scheduledShift)))).length : 0;

  const [detailsSortMode, setDetailsSortMode] = useState<'duration' | 'date'>('duration');

  const dashboardSummaries = useMemo(() => {
    return summaries.map(s => {
      const newRecords = s.dailyRecords.map(r => {
        const allowedBreaks = r.breaks;
        
        let wcDur = 0, idleDur = 0, mealDur = 0, shortDur = 0, wellnessDur = 0, prayingDur = 0, meetingDur = 0, modDur = 0, nonModDur = 0;
        
        allowedBreaks.forEach(b => {
           if (b.type === 'wc') { wcDur += b.durationMinutes; }
           else if (b.type === 'idle') { idleDur += b.durationMinutes; }
           else if (b.type === 'meal') { mealDur += b.durationMinutes; }
           else if (b.type === 'short') { shortDur += b.durationMinutes; }
           else if (b.type === 'wellness') { wellnessDur += b.durationMinutes; }
           else if (b.type === 'praying') { prayingDur += b.durationMinutes; }
           else if (b.type === 'meeting') { meetingDur += b.durationMinutes; }
           else if (b.type === 'moderating') { modDur += b.durationMinutes; }
           else if (b.type === 'non_moderating') { nonModDur += b.durationMinutes; }
        });

        let wcOver = Math.max(0, wcDur - 10);
        let mealOver = Math.max(0, mealDur - 60);
        let shortOver = Math.max(0, shortDur - 30);
        let wellnessOver = Math.max(0, wellnessDur - 15);
        let prayingOver = Math.max(0, prayingDur - 15);
        let idleOver = idleDur;

        if (globalFilterMajorOverbreaks) {
            if (mealOver <= 2) mealOver = 0;
            if (shortOver <= 2) shortOver = 0;
            if (idleOver <= 2) idleOver = 0;
        }

        const isWcOnly = globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
        const isIdleOnly = globalIncludeIdle && !globalIncludeWc && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
        const isOverbreakOnly = globalTypeFilter === 'idle_overbreak_wc' && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && !globalIncludeEarlyLeave;
        const isNonModOnlyCalc = globalIncludeNonMod && !globalIncludeWc && !globalIncludeIdle && !globalIncludeTardiness && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
        const isTardinessOnlyCalc = globalIncludeTardiness && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeEarlyLeave && globalTypeFilter === 'all';
        const isEarlyLeaveOnlyCalc = globalIncludeEarlyLeave && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness && globalTypeFilter === 'all';

        let dailyOverbreak = 0;
        if (isNonModOnlyCalc) {
          dailyOverbreak = nonModDur;
        } else if (isWcOnly) {
          dailyOverbreak = wcOver;
        } else if (isIdleOnly) {
          dailyOverbreak = idleOver;
        } else if (isTardinessOnlyCalc) {
          dailyOverbreak = r.tardinessMinutes || 0;
        } else if (isEarlyLeaveOnlyCalc) {
          dailyOverbreak = r.earlyLeaveMinutes || 0;
        } else if (isOverbreakOnly) {
          dailyOverbreak = mealOver + shortOver + wellnessOver + prayingOver;
        } else {
          // Combined or Default
          dailyOverbreak = mealOver + shortOver + wellnessOver + prayingOver;
          if (globalIncludeWc) dailyOverbreak += wcOver;
          if (globalIncludeIdle) dailyOverbreak += idleOver;
          if (globalIncludeTardiness) dailyOverbreak += (r.tardinessMinutes || 0);
        }

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
          totalOverbreak: dailyOverbreak
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
  }, [summaries, globalFilterMajorOverbreaks, globalIncludeWc, globalIncludeIdle, globalIncludeNonMod, globalTypeFilter]);

  const filteredSummaries = dashboardSummaries;

  // Use periodSummaries size if it has elements (meaning filters applied)
  // or fall back to allSummaries length
  const totalEmployees = basePeriodCount !== undefined ? (basePeriodCount > 0 ? basePeriodCount : allSummaries.length) : (periodSummaries.length > 0 ? periodSummaries.length : allSummaries.length); 
  
  let affectedCount = 0;
  let affectedText = '';

  if (isCheckOnly) {
      affectedCount = filteredSummaries.length;
      affectedText = "Fora do Horário Programado";
  } else if (isNonModOnly) {
      affectedCount = filteredSummaries.filter(s => s.dailyRecords.some(r => r.breaks.some(b => b.type === 'non_moderating'))).length;
      affectedText = "Em Non-Moderating";
  } else if (isWcOnly) {
      affectedCount = filteredSummaries.filter(s => s.wcAlerts > 0).length;
      affectedText = "Em Excesso de Organic";
  } else if (isIdleOnly) {
      affectedCount = filteredSummaries.filter(s => s.idleAlerts > 0).length;
      affectedText = "Com Ociosidade";
  } else if (isTardinessOnly) {
      affectedCount = filteredSummaries.filter(s => s.dailyRecords.some(r => (r.tardinessMinutes || 0) > 0)).length;
      affectedText = "Chegaram Atrasados";
  } else if (isShort30MinOnly) {
      affectedCount = filteredSummaries.filter(s => (s.totalShort30MinRecords || 0) > 0).length;
      affectedText = "Com apenas 1 break diário";
  } else if (isEarlyLeaveOnly) {
      affectedCount = filteredSummaries.filter(s => s.dailyRecords.some(r => (r.earlyLeaveMinutes || 0) > 0)).length;
      affectedText = "Pausaram Cedo (Early Leave)";
  } else if (globalTypeFilter === 'idle_overbreak_wc') {
      affectedCount = filteredSummaries.filter(s => s.totalOverbreakMinutes > 0 || (globalIncludeWc && s.wcAlerts > 0) || (globalIncludeIdle && s.idleAlerts > 0) || (globalIncludeTardiness && s.dailyRecords.some(r => (r.tardinessMinutes || 0) > 0)) || (globalIncludeEarlyLeave && s.dailyRecords.some(r => (r.earlyLeaveMinutes || 0) > 0))).length;
      affectedText = "COM OVERBREAK";
  } else {
      affectedCount = filteredSummaries.filter(s => s.totalOverbreakMinutes > 0 || (globalIncludeWc && s.wcAlerts > 0) || (globalIncludeIdle && s.idleAlerts > 0) || (globalIncludeTardiness && s.dailyRecords.some(r => (r.tardinessMinutes || 0) > 0)) || (globalIncludeEarlyLeave && s.dailyRecords.some(r => (r.earlyLeaveMinutes || 0) > 0))).length;
      affectedText = "COM OVERBREAK (Geral)";
  }

  const isDefaultNoFilters = globalTypeFilter === 'all' && !globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && !globalIncludeTardiness;

  const isWcApplicable = (isDefaultNoFilters || globalIncludeWc) && !isCheckOnly;
  const isIdleApplicable = (isDefaultNoFilters || globalIncludeIdle) && !isCheckOnly;

  const totalOverbreak = filteredSummaries.reduce((acc, curr) => acc + curr.totalOverbreakMinutes, 0);
  const distinctDaysInPeriod = useMemo(() => {
     const days = new Set<string>();
     filteredSummaries.forEach(s => s.dailyRecords.forEach(r => days.add(r.date)));
     return days.size;
  }, [filteredSummaries]);

  const avgAgentsMismatched = useMemo(() => {
     if (distinctDaysInPeriod === 0) return 0;
     let totalMismatches = 0;
     filteredSummaries.forEach(s => {
        totalMismatches += s.dailyRecords.filter(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()).length;
     });
     return Math.round(totalMismatches / distinctDaysInPeriod);
  }, [filteredSummaries, distinctDaysInPeriod]);
  const totalDays = filteredSummaries.reduce((acc, curr) => acc + curr.dailyRecords.length, 0);
  const totalWcMinutes = filteredSummaries.reduce((acc, curr) => 
    acc + curr.dailyRecords.reduce((a, r) => a + r.wcDuration, 0)
  , 0);
  const totalIdleMinutes = filteredSummaries.reduce((acc, curr) => 
    acc + curr.dailyRecords.reduce((a, r) => a + r.idleDuration, 0)
  , 0);
  const totalWcAgents = filteredSummaries.filter(s => s.dailyRecords.some(r => r.wcDuration > 0)).length;
  const totalIdleAgents = filteredSummaries.filter(s => s.idleAlerts > 0).length;

  const isOnlyOrganic = isWcOnly;
  const isOnlyIdle = isIdleOnly;
  const isOnlyTardiness = isTardinessOnly || isEarlyLeaveOnly;

  let sumDailyAverages = 0;
  let validAgentsCount = 0;
  let agentDailyAverages: number[] = [];

  filteredSummaries.forEach(s => {
    const daysWorked = s.dailyRecords.length;
    if (daysWorked > 0) {
      let metricTotal = 0;
      if (isCheckOnly) {
          metricTotal = s.dailyRecords.filter(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()).length;
      } else if (isOnlyOrganic) {
          metricTotal = s.dailyRecords.reduce((acc, r) => acc + (r.wcDuration || 0), 0);
      } else if (isOnlyIdle) {
          metricTotal = s.dailyRecords.reduce((acc, r) => acc + (r.idleDuration || 0), 0);
      } else if (isOnlyTardiness) {
          metricTotal = s.dailyRecords.reduce((acc, r) => acc + (r.tardinessMinutes || 0), 0);
      } else {
          metricTotal = s.totalOverbreakMinutes;
      }
      
      const dailyAvg = metricTotal / daysWorked;
      sumDailyAverages += dailyAvg;
      validAgentsCount++;
      agentDailyAverages.push(dailyAvg);
    }
  });

  const avgDailyMetric = validAgentsCount ? (sumDailyAverages / validAgentsCount) : 0;
  
  let avgDailyWithoutTop5 = 0;
  if (agentDailyAverages.length > 5) {
      const sortedAverages = [...agentDailyAverages].sort((a, b) => b - a);
      const withoutTop5 = sortedAverages.slice(5);
      const sumWithoutTop5 = withoutTop5.reduce((acc, curr) => acc + curr, 0);
      avgDailyWithoutTop5 = sumWithoutTop5 / withoutTop5.length;
  } else {
      avgDailyWithoutTop5 = avgDailyMetric;
  }

  const averageTotalOverbreak = Math.round(avgDailyMetric);
  const averageWithoutTop5 = Math.round(avgDailyWithoutTop5);

  const shiftStats = useMemo(() => {
    const stats: Record<string, { minutes: number, occurrences: number }> = {};
    filteredSummaries.forEach(s => {
      const recordedShiftsForAgent = new Set<string>();
      
      s.dailyRecords.forEach(r => {
        if (!r.inferredShift && !r.scheduledShift) return;
        let shiftToUse = r.inferredShift || '';
        if (isCheckOnly) {
           shiftToUse = r.scheduledShift || shiftToUse;
        }
        if (!shiftToUse) return;
        const match = shiftToUse.match(/\b(\d{2}:\d{2}-\d{2}:\d{2})\b/);
        const shiftLabel = match ? match[1] : shiftToUse;
        if (!stats[shiftLabel]) stats[shiftLabel] = { minutes: 0, occurrences: 0 };
        
        if (isCheckOnly) {
           const mismatch = r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim();
           if (mismatch && !recordedShiftsForAgent.has(shiftLabel)) {
             stats[shiftLabel].occurrences += 1;
             recordedShiftsForAgent.add(shiftLabel);
           }
        } else if (isOnlyOrganic) {
           if (r.wcDuration > 0) {
             stats[shiftLabel].minutes += r.wcDuration;
             stats[shiftLabel].occurrences += 1;
           }
        } else if (isOnlyIdle) {
           if (r.idleDuration > 0) {
             stats[shiftLabel].minutes += r.idleDuration;
             stats[shiftLabel].occurrences += 1;
           }
        } else if (isOnlyTardiness) {
           if ((r.tardinessMinutes || 0) > 0) {
             stats[shiftLabel].minutes += r.tardinessMinutes || 0;
             stats[shiftLabel].occurrences += 1;
           }
        } else {
           if (r.totalOverbreak > 0) {
             stats[shiftLabel].minutes += r.totalOverbreak;
             stats[shiftLabel].occurrences += 1;
           }
        }
      });
    });
    
    let mostMinutesShift = { shift: '-', minutes: 0 };
    let mostOccurrencesShift = { shift: '-', occurrences: 0 };
    
    Object.entries(stats).forEach(([shift, data]) => {
      if (data.minutes > mostMinutesShift.minutes) {
        mostMinutesShift = { shift, minutes: data.minutes };
      }
      if (data.occurrences > mostOccurrencesShift.occurrences) {
        mostOccurrencesShift = { shift, occurrences: data.occurrences };
      }
    });

    return { 
      mostMinutes: { shift: mostMinutesShift.shift, minutes: mostMinutesShift.minutes }, 
      mostOccurrences: { shift: mostOccurrencesShift.shift, occurrences: mostOccurrencesShift.occurrences }
    };
  }, [filteredSummaries]);
  
  // Metrics for "Precisa de atenção"
  const agentsByOverbreakCount = [...filteredSummaries]
    .map(s => {
      const incidentCount = s.dailyRecords.reduce((acc, r) => {
        const breakIncidents = r.breaks.filter(b => {
          let ideal = (b.type === 'meal') ? 60 : (b.type === 'short') ? 30 : (b.type === 'wellness' || b.type === 'praying') ? 15 : (b.type === 'wc') ? 10 : 0;
          return ideal > 0 && b.durationMinutes > ideal;
        }).length;
        return acc + breakIncidents + (r.idleDuration > 0 ? 1 : 0);
      }, 0);
      return { ...s, incidentCount };
    })
    .filter(s => s.incidentCount > 0)
    .sort((a, b) => b.incidentCount - a.incidentCount)
    .slice(0, 10);

  const agentsByOverbreakDuration = [...filteredSummaries]
    .filter(s => s.totalOverbreakMinutes > 0)
    .sort((a, b) => b.totalOverbreakMinutes - a.totalOverbreakMinutes)
    .slice(0, 10);

  const topReviewAndAppeal = [...filteredSummaries]
    .filter(s => s.totalReviewAndAppealMinutes > 0)
    .sort((a, b) => b.totalReviewAndAppealMinutes - a.totalReviewAndAppealMinutes)
    .slice(0, 10);

  const topAwaitingTasks = [...filteredSummaries]
    .filter(s => s.totalAwaitingTasksMinutes > 0)
    .sort((a, b) => b.totalAwaitingTasksMinutes - a.totalAwaitingTasksMinutes)
    .slice(0, 10);

  const topNonModTotal = [...filteredSummaries]
    .filter(s => s.totalNonModMinutes > 0)
    .sort((a, b) => b.totalNonModMinutes - a.totalNonModMinutes)
    .slice(0, 10);

  const topForgotStatus = [...filteredSummaries]
    .filter(s => (s.totalForgotStatusMinutes || 0) > 0)
    .sort((a, b) => (b.totalForgotStatusMinutes || 0) - (a.totalForgotStatusMinutes || 0))
    .slice(0, 10);

  const agentsBottom5Special = [...filteredSummaries]
    .filter(s => {
      if (s.isTraining || s.totalOverbreakMinutes === 0) return false;
      return true;
    })
    .sort((a, b) => a.totalOverbreakMinutes - b.totalOverbreakMinutes)
    .slice(0, 10);

  const topProblematic = agentsByOverbreakDuration;
  const topInfrator = topProblematic[0];

  // Top WC
  const topWc = [...filteredSummaries]
    .map(s => {
      const totalWcOver = s.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
      return { ...s, totalWcOver };
    })
    .filter(s => s.wcAlerts > 0 || s.totalWcOver > 0)
    .sort((a, b) => b.totalWcOver - a.totalWcOver || b.wcAlerts - a.wcAlerts)
    .slice(0, 10);
    
  // Top Short 30Min
  const topShort30Min = [...filteredSummaries]
    .filter(s => (s.totalShort30MinRecords || 0) > 0)
    .sort((a, b) => (b.totalShort30MinRecords || 0) - (a.totalShort30MinRecords || 0))
    .slice(0, 10);

  // Top Mismatch
  const topCheck = [...filteredSummaries]
    .map(s => {
      const mismatchCount = s.dailyRecords.filter(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()).length;
      return { ...s, mismatchCount };
    })
    .filter(s => s.mismatchCount > 0)
    .sort((a, b) => b.mismatchCount - a.mismatchCount)
    .slice(0, 10);

  // Top Performers
  const topPerformers = [...filteredSummaries]
    .filter(s => !s.isTraining)
    .sort((a, b) => a.totalOverbreakMinutes - b.totalOverbreakMinutes)
    .slice(0, 10);

  // Top No Overbreaks
  const topNoOverbreaks = [...filteredSummaries]
    .filter(s => !s.isTraining && s.totalOverbreakMinutes === 0)
    .slice(0, 10);

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
      formattedOverbreak: s.totalOverbreakMinutes > 0 ? `${Math.floor(s.totalOverbreakMinutes / 60)}h ${s.totalOverbreakMinutes % 60}m` : '',
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
            <p className="flex justify-between gap-4"><span>Organic</span> <strong className={b.wcOver > 0 ? "text-amber-400" : "text-emerald-400"}>{b.wcOver > 0 ? `+${b.wcOver}m` : (b.wcDur > 0 ? `OK (${b.wcDur}m/10m)` : `OK`)}</strong></p>
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

  // Helper for rendering agent lines with tooltips
  const AgentLine = ({ summary, rank, metricValue, metricLabel, colorClass, hideTooltip }: { 
    summary: EmployeeSummary & { incidentCount?: number; totalWcOver?: number }, 
    rank: number, 
    metricValue: string, 
    metricLabel: string,
    colorClass: string,
    hideTooltip?: boolean,
    key?: React.Key
  }) => {
    const mealOver = summary.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
    const shortOver = summary.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
    const wellnessOver = summary.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
    const prayingOver = summary.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
    const wcOver = summary.dailyRecords.reduce((acc, r) => acc + r.wcOverbreak, 0);
    const idleOver = summary.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);

    const mealDur = summary.dailyRecords.reduce((acc, r) => acc + r.mealDuration, 0);
    const shortDur = summary.dailyRecords.reduce((acc, r) => acc + r.shortDuration, 0);
    const wellnessDur = summary.dailyRecords.reduce((acc, r) => acc + r.wellnessDuration, 0);
    const prayingDur = summary.dailyRecords.reduce((acc, r) => acc + r.prayingDuration, 0);
    const wcDur = summary.dailyRecords.reduce((acc, r) => acc + r.wcDuration, 0);

    return (
      <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors relative group">
        <div className="flex items-center gap-3 w-full">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 ${rank === 1 ? `${colorClass.replace('text-', 'bg-').replace('-700', '-500')} text-white shadow-md` : `${colorClass.replace('text-', 'bg-').replace('-700', '-100')} ${colorClass}`}`}>{rank}</span>
          <div className="min-w-0 pr-4 cursor-help flex flex-col">
            <p className="font-bold text-xs text-slate-800 truncate">{summary.employeeName}</p>
            {summary.email && <p className="text-[9px] text-slate-500 truncate">{summary.email}</p>}
            {(summary.lob || summary.language) && (
              <p className="text-[8px] font-bold text-blue-600 uppercase mt-0.5 truncate">
                {[summary.lob, summary.language].filter(Boolean).join(' - ')}
              </p>
            )}
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {isNonModOnly ? (
                <>
                  Total: {Math.floor(summary.totalOverbreakMinutes / 60)}h {summary.totalOverbreakMinutes % 60}m | Média/Dia: {Math.floor((summary.totalOverbreakMinutes / summary.dailyRecords.length) / 60)}h {Math.round((summary.totalOverbreakMinutes / summary.dailyRecords.length) % 60)}m
                </>
              ) : (
                <>{metricValue} {metricLabel}</>
              )}
            </p>
          </div>
        </div>

        {/* Tooltip Hover */}
        {!hideTooltip && (
        <div className="absolute left-[80%] bottom-full mb-2 z-[100] hidden group-hover:block w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 text-white animate-in fade-in zoom-in-95 duration-200">
          <p className="font-black text-sm border-b border-slate-700 pb-2 mb-2">{summary.employeeName}</p>
          <div className="space-y-1.5 text-[10px]">
             <div className="flex justify-between"><span>Meal:</span> <span className={mealOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{mealOver > 0 ? `+${mealOver}m` : (mealDur > 0 ? `OK (${mealDur}m)` : `OK`)}</span></div>
             <div className="flex justify-between"><span>Short:</span> <span className={shortOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{shortOver > 0 ? `+${shortOver}m` : (shortDur > 0 ? `OK (${shortDur}m)` : `OK`)}</span></div>
             <div className="flex justify-between"><span>Wellness:</span> <span className={wellnessOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{wellnessOver > 0 ? `+${wellnessOver}m` : (wellnessDur > 0 ? `OK (${wellnessDur}m)` : `OK`)}</span></div>
             <div className="flex justify-between"><span>Praying:</span> <span className={prayingOver > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{prayingOver > 0 ? `+${prayingOver}m` : (prayingDur > 0 ? `OK (${prayingDur}m)` : `OK`)}</span></div>
             <div className="flex justify-between"><span>Organic:</span> <span className={wcOver > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>{wcOver > 0 ? `+${wcOver}m` : (wcDur > 0 ? `OK (${wcDur}m)` : `OK`)}</span></div>
             <div className="flex justify-between"><span>Idle:</span> <span className={idleOver > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>{idleOver > 0 ? `+${idleOver}m` : `OK`}</span></div>
             <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between font-bold text-rose-400">
                <span>Total Overbreak:</span>
                <span>{summary.totalOverbreakMinutes}m</span>
             </div>
          </div>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Banner Section: Total Agents and Status Filter */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-stretch">
        <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6 flex items-center gap-6 h-full">
            <div className={`w-14 h-14 rounded-2xl ${isCheckAndShift ? 'bg-amber-100/80 text-amber-600 border-amber-200/50' : 'bg-blue-100/80 text-blue-600 border-blue-200/50'} flex items-center justify-center shrink-0 border shadow-inner hidden sm:flex`}>
              <Users size={28} strokeWidth={2.5} />
            </div>
            <div className="flex items-center gap-6 divide-x divide-slate-200 justify-between w-full">
              <div className="flex items-center gap-6 divide-x divide-slate-200 min-w-max">
                {isCheckAndShift ? (
                  <>
                  <div className="pr-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Agentes do Período</p>
                    <div className="flex items-baseline gap-1.5">
                       <p className="text-3xl font-black text-slate-900 tracking-tight">{agentsDoPeriodoCount}</p>
                       <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Calendário</span>
                    </div>
                  </div>
                  <div className="pl-6 flex-1 min-w-max">
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1 truncate text-amber-500">Agentes no período</p>
                    <div className="flex items-baseline gap-1.5">
                       <p className="text-3xl font-black tracking-tight text-amber-600">{agentsNoPeriodoCount}</p>
                       <span className="text-xs font-bold tracking-wide uppercase text-amber-500/70">
                         {agentsDeOutroPeriodoCount > 0 ? `${agentsDeOutroPeriodoCount} de outro período` : 'Todos do período'}
                       </span>
                    </div>
                  </div>
                  </>
                ) : (
                  <>
                  <div className="pr-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Agentes no Período</p>
                    <div className="flex items-baseline gap-1.5">
                       <p className="text-3xl font-black text-slate-900 tracking-tight">{totalEmployees}</p>
                       <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Total</span>
                    </div>
                  </div>
                  <div className="pl-6 flex-1 min-w-max">
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-1 truncate ${isNonModOnly ? 'text-amber-500' : (affectedCount > 0 ? 'text-rose-500' : 'text-emerald-500')}`}>{affectedText}</p>
                    <div className="flex items-baseline gap-1.5">
                       <p className={`text-3xl font-black tracking-tight ${isNonModOnly ? 'text-amber-600' : (affectedCount > 0 ? 'text-rose-600' : 'text-emerald-600')}`}>{affectedCount}</p>
                       <span className={`text-xs font-bold tracking-wide uppercase ${isNonModOnly ? 'text-amber-400' : (affectedCount > 0 ? 'text-rose-400' : 'text-emerald-400')}`}>
                         {isNonModOnly ? 'AGENTES' : 'Afetados'}
                       </span>
                    </div>
                  </div>
                  </>
                )}
              </div>
              <div className="pl-6 flex-1 hidden xl:flex flex-col gap-2">
                 {/* Most Minutes */}
                 {!isCheckOnly && (
                 <div className="flex flex-col">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5" title="Shift com mais tempo neste filtro">Shift com mais minutos</p>
                   <div className="flex items-center gap-1.5">
                     <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded uppercase border border-slate-200">{shiftStats.mostMinutes.shift}</span>
                     <span className="text-[11px] font-bold text-rose-500">
                       {shiftStats.mostMinutes.minutes > 59 
                         ? <>{Math.floor(shiftStats.mostMinutes.minutes / 60)}h {Math.round(shiftStats.mostMinutes.minutes % 60)}m <span className="text-rose-500/70 ml-1">({Math.round(shiftStats.mostMinutes.minutes)}m)</span></>
                         : `${Math.round(shiftStats.mostMinutes.minutes)}m`}
                     </span>
                   </div>
                 </div>
                 )}
                 {/* Most Occurrences */}
                 <div className="flex flex-col">
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5" title="Shift com mais ocorrências neste filtro">{isCheckOnly ? 'Shift com mais ocorrências (Agentes)' : 'Shift com mais ocorrências'}</p>
                   <div className="flex items-center gap-1.5">
                     <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded uppercase border border-slate-200">{shiftStats.mostOccurrences.shift}</span>
                     <span className="text-[11px] font-bold text-amber-500">{shiftStats.mostOccurrences.occurrences}x</span>
                   </div>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
         const isOverbreaksOnly = globalTypeFilter === 'idle_overbreak_wc';
         const showIdleCard = isIdleApplicable && !isOverbreaksOnly && !isTardinessOnly;
         const showOverbreakCard = (isOverbreaksOnly || isTardinessOnly) && !isCheckOnly;

         let topCardsCount = 1; // avg
         if (isWcApplicable && !isTardinessOnly) topCardsCount++;
         if (showIdleCard || showOverbreakCard) topCardsCount++;
         
         const topGridClass = topCardsCount === 3 ? "md:grid-cols-3" : topCardsCount === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

         const showTopPerformers = !isIdleOnly && !isTardinessOnly && !isCheckOnly && !isShort30MinOnly && !isNonModOnly;
         const isShort30MinApplicable = !isIdleOnly && !isTardinessOnly && !isCheckOnly && !isNonModOnly && !isWcOnly && !isEarlyLeaveOnly && !isShort30MinOnly;
         const botPanesCount = isNonModOnly ? 4 : 1 + (isWcApplicable && !isTardinessOnly ? 1 : 0) + (showTopPerformers ? 1 : 0) + (isShort30MinApplicable ? 1 : 0);
         const paneSpan = botPanesCount === 4 ? 'lg:col-span-3' : botPanesCount === 3 ? 'lg:col-span-4' : botPanesCount === 2 ? 'lg:col-span-6' : 'lg:col-span-12';

         return (
            <>
              <div className={`grid grid-cols-1 ${topGridClass} gap-6 mb-8`}>
                <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      {isCheckOnly ? "MÉDIA DE AGENTES POR PERÍODO" : 
                       isNonModOnly ? "Tempo médio de Non-Moderating/Dia" :
                       isWcOnly ? "Média Organic Break/Dia por agente" :
                       isIdleOnly ? "Média Idle/Dia por agente" :
                       isTardinessOnly ? "Média Atraso/Dia por agente" :
                       isEarlyLeaveOnly ? "Média Early Leave/Dia por agente" :
                       isShort30MinOnly ? "Média 30min/dia" :
                       "MÉDIA OVERBREAK/DIA POR AGENTE"}
                    </p>
                    <div className="flex items-baseline gap-1">
                      {isCheckOnly ? (
                        <div className="flex items-baseline gap-1">
                           <p className="text-2xl font-black text-slate-900">{avgAgentsMismatched}</p>
                           <span className="text-xs font-bold text-slate-400">agentes em média</span>
                        </div>
                      ) : isShort30MinOnly ? (
                        <div className="flex items-baseline gap-1">
                           <p className="text-2xl font-black text-slate-900">{validAgentsCount ? (filteredSummaries.reduce((acc, s) => acc + (s.totalShort30MinRecords || 0), 0) / validAgentsCount).toFixed(1) : 0}</p>
                           <span className="text-xs font-bold text-slate-400">dias/ag.</span>
                        </div>
                      ) : isNonModOnly ? (
                        <>
                          <p className="text-2xl font-black text-slate-900">
                            {totalDays ? Math.floor((totalOverbreak / totalDays) / 60) : 0}<span className="text-sm">h</span> {totalDays ? Math.round((totalOverbreak / totalDays) % 60) : 0}
                          </p>
                          <span className="text-xs font-bold text-slate-400">m</span>
                        </>
                      ) : (
                        <div className="flex flex-col gap-1 w-full relative">
                          <div className="flex items-baseline gap-1">
                            {averageTotalOverbreak > 59 ? (
                              <>
                                <p className="text-2xl font-black text-slate-900">{Math.floor(averageTotalOverbreak / 60)}</p>
                                <span className="text-xs font-bold text-slate-400">h</span>
                                <p className="text-2xl font-black text-slate-900 ml-1">{averageTotalOverbreak % 60}</p>
                                <span className="text-xs font-bold text-slate-400">m</span>
                              </>
                            ) : (
                              <>
                                <p className="text-2xl font-black text-slate-900">{averageTotalOverbreak}</p>
                                <span className="text-xs font-bold text-slate-400">min</span>
                              </>
                            )}
                          </div>
                          {isWcOnly && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 border-l border-slate-200 pl-3">
                               <p className="text-[9px] font-black uppercase text-slate-400 leading-tight mb-0.5">Média sem Top 5</p>
                               <p className="text-sm font-bold text-slate-600 tracking-tight leading-none">
                                 {averageWithoutTop5 > 59 ? (
                                   `${Math.floor(averageWithoutTop5 / 60)}h ${averageWithoutTop5 % 60}m`
                                 ) : (
                                   <>{averageWithoutTop5} <span className="text-[10px] font-bold text-slate-400">min</span></>
                                 )}
                               </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {isWcApplicable && !isTardinessOnly && (
                  <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <CardContent className="p-5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('wcAlerts')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-amber-600">
                          {totalWcMinutes > 59 ? (
                            <>{Math.floor(totalWcMinutes / 60)}<span className="text-xs mr-1">h</span>{totalWcMinutes % 60}<span className="text-[14px] ml-2 text-amber-600/70">({totalWcMinutes}m)</span></>
                          ) : (
                            <>{totalWcMinutes}<span className="text-xs">m</span></>
                          )}
                        </p>
                        <p className="text-xs font-bold text-amber-700/60 uppercase">/ {totalWcAgents} {t('agents')}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showIdleCard && (
                  <Card className="rounded-2xl shadow-sm border border-rose-200 overflow-hidden bg-rose-50">
                    <CardContent className="p-5">
                      <p className="text-[10px] font-bold text-rose-800 uppercase tracking-widest mb-1">{t('idleAlerts')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-rose-600">
                          {totalIdleMinutes > 59 ? (
                            <>{Math.floor(totalIdleMinutes / 60)}<span className="text-xs mr-1">h</span>{totalIdleMinutes % 60}<span className="text-[14px] ml-2 text-rose-600/70">({totalIdleMinutes}m)</span></>
                          ) : (
                            <>{totalIdleMinutes}<span className="text-xs">m</span></>
                          )}
                        </p>
                        <p className="text-xs font-bold text-rose-700/60 uppercase">/ {totalIdleAgents} {t('agents')}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showOverbreakCard && (
                  <Card className="rounded-2xl shadow-sm border border-rose-200 overflow-hidden bg-rose-50">
                    <CardContent className="p-5">
                      <p className="text-[10px] font-bold text-rose-800 uppercase tracking-widest mb-1">{isTardinessOnly ? 'Tempo Total de Atrasos' : 'Tempo Total de Overbreak'}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-rose-600">
                           {totalOverbreak > 59 ? (
                             <>{Math.floor(totalOverbreak / 60)}<span className="text-sm mr-1">h</span> {totalOverbreak % 60}<span className="text-xs">m</span><span className="text-[14px] ml-2 text-rose-600/70">({totalOverbreak}m)</span></>
                           ) : (
                             <>{totalOverbreak}<span className="text-sm">m</span></>
                           )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                  <CardHeader className={`${isCheckOnly ? 'bg-amber-50/50 border-amber-100/50' : isNonModOnly || isShort30MinOnly ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-rose-50/50 border-rose-100/50'} border-b py-4 shrink-0 rounded-t-2xl`}>
                    <CardTitle className={`text-sm font-black uppercase tracking-widest ${isCheckOnly ? 'text-amber-800' : isNonModOnly || isShort30MinOnly ? 'text-emerald-800' : isTardinessOnly || isEarlyLeaveOnly ? 'text-orange-800' : 'text-rose-800'} flex items-center gap-2`}>
                      <AlertCircle size={16} /> {isCheckOnly ? "AGENTES COM MAIS TURNOS UNSCHEDULED" : isNonModOnly ? "BOTTOM 10" : isShort30MinOnly ? "TOP 10" : isIdleOnly ? "Tempo em Idle" : isTardinessOnly ? "TOP 10 ATRASADOS" : isEarlyLeaveOnly ? "TOP 10 EARLY LEAVE" : "Tempo de Overbreaks"}
                    </CardTitle>
                    <CardDescription className={`text-xs ${isCheckOnly ? 'text-amber-600/80' : isNonModOnly || isShort30MinOnly ? 'text-emerald-600/80' : isTardinessOnly || isEarlyLeaveOnly ? 'text-orange-600/80' : 'text-rose-600/80'} mt-1`}>
                      {isCheckOnly 
                         ? `Mais dias trabalhados fora do horário`
                         : isNonModOnly 
                         ? `Menos tempo em Non-Moderating`
                         : isShort30MinOnly ? "Agentes com apenas 1 break diário" : isIdleOnly ? "Mais tempo total em idle" : isTardinessOnly ? "Mais tempo de atrasos na jornada" : isEarlyLeaveOnly ? "Mais tempo de early leave na jornada" : "Mais tempo total de overbreak"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1">
                    <div className="divide-y divide-slate-50">
                      {isCheckOnly ? (
                         topCheck.map((s, i) => (
                            <AgentLine 
                               key={`${s.employeeName}-${i}`} 
                               summary={s} 
                               rank={i+1} 
                               metricValue={`${s.mismatchCount}`} 
                               metricLabel={s.mismatchCount === 1 ? "dia" : "dias"} 
                               colorClass="text-amber-700"
                               hideTooltip={true}
                            />
                         ))
                      ) : isShort30MinOnly ? (
                         topShort30Min.slice(0, 10).map((s, i) => (
                            <AgentLine 
                               key={`${s.employeeName}-${i}`} 
                               summary={s} 
                               rank={i+1} 
                               metricValue={`${s.totalShort30MinRecords}`} 
                               metricLabel={s.totalShort30MinRecords === 1 ? "dia" : "dias"} 
                               colorClass="text-emerald-700"
                            />
                         ))
                      ) : isNonModOnly ? (
                         agentsBottom5Special.map((s, i) => (
                            <AgentLine 
                               key={`${s.employeeName}-${i}`} 
                               summary={s} 
                               rank={i+1} 
                               metricValue={`${Math.floor(s.totalOverbreakMinutes / 60)}h ${s.totalOverbreakMinutes % 60}m`} 
                               metricLabel="tempo" 
                               colorClass="text-emerald-700"
                            />
                         ))
                      ) : (
                        agentsByOverbreakDuration.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${Math.floor(s.totalOverbreakMinutes / 60)}h ${s.totalOverbreakMinutes % 60}m`} 
                              metricLabel={isTardinessOnly ? "atraso" : isEarlyLeaveOnly ? "early leave" : "excedidos"} 
                              colorClass={isTardinessOnly || isEarlyLeaveOnly ? "text-orange-700" : "text-rose-700"}
                           />
                        ))
                      )}
                      {((isCheckOnly ? topCheck.length : isNonModOnly ? agentsBottom5Special.length : agentsByOverbreakDuration.length) === 0) && (
                        <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {isWcApplicable && (
                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-amber-50/50 border-b border-amber-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
                        <AlertCircle size={16} /> TOP 10 ORGANIC
                      </CardTitle>
                      <CardDescription className="text-xs text-amber-600/80 mt-1">{t('topWcDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topWc.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${s.totalWcOver}m`} 
                              metricLabel="excedidos" 
                              colorClass="text-amber-700"
                           />
                        ))}
                        {topWc.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isShort30MinApplicable && (
                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2">
                        <AlertCircle size={16} /> SHORTBREAKS 30MIN
                      </CardTitle>
                      <CardDescription className="text-xs text-emerald-600/80 mt-1">Agentes com apenas 1 break diário</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topShort30Min.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${s.totalShort30MinRecords}`} 
                              metricLabel={s.totalShort30MinRecords === 1 ? "dia" : "dias"} 
                              colorClass="text-emerald-700"
                              hideTooltip={true}
                           />
                        ))}
                        {topShort30Min.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showTopPerformers && (
                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className={`bg-emerald-50/50 border-emerald-100/50 border-b py-4 shrink-0 rounded-t-2xl`}>
                      <CardTitle className={`text-sm font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2`}>
                        <CheckCircle2 size={16} /> {t('topPerformers')}
                      </CardTitle>
                      <CardDescription className={`text-xs text-emerald-600/80 mt-1`}>
                        {t('topPerformersDesc')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topPerformers.map((s, i) => (
                             <AgentLine 
                                key={`${s.employeeName}-${i}`} 
                                summary={s} 
                                rank={i+1} 
                                metricValue={s.totalOverbreakMinutes === 0 ? "Perfeito" : `${s.totalOverbreakMinutes}m`} 
                                metricLabel={s.totalOverbreakMinutes === 0 ? "" : "excedidos"} 
                                colorClass="text-emerald-700"
                                hideTooltip={true}
                             />
                        ))}
                        {topPerformers.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isNonModOnly && (
                  <>
                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                        <AlertCircle size={16} /> FORGOT STATUS
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600/80 mt-1">Status longo após fim de turno</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topForgotStatus.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${Math.floor(s.totalForgotStatusMinutes / 60)}h ${s.totalForgotStatusMinutes % 60}m`} 
                              metricLabel="tempo" 
                              colorClass="text-slate-700"
                              hideTooltip={true}
                           />
                        ))}
                        {topForgotStatus.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-purple-50/50 border-b border-purple-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-purple-800 flex items-center gap-2">
                        <AlertCircle size={16} /> TOP 10 R&A
                      </CardTitle>
                      <CardDescription className="text-xs text-purple-600/80 mt-1">Mais tempo em Review and Appeal</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topReviewAndAppeal.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${Math.floor(s.totalReviewAndAppealMinutes / 60)}h ${s.totalReviewAndAppealMinutes % 60}m`} 
                              metricLabel="tempo" 
                              colorClass="text-purple-700"
                              hideTooltip={true}
                           />
                        ))}
                        {topReviewAndAppeal.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-800 flex items-center gap-2">
                        <AlertCircle size={16} /> TOP 10 AWAITING
                      </CardTitle>
                      <CardDescription className="text-xs text-indigo-600/80 mt-1">Mais tempo em Awaiting Tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topAwaitingTasks.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${Math.floor(s.totalAwaitingTasksMinutes / 60)}h ${s.totalAwaitingTasksMinutes % 60}m`} 
                              metricLabel="tempo" 
                              colorClass="text-indigo-700"
                              hideTooltip={true}
                           />
                        ))}
                        {topAwaitingTasks.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${paneSpan} rounded-2xl shadow-sm border border-slate-200 bg-white flex flex-col overflow-visible`}>
                    <CardHeader className="bg-teal-50/50 border-b border-teal-100/50 py-4 shrink-0 rounded-t-2xl">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-teal-800 flex items-center gap-2">
                        <AlertCircle size={16} /> TOP 10 NON-MOD
                      </CardTitle>
                      <CardDescription className="text-xs text-teal-600/80 mt-1">Mais tempo TOTAL em Non-Moderating</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <div className="divide-y divide-slate-50">
                        {topNonModTotal.map((s, i) => (
                           <AgentLine 
                              key={`${s.employeeName}-${i}`} 
                              summary={s} 
                              rank={i+1} 
                              metricValue={`${Math.floor(s.totalNonModMinutes / 60)}h ${s.totalNonModMinutes % 60}m`} 
                              metricLabel="tempo" 
                              colorClass="text-teal-700"
                              hideTooltip={true}
                           />
                        ))}
                        {topNonModTotal.length === 0 && (
                          <div className="p-8 text-center text-xs font-bold text-slate-400">Nenhum dado</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  </>
                )}
              </div>
            </>
         );
      })()}

        <Card className="lg:col-span-12 rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">
               {isCheckOnly ? 'DETALHES DE DIVERGÊNCIA DE HORÁRIO' :
               isNonModOnly ? `Alertas Non-Moderating` : 
               isWcOnly ? 'Alertas Organic' : 
               isIdleOnly ? 'Alertas Idle' : 
               isTardinessOnly ? 'Alertas de Atraso' :
               isEarlyLeaveOnly ? 'Alertas de Early Leave' :
               t('auditLogOverbreak')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              {isCheckOnly ? 'Agentes que trabalharam em turnos diferentes dos programados' :
               isNonModOnly ? `Detalhamento dos colaboradores em Non-Moderating` : 
               isWcOnly ? 'Detalhamento dos colaboradores em uso de Organic' : 
               isIdleOnly ? 'Detalhamento dos colaboradores em status Idle' : 
               isTardinessOnly ? 'Detalhamento dos colaboradores com atrasos na jornada' :
               isEarlyLeaveOnly ? 'Detalhamento dos colaboradores que saíram cedo da jornada' :
               t('needAttentionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {(isCheckOnly ? topCheck : topProblematic).map((s, i) => (
                <div key={`${s.employeeName}-${i}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black shrink-0 ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>{i+1}</span>
                    <div>
                      <span className="font-bold text-sm text-slate-800">{s.employeeName}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isCheckOnly ? "Trabalhou fora do horário programado." : isWcOnly ? "Uso de Organic contabilizado." : isIdleOnly ? "Apresentou ociosidade crítica." : isTardinessOnly ? "Registrou atraso na jornada." : isEarlyLeaveOnly ? "Registrou early leave na jornada." : s.idleAlerts > 0 ? "Apresentou ociosidade crítica." : s.wcAlerts > 0 ? "Uso excessivo de status (Organic)." : "Excedeu tempo de pausas."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Dialog>
                      <DialogTrigger className={`px-3 py-1.5 text-xs font-black rounded-lg uppercase shadow-sm flex items-center gap-1 group transition-colors ${isCheckOnly ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : isWcOnly ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : isIdleOnly ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : isTardinessOnly || isEarlyLeaveOnly ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                           {isCheckOnly ? (
                             <span>{s.mismatchCount} {s.mismatchCount === 1 ? 'DIA' : 'DIAS'} DIFERENTES</span>
                           ) : isWcOnly ? (
                             <span className="flex items-center gap-1.5">
                               <span>TOT: <span className="font-bold">{Math.floor((s.wcTotalMinutes || 0) / 60)}h {(s.wcTotalMinutes || 0) % 60}m</span></span>
                               <span className="opacity-40 font-normal">|</span>
                               <span className="text-rose-600">EXC: <span className="font-bold">{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m</span></span>
                             </span>
                           ) : isTardinessOnly ? (
                             <span>{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m ATRASO</span>
                           ) : isEarlyLeaveOnly ? (
                             <span>{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m EARLY LEAVE</span>
                           ) : (
                             <span>{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m {isIdleOnly ? 'IDLE' : 'OVER'}</span>
                           )}
                           <span className={`rounded px-1 group-hover:bg-opacity-80 ml-1 ${isCheckOnly ? 'bg-amber-200 text-amber-800' : isWcOnly ? 'bg-amber-200 text-amber-800' : isIdleOnly ? 'bg-rose-200 text-rose-800' : isTardinessOnly || isEarlyLeaveOnly ? 'bg-orange-200 text-orange-800' : 'bg-rose-200 text-rose-800'}`}>Detalhes</span>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border-slate-200 p-0 overflow-hidden shadow-2xl">
                         <div className="bg-slate-900 text-white p-6 shrink-0 flex flex-col gap-4">
                            <div>
                              <DialogHeader>
                                 <DialogTitle className="text-xl font-black">{s.employeeName}</DialogTitle>
                              </DialogHeader>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
                                {isWcOnly ? (
                                   <span>{Math.floor((s.wcTotalMinutes || 0) / 60)}h {(s.wcTotalMinutes || 0) % 60}m Total <span className="mx-2 opacity-50">|</span> <span className="text-amber-500">{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m Excedidos</span></span>
                                ) : isIdleOnly ? (
                                   <span>{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m <span className="text-rose-500">Em Ociosidade</span></span>
                                ) : (
                                   <span>{Math.floor(s.totalOverbreakMinutes / 60)}h {s.totalOverbreakMinutes % 60}m <span className="text-rose-500">Excedidos</span></span>
                                )}
                              </p>
                            </div>
                            <div className="flex bg-slate-800 p-1 rounded-lg shrink-0 self-start">
                              <button onClick={() => setDetailsSortMode('duration')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${detailsSortMode === 'duration' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Mais Longos</button>
                              <button onClick={() => setDetailsSortMode('date')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${detailsSortMode === 'date' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Cronológico</button>
                            </div>
                         </div>
                         {isCheckOnly ? (
                          <div className="flex-1 overflow-y-auto w-full bg-slate-50">
                             <div className="space-y-3 p-6 min-h-max">
                                {s.dailyRecords
                                   .filter(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim())
                                   .map((r, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                        <div>
                                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{format(new Date(r.date), 'dd/MM/yyyy')}</p>
                                          <div className="flex items-center gap-3 mt-1.5">
                                            <div className="flex flex-col">
                                              <span className="text-[9px] uppercase font-bold text-slate-400">Schedule</span>
                                              <span className="text-sm font-black text-slate-700">{r.scheduledShift}</span>
                                            </div>
                                            <span className="text-slate-300 font-bold">→</span>
                                            <div className="flex flex-col">
                                              <span className="text-[9px] uppercase font-black text-amber-500">Realizado</span>
                                              <span className="text-sm font-black text-amber-600">{r.inferredShift}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                   ))}
                             </div>
                          </div>
                         ) : (
                         <div className="flex-1 overflow-y-auto w-full bg-slate-50">
                            <div className="space-y-3 p-6 min-h-max">
                               {s.dailyRecords
                                  .flatMap(r => r.breaks.map(b => ({ ...b, date: r.date })))
                                  .filter(b => b.type !== 'forgot_status' && b.type !== 'offline')
                                  .filter(b => {
                                      if (isNonModOnly) {
                                          return b.type === 'non_moderating';
                                      }
                                      
                                      const isWcOnlyFilt = globalIncludeWc && !globalIncludeIdle && !globalIncludeNonMod && globalTypeFilter === 'all';
                                      const isIdleOnlyFilt = globalIncludeIdle && !globalIncludeWc && !globalIncludeNonMod && globalTypeFilter === 'all';

                                      if (isWcOnlyFilt) return b.type === 'wc';
                                      if (isIdleOnlyFilt) return b.type === 'idle' && (!globalFilterMajorOverbreaks || b.durationMinutes > 2);
                                      
                                      if (b.type === 'wc') return globalIncludeWc;
                                      if (b.type === 'idle') return globalIncludeIdle && (!globalFilterMajorOverbreaks || b.durationMinutes > 2);
                                      if (b.type === 'non_moderating') return globalIncludeNonMod;
                                      
                                      // Standard Overbreaks
                                      let idealTime = (b.type === 'meal') ? 60 : (b.type === 'short') ? 30 : (b.type === 'wellness' || b.type === 'praying') ? 15 : 0;
                                      if (idealTime > 0 && b.durationMinutes > idealTime) {
                                         const diff = b.durationMinutes - idealTime;
                                         if (b.type === 'wellness' || b.type === 'praying') return true;
                                         if (!globalFilterMajorOverbreaks || diff > 2) return true;
                                         return false;
                                      }
                                      return false;
                                   })
                                  .sort((a,b) => detailsSortMode === 'duration' ? b.durationMinutes - a.durationMinutes : new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                   .map((b, idx) => {
                                    const idealTime = (b.type === 'meal') ? 60 : (b.type === 'short') ? 30 : (b.type === 'wellness' || b.type === 'praying') ? 15 : (b.type === 'wc') ? 10 : 0;
                                    const exceededTime = b.durationMinutes - idealTime;
                                    return (
                                      <div key={idx} className={`flex flex-col gap-2 bg-white p-4 rounded-xl border shadow-sm ${b.type === 'forgot_status' ? 'border-slate-200' : isWcOnly ? 'border-amber-100' : isIdleOnly ? 'border-rose-100' : 'border-rose-100'}`}>
                                        <div className="flex justify-between items-center w-full">
                                          <div>
                                            <p className={`text-sm font-black uppercase tracking-tight ${b.type === 'forgot_status' ? 'text-slate-800' : isWcOnly ? 'text-amber-800' : isIdleOnly ? 'text-rose-800' : 'text-rose-800'}`} title={b.rawStatus}>{b.type === 'forgot_status' ? 'Esqueceu Status' : b.type === 'other' ? (b.rawStatus || b.type) : b.type}</p>
                                            <p className="text-xs font-bold text-slate-500">{format(new Date(b.date), 'dd/MM/yyyy')} • das {format(new Date(b.startTime), 'HH:mm')} às {format(new Date(b.endTime), 'HH:mm')}</p>
                                          </div>
                                          <div className="text-right flex flex-col items-end">
                                            {isWcOnly || isIdleOnly || idealTime === 0 ? (
                                               <>
                                                 <p className={`text-xl font-black ${b.type === 'forgot_status' ? 'text-slate-700' : isWcOnly ? 'text-amber-600' : isIdleOnly ? 'text-rose-600' : 'text-rose-600'}`}>{Math.floor(b.durationMinutes / 60)}h {b.durationMinutes % 60}m</p>
                                                 <p className={`text-[10px] font-bold uppercase ${b.type === 'forgot_status' ? 'text-slate-400' : isWcOnly ? 'text-amber-400' : isIdleOnly ? 'text-rose-400' : 'text-rose-400'}`}>{b.durationMinutes} minutos totais</p>
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
                                        {(() => {
                                          if (!b.remarks || b.remarks.trim().length === 0) return false;
                                          const lowRemark = b.remarks.toLowerCase();
                                          if (lowRemark.includes("system changes state to idle") || lowRemark.includes("系统切换空闲状态")) return false;
                                          const isRelevantNote = b.type === 'non_moderating' || b.type === 'short' || b.type === 'meeting' || b.type === 'training' || b.rawStatus.toLowerCase().includes('coaching') || (b.subType || '').toLowerCase().includes('coaching') || lowRemark.includes('coaching');
                                          return isRelevantNote;
                                        })() && (
                                          <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 italic text-slate-600">
                                            <span className="font-bold not-italic text-[10px] uppercase text-slate-400 block mb-1">Observação do Agente:</span>
                                            "{b.remarks.trim()}"
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                               {s.dailyRecords.flatMap(r => r.breaks).filter(b => b.type !== 'forgot_status' && b.type !== 'offline').filter(b => {
                                     if (isNonModOnly) {
                                         return b.type === 'non_moderating';
                                     }
                                     if (b.type === 'wc') return globalIncludeWc;
                                     if (b.type === 'idle') return globalIncludeIdle;
                                     let idealTime = (b.type === 'meal') ? 60 : (b.type === 'short') ? 30 : (b.type === 'wellness' || b.type === 'praying') ? 15 : 0;
                                     if (idealTime > 0 && b.durationMinutes > idealTime) {
                                        const diff = b.durationMinutes - idealTime;
                                        if (b.type === 'wellness' || b.type === 'praying') return true;
                                        if (!globalFilterMajorOverbreaks || diff > 2) return true;
                                        return false;
                                     } else if (b.type === 'idle' || b.type === 'forgot_status') {
                                        if (!globalFilterMajorOverbreaks || b.durationMinutes > 2) return true;
                                        return false;
                                     }
                                     return false;
                                  }).length === 0 && (
                                   <div className="text-center p-8 text-slate-400 font-bold text-sm">Nenhuma quebra de pausa detalhada individualmente.</div>
                               )}
                            </div>
                         </div>
                         )}
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
    );
}
