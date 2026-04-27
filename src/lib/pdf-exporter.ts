import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { EmployeeSummary } from '../types';

export function exportToPDF(summaries: EmployeeSummary[], title: string = "Breaks Report", filename: string = "breaks_report") {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated at: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  
  const tableData = summaries.map(s => {
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

  autoTable(doc, {
    startY: 40,
    head: [['Agent', 'Work Time', 'Total Breaks', 'Overbreak Types', 'Overbreak Time', 'WC Time', 'WC Alerts']],
    body: tableData,
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: function (data) {
      if (data.section === 'body') {
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
