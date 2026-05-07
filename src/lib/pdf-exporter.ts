import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { EmployeeSummary } from '../types';
import { translations, Language } from './i18n';
import { isShiftMismatch } from './shiftUtils';

export interface PDFOptions {
  isTardiness?: boolean;
  isMinorTardiness?: boolean;
  isEarlyLeave?: boolean;
  isAbsences?: boolean;
  isShort30Min?: boolean;
  isIdle?: boolean;
  isWc?: boolean;
  isNonMod?: boolean;
  isCheck?: boolean;
  activeExtraStatus?: string | null;
  attrKey?: string | null;
  totalAgentsCount?: number;
  affectedAgentsCount?: number;
  lang?: Language;
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

      return [
        s.employeeName,
        `${Math.floor(s.totalWorkMinutes / 60)}h ${s.totalWorkMinutes % 60}m`,
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
