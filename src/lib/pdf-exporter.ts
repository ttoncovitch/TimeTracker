import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { EmployeeSummary } from '../types';
import { translations, Language } from './i18n';
import { isShiftMismatch } from './shiftUtils';

export interface PDFOptions {
  showCheck?: boolean;
  isTardiness?: boolean;
  isMinorTardiness?: boolean;
  isEarlyLeave?: boolean;
  isAbsences?: boolean;
  isShort30Min?: boolean;
  isIdle?: boolean;
  isWc?: boolean;
  isNonMod?: boolean;
  isCheck?: boolean;
  isAgentDetail?: boolean;
  activeExtraStatus?: string | null;
  attrKey?: string | null;
  totalAgentsCount?: number;
  affectedAgentsCount?: number;
  lang?: Language;
}

export function isSupportRole(summary: { role?: string; lob?: string }): boolean {
  const roleUpper = (summary.role || '').trim().toUpperCase();
  const lobUpper = (summary.lob || '').trim().toUpperCase();

  // LED QUALITY is explicitly NOT a support role, it's CSR
  if (lobUpper.includes('LED QUALITY')) return false;

  // Exact match for OS in either column
  if (roleUpper === 'OS' || lobUpper === 'OS') return true;
  
  // Known support roles - check both Role and LOB to catch RTA or QA listed under LOB
  const supportRegex = /\b(QA|RTA|TRAINER|SUPERVISOR|MANAGER|TL|WFM|REAL TIME|OPS|COORDINATOR|QUALITY|OPERATIONAL SUPPORT)\b/i;
  
  if (supportRegex.test(roleUpper) || supportRegex.test(lobUpper)) {
    return true;
  }

  return false;
}

