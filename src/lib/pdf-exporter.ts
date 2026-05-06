import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { EmployeeSummary } from '../types';

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
}

export function exportToPDF(summaries: EmployeeSummary[], title: string = "Breaks Report", filename: string = "breaks_report", options: PDFOptions = {}) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated at: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  
  let startYPos = 40;
  if (options.totalAgentsCount !== undefined && options.affectedAgentsCount !== undefined) {
    doc.text(`Total de Agentes no Periodo: ${options.totalAgentsCount}`, 14, 38);
    doc.text(`Agentes Afetados: ${options.affectedAgentsCount}`, 14, 46);
    startYPos = 54;
  }
  
  let head: string[][] = [];

  let tableData: any[][] = [];

  if (options.isTardiness) {
    head = [['Agent', 'Date', 'Scheduled Shift', 'Effective Shift', 'Started at:', 'Tardiness (Mins)']];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => (r.tardinessMinutes || 0) >= 15).forEach(r => {
        let actualStart = 'Unknown';
        if (r.actualStartTime) {
            actualStart = format(new Date(r.actualStartTime), 'HH:mm');
        } else {
            const breakFirst = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
            actualStart = breakFirst ? (breakFirst.startTime ? format(new Date(breakFirst.startTime), 'HH:mm') : 'Unknown') : 'Unknown';
        }
        let effectiveShift = '-';
        if (r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()) {
            effectiveShift = r.inferredShift;
        } else if (!r.scheduledShift && r.inferredShift) {
            effectiveShift = r.inferredShift;
        }

        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || 'Unknown',
          effectiveShift,
          actualStart,
          `${r.tardinessMinutes}m`
        ]);
      });
    });
  } else if (options.isMinorTardiness) {
    head = [['Agent', 'Date', 'Scheduled Shift', 'Effective Shift', 'Started at:', 'Tardiness (Mins)']];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => (r.tardinessMinutes || 0) > 0 && (r.tardinessMinutes || 0) < 15).forEach(r => {
        let actualStart = 'Unknown';
        if (r.actualStartTime) {
            actualStart = format(new Date(r.actualStartTime), 'HH:mm');
        } else {
            const breakFirst = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
            actualStart = breakFirst ? (breakFirst.startTime ? format(new Date(breakFirst.startTime), 'HH:mm') : 'Unknown') : 'Unknown';
        }
        let effectiveShift = '-';
        if (r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()) {
            effectiveShift = r.inferredShift;
        } else if (!r.scheduledShift && r.inferredShift) {
            effectiveShift = r.inferredShift;
        }

        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || 'Unknown',
          effectiveShift,
          actualStart,
          `${r.tardinessMinutes}m`
        ]);
      });
    });
  } else if (options.isEarlyLeave) {
    head = [['Agent', 'Date', 'Scheduled Shift', 'Actual End', 'Early Leave (Mins)']];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => (r.earlyLeaveMinutes || 0) > 0).forEach(r => {
        let actualEnd = 'Unknown';
        if (r.actualEndTime) {
            actualEnd = format(new Date(r.actualEndTime), 'HH:mm');
        } else {
            const breakLast = [...r.breaks].sort((a,b) => String(b.endTime).localeCompare(String(a.endTime)))[0];
            actualEnd = breakLast ? (breakLast.endTime ? format(new Date(breakLast.endTime), 'HH:mm') : 'Unknown') : 'Unknown';
        }
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || 'Unknown',
          actualEnd,
          `${r.earlyLeaveMinutes}m`
        ]);
      });
    });
  } else if (options.isAbsences) {
    head = [['Agent', 'Date', 'Scheduled Shift', 'Status']];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => r.isAbsence).forEach(r => {
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || r.inferredShift || 'Unknown',
          'Absence'
        ]);
      });
    });
  } else if (options.isCheck) {
    head = [['Agent', 'Date', 'Scheduled Shift', 'Worked Shift']];
    summaries.forEach(s => {
      s.dailyRecords.filter(r => r.scheduledShift && r.inferredShift && r.scheduledShift.trim() !== r.inferredShift.trim()).forEach(r => {
        tableData.push([
          s.employeeName,
          r.date,
          r.scheduledShift || 'Unknown',
          r.inferredShift || 'Unknown'
        ]);
      });
    });
  } else if (options.activeExtraStatus && options.attrKey) {
    head = [['Agent', 'Date', 'Status']];
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
    head = [['Agent', 'Work Time', 'Total Breaks', 'Overbreak Types', 'Overbreak Time', 'WC Time', 'WC Alerts']];
    tableData = summaries.map(s => {
      const overbreakTypes = [];
      const mealOver = s.dailyRecords.reduce((acc, r) => acc + r.mealOverbreak, 0);
      if (mealOver > 0) overbreakTypes.push('Meal');
      const shortOver = s.dailyRecords.reduce((acc, r) => acc + r.shortOverbreak, 0);
      if (shortOver > 0) overbreakTypes.push('Short');
      const wellOver = s.dailyRecords.reduce((acc, r) => acc + r.wellnessOverbreak, 0);
      if (wellOver > 0) overbreakTypes.push('Well.');
      const prayOver = s.dailyRecords.reduce((acc, r) => acc + r.prayingOverbreak, 0);
      if (prayOver > 0) overbreakTypes.push('Pray.');
      const idleOver = s.dailyRecords.reduce((acc, r) => acc + r.idleOverbreak, 0);
      if (idleOver > 0) overbreakTypes.push('IDLE');
      const typesStr = overbreakTypes.length > 0 ? overbreakTypes.join(', ') : 'None';

      return [
        s.employeeName,
        `${Math.floor(s.totalWorkMinutes / 60)}h ${s.totalWorkMinutes % 60}m`,
        `${s.totalBreakMinutes}m`,
        typesStr,
        `${s.totalOverbreakMinutes}m`,
        s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
        s.wcAlerts > 0 ? `${s.wcAlerts} alerts` : 'None'
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

  doc.save(`${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}