export function exportLOBsToPDF(summaries: EmployeeSummary[], title: string = "LOBs Performance Report", filename: string = "lobs_report", lang: Language = 'pt') {
  const t = (key: keyof typeof translations['pt']) => translations[lang][key] || key;

  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${t('generatedAt')}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  
  let startYPos = 40;
  
  // Group summaries by LOB
  const lobs: Record<string, EmployeeSummary[]> = {};
  
  summaries.forEach(s => {
    const hasWorkingSchedule = s.dailyRecords.some(r => (!r.isOFF && !r.isPTO && !r.isLOA && !r.isSL && !r.isSUSPP && !r.isATT) || r.isAbsence);
    if (!hasWorkingSchedule) return;

    const lob = (s.lob && s.lob.trim() !== '') ? s.lob : t('unknown');
    if (isSupportRole(s)) return;
    if (['LEG', 'LMG', 'LMG BADNESS', 'LMG ES', 'LMG LATAM'].includes(lob.toUpperCase())) return;
    
    if (!lobs[lob]) {
      lobs[lob] = [];
    }
    lobs[lob].push(s);
  });

  const head = [['LOB', t('pdfAgentCount' as any) || 'Agents', t('pdfOverbreakTime' as any) || 'Overbreaks', t('pdfAbsences' as any) || 'Absences', t('pdfTardinessMins' as any) || 'Tardiness']];
  const tableData: any[][] = [];

  const sortedLobs = Object.keys(lobs).sort();

  sortedLobs.forEach(lobName => {
    const agents = lobs[lobName];
    const agentCount = agents.length;
    let totalOverbreak = 0;
    let totalAbsences = 0;
    let totalTardiness = 0;

    agents.forEach(s => {
      totalOverbreak += s.totalOverbreakMinutes;
      totalAbsences += s.dailyRecords.filter(r => r.isAbsence).length;
      totalTardiness += s.dailyRecords.reduce((acc, r) => acc + (r.tardinessMinutes || 0), 0);
    });

    tableData.push([
      lobName,
      agentCount,
      `${totalOverbreak}m`,
      totalAbsences,
      `${totalTardiness}m`
    ]);
  });

  autoTable(doc, {
    startY: startYPos,
    head: head,
    body: tableData,
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: function (data) {
      if (data.section === 'body') {
        const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
        if (data.column.index === 2 && textStr && textStr !== '0m') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportToPDF(summaries: EmployeeSummary[], title: string = "Breaks Report", filename: string = "breaks_report", options: PDFOptions = {}) {
  const lang = options.lang || 'pt';
  const t = (key: keyof typeof translations['pt']) => translations[lang][key] || key;

  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${t('generatedAt')}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  
  let startYPos = 40;
  if (options.totalAgentsCount !== undefined && options.affectedAgentsCount !== undefined) {
    doc.text(`${t('totalAgentsPeriod')}: ${options.totalAgentsCount}`, 14, 38);
    doc.text(`${t('affectedAgents')}: ${options.affectedAgentsCount}`, 14, 46);
    startYPos = 54;
  }

  if (options.isAgentDetail && summaries.length === 1) {
    const s = summaries[0];
    const totalModeratingMinutes = Math.round(s.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => b.type === 'moderating').reduce((sum, b) => sum + b.durationMinutes, 0), 0));
    
    const overbreakTypes = [];
    const mealOver = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
    if (mealOver > 0) overbreakTypes.push(t('meal'));
    const shortOver = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
    if (shortOver > 0) overbreakTypes.push(t('short'));
    const wellOver = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
    if (wellOver > 0) overbreakTypes.push(t('wellness'));
    const prayOver = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
    if (prayOver > 0) overbreakTypes.push(t('praying'));
    const idleOver = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);
    if (idleOver > 0) overbreakTypes.push(t('idle'));
    const typesStr = overbreakTypes.length > 0 ? overbreakTypes.join(', ') : t('pdfNone');

    const head1 = [[t('pdfAgent'), t('pdfWorkTime'), t('pdfTotalBreaks'), t('pdfOverbreakTypes'), t('pdfOverbreakTime'), t('pdfWcTime'), t('pdfWcAlerts')]];
    const tableData1 = [[
      s.employeeName,
      `${Math.floor(totalModeratingMinutes / 60)}h ${totalModeratingMinutes % 60}m`,
      `${s.totalBreakMinutes}m`,
      typesStr,
      `${s.totalOverbreakMinutes}m`,
      s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
      s.wcAlerts > 0 ? `${s.wcAlerts} ${t('pdfAlerts')}` : t('pdfNone')
    ]];

    autoTable(doc, {
      startY: startYPos,
      head: head1,
      body: tableData1,
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: function (data) {
        if (data.section === 'body') {
          const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
          if (data.column.index === 4 && textStr && textStr !== '0m') {
            data.cell.styles.fillColor = [220, 38, 38];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 5 && textStr && textStr !== '0m') {
             data.cell.styles.fillColor = [217, 119, 6];
             data.cell.styles.textColor = [0, 0, 0];
             data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    let nextY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(lang === 'pt' ? 'Detalhes de Status por Dia' : 'Daily Status Details', 14, nextY);
    nextY += 5;

    const head2 = [[t('pdfDate'), t('pdfScheduledShift'), t('pdfStatus'), t('pdfStartedAt'), t('pdfActualEnd'), lang === 'pt' ? 'Duração (m)' : 'Duration (m)']];
    const tableData2: any[][] = [];

    const records = [...s.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
    records.forEach(r => {
        const sortedBreaks = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)));
        sortedBreaks.forEach(b => {
             let label: string = b.type;
             if (b.type === 'other') label = b.rawStatus || b.type;
             else if (b.type === 'forgot_status') label = 'IDLE';
             else if (b.type === 'non_moderating' && b.subType) label = b.subType;
             
             tableData2.push([
                 r.date,
                 r.scheduledShift || r.inferredShift || t('pdfUnknown'),
                 label.toUpperCase(),
                 b.startTime ? format(new Date(b.startTime), 'HH:mm') : '-',
                 b.endTime ? format(new Date(b.endTime), 'HH:mm') : '-',
                 `${b.durationMinutes}m`
             ]);
        });
    });

    autoTable(doc, {
      startY: nextY,
      head: head2,
      body: tableData2,
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: function(data) {
          if (data.section === 'body') {
              const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
              if (data.column.index === 2) {
                  if (textStr === 'MODERATING') {
                      data.cell.styles.textColor = [34, 197, 94];
                      data.cell.styles.fontStyle = 'bold';
                  } else if (textStr === 'IDLE' || textStr === 'FORGOT_STATUS') {
                      data.cell.styles.textColor = [220, 38, 38];
                      data.cell.styles.fontStyle = 'bold';
                  } else if (textStr === 'MEAL' || textStr === 'SHORT' || textStr === 'WELLNESS') {
                      data.cell.styles.textColor = [41, 128, 185];
                  } else if (textStr === 'OFFLINE') {
                      data.cell.styles.textColor = [100, 116, 139];
                  }
              }
          }
      }
    });

    doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    return;
  }
  
  let head: string[][] = [];

  let tableData: any[][] = [];

  if (options.isTardiness || options.isMinorTardiness) {
    head = [[t('pdfAgent'), t('pdfDate'), t('pdfScheduledShift'), t('pdfEffectiveShift'), t('pdfStartedAt'), t('pdfTardinessMins')]];
    
    summaries.forEach(s => {
      const filterFn = options.isTardiness 
        ? (r: any) => (r.tardinessMinutes || 0) >= 15
        : (r: any) => (r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15;

      s.dailyRecords.filter(filterFn).forEach(r => {
        let actualStart = t('pdfUnknown');
        if (r.actualStartTime) {
            actualStart = format(new Date(r.actualStartTime), 'HH:mm');
        } else {
            const breakFirst = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
            actualStart = breakFirst ? (breakFirst.startTime ? format(new Date(breakFirst.startTime), 'HH:mm') : t('pdfUnknown')) : t('pdfUnknown');
        }
        let effectiveShift = '-';
        if (isShiftMismatch(r.scheduledShift, r.inferredShift)) {
            effectiveShift = r.inferredShift;
        } else if (!r.scheduledShift && r.inferredShift) {
            effectiveShift = r.inferredShift;
        }

        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || t('pdfUnknown'),
          effectiveShift,
          actualStart,
          `${r.tardinessMinutes}m`
        ]);
      });
    });
  } else if (options.isEarlyLeave) {
    head = [[t('pdfAgent'), t('pdfDate'), t('pdfScheduledShift'), t('pdfActualEnd'), t('pdfEarlyLeaveMins')]];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => (r.earlyLeaveMinutes || 0) > 0).forEach(r => {
        let actualEnd = t('pdfUnknown');
        if (r.actualEndTime) {
            actualEnd = format(new Date(r.actualEndTime), 'HH:mm');
        } else {
            const breakLast = [...r.breaks].sort((a,b) => String(b.endTime).localeCompare(String(a.endTime)))[0];
            actualEnd = breakLast ? (breakLast.endTime ? format(new Date(breakLast.endTime), 'HH:mm') : t('pdfUnknown')) : t('pdfUnknown');
        }
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || t('pdfUnknown'),
          actualEnd,
          `${r.earlyLeaveMinutes}m`
        ]);
      });
    });
  } else if (options.isAbsences) {
    head = [[t('pdfAgent'), t('pdfDate'), t('pdfScheduledShift'), t('pdfStatus')]];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => r.isAbsence).forEach(r => {
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || t('pdfUnknown'),
          t('pdfAbsence')
        ]);
      });
    });
  } else if (options.isCheck) {
    head = [[t('pdfAgent'), t('pdfDate'), t('pdfScheduledShift'), t('pdfWorkedShift')]];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => isShiftMismatch(r.scheduledShift, r.inferredShift)).forEach(r => {
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || t('pdfUnknown'),
          r.inferredShift || t('pdfUnknown')
        ]);
      });
    });
  } else if (options.activeExtraStatus && options.attrKey) {
    head = [[t('pdfAgent'), t('pdfDate'), t('pdfStatus')]];
    const key = options.attrKey as keyof EmployeeSummary['dailyRecords'][0];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => !!r[key]).forEach(r => {
        tableData.push([
          s.employeeName,
          r.date,
          options.activeExtraStatus
        ]);
      });
    });
  } else {
    head = [[t('pdfAgent'), t('pdfWorkTime'), t('pdfTotalBreaks'), t('pdfOverbreakTypes'), t('pdfOverbreakTime'), t('pdfWcTime'), t('pdfWcAlerts')]];
    tableData = summaries.map(s => {
      const overbreakTypes = [];
      const mealOver = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
      if (mealOver > 0) overbreakTypes.push(t('meal'));
      const shortOver = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
      if (shortOver > 0) overbreakTypes.push(t('short'));
      const wellOver = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
      if (wellOver > 0) overbreakTypes.push(t('wellness'));
      const prayOver = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
      if (prayOver > 0) overbreakTypes.push(t('praying'));
      const idleOver = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);
      if (idleOver > 0) overbreakTypes.push(t('idle'));
      const typesStr = overbreakTypes.length > 0 ? overbreakTypes.join(', ') : t('pdfNone');

      const totalModeratingMinutes = Math.round(s.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => b.type === 'moderating').reduce((sum, b) => sum + b.durationMinutes, 0), 0));

      return [
        s.employeeName,
        `${Math.floor(totalModeratingMinutes / 60)}h ${totalModeratingMinutes % 60}m`,
        `${s.totalBreakMinutes}m`,
        typesStr,
        `${s.totalOverbreakMinutes}m`,
        s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
        s.wcAlerts > 0 ? `${s.wcAlerts} ${t('pdfAlerts')}` : t('pdfNone')
      ];
    });
  }

  autoTable(doc, {
    startY: startYPos,
    head: head,
    body: tableData,
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: function (data) {
      if (data.section === 'body' && !options.isTardiness && !options.isEarlyLeave && !options.isAbsences && !options.isCheck && !options.activeExtraStatus) {
        const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
        
        // Red formatting for Overbreak Time > 0 (col 4)
        if (data.column.index === 4 && textStr && textStr !== '0m') {
          data.cell.styles.fillColor = [220, 38, 38]; // red-600
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
        
        // Yellow formatting for Tempo WC > 0 (col 5)
        if (data.column.index === 5 && textStr && textStr !== '0m') {
          data.cell.styles.fillColor = [217, 119, 6]; // amber-600
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
