import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parse, isValid, parseISO } from 'date-fns';
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
  isRa?: boolean;
  isAt?: boolean;
  isOverbreaks?: boolean;
  isCheck?: boolean;
  isAgentDetail?: boolean;
  statusFiltersText?: string;
  activeExtraStatus?: string | null;
  attrKey?: string | null;
  totalAgentsCount?: number;
  affectedAgentsCount?: number;
  periodFilter?: string;
  lang?: Language;
  teamProductiveMinutes?: number;
  teamNonModMinutes?: number;
  showAllTimeline?: boolean;
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
  
  let dateSubtitle = '';
  let allDates = summaries.flatMap(s => s.dailyRecords.map(r => r.date))
      .filter(Boolean)
      .sort((a,b) => a.localeCompare(b));
  
  if (allDates.length > 0) {
      const minDateStr = allDates[0];
      const maxDateStr = allDates[allDates.length - 1];
      
      const minD = parse(minDateStr, 'yyyy-MM-dd', new Date());
      const maxD = parse(maxDateStr, 'yyyy-MM-dd', new Date());
       
      if (minDateStr === maxDateStr) {
          dateSubtitle = lang === 'pt' ? `Relatório do dia ${format(minD, 'dd/MM/yyyy')}` : `Report for ${format(minD, 'MM/dd/yyyy')}`;
      } else {
          if (lang === 'pt') {
              dateSubtitle = `Relatório do dia ${format(minD, 'dd/MM/yyyy')} ao dia ${format(maxD, 'dd/MM/yyyy')}`;
          } else {
              dateSubtitle = `Report from ${format(minD, 'MM/dd/yyyy')} to ${format(maxD, 'MM/dd/yyyy')}`;
          }
      }
  }

  let startYPos = 40;
  if (dateSubtitle) {
      doc.setFontSize(12);
      doc.setTextColor(50);
      doc.text(dateSubtitle, 14, 38);
      startYPos = 48;
  }
  
  if (options.statusFiltersText) {
      doc.setFontSize(11);
      doc.setTextColor(50);
      doc.text(options.statusFiltersText, 14, startYPos - 2);
      startYPos += 8;
  }

  if (options.totalAgentsCount !== undefined && options.affectedAgentsCount !== undefined) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${t('totalAgentsPeriod')}: ${options.totalAgentsCount}`, 14, startYPos - 2);
    doc.text(`${t('affectedAgents')}: ${options.affectedAgentsCount}`, 14, startYPos + 6);
    startYPos += 14;
  }
  
  if (options.teamProductiveMinutes !== undefined && options.teamNonModMinutes !== undefined && (options.isNonMod || options.isRa || options.isAt)) {
      const prodTotalHours = Math.floor(options.teamProductiveMinutes / 60);
      const prodTotalMins = options.teamProductiveMinutes % 60;
      const nonModPct = options.teamProductiveMinutes > 0 ? ((options.teamNonModMinutes / options.teamProductiveMinutes) * 100).toFixed(1) : 0;
      
      const prodStr = `${prodTotalHours}h ${prodTotalMins}m`;
      const nonModStr = `${options.teamNonModMinutes}m`;
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      
      doc.text(`${lang === 'pt' ? 'Tempo produtivo da equipe' : 'Team productive time'}: ${prodStr}  |  ${lang === 'pt' ? 'Total non-moderating da equipe' : 'Team total non-moderating'}: ${nonModStr} (${nonModPct}%)`, 14, startYPos);
      startYPos += 8;
  }

  if (options.isAgentDetail) {
    let nextY = startYPos;

    summaries.forEach((s, index) => {
        if (index > 0) {
            doc.addPage();
            nextY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(s.email ? `${s.employeeName} (${s.email})` : s.employeeName, 14, nextY);
        doc.setFont('helvetica', 'normal');
        nextY += 4;
        
        doc.setDrawColor(220, 220, 220);
        doc.line(14, nextY, doc.internal.pageSize.getWidth() - 14, nextY);
        nextY += 6;

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

        const isNonModOnlyMode = options.isNonMod || options.isRa || options.isAt;

        let head1Raw;
        let tableData1Row;

        if (isNonModOnlyMode) {
          const nonModTotal = Math.round(s.dailyRecords.reduce((acc, r) => acc + r.breaks.filter(b => {
             if (b.type !== 'non_moderating') return false;
             if (options.isNonMod && !b.subType?.toLowerCase().includes('review') && !b.subType?.toLowerCase().includes('appeal') && !b.subType?.toLowerCase().includes('awaiting task')) return true;
             if (options.isRa && (b.subType?.toLowerCase().includes('review') || b.subType?.toLowerCase().includes('appeal'))) return true;
             if (options.isAt && b.subType?.toLowerCase().includes('awaiting task')) return true;
             return false;
          }).reduce((sum, b) => sum + b.durationMinutes, 0), 0));

          if (options.isRa || options.isAt) {
             head1Raw = [t('pdfWorkTime'), lang === 'pt' ? 'Tempo total em non-moderating' : 'Total non-moderating time'];
             tableData1Row = [
               `${Math.floor(totalModeratingMinutes / 60)}h ${totalModeratingMinutes % 60}m`,
               `${nonModTotal}m`
             ];
             head1Raw.push(t('pdfOverbreakTime'), t('pdfWcTime'), t('pdfWcAlerts'));
             tableData1Row.push(
                `${s.totalOverbreakMinutes}m`,
                s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
                s.wcAlerts > 0 ? `${s.wcAlerts} ${t('pdfAlerts')}` : t('pdfNone')
             );
          } else {
             head1Raw = [t('pdfWorkTime'), lang === 'pt' ? 'Tempo total em non-moderating' : 'Total non-moderating time', t('pdfTotalBreaks'), t('pdfOverbreakTypes')];
             tableData1Row = [
               `${Math.floor(totalModeratingMinutes / 60)}h ${totalModeratingMinutes % 60}m`,
               `${nonModTotal}m`,
               `${s.totalBreakMinutes}m`,
               typesStr
             ];
             head1Raw.push(t('pdfOverbreakTime'), t('pdfWcTime'), t('pdfWcAlerts'));
             tableData1Row.push(
                `${s.totalOverbreakMinutes}m`,
                s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
                s.wcAlerts > 0 ? `${s.wcAlerts} ${t('pdfAlerts')}` : t('pdfNone')
             );
          }
        } else {
          head1Raw = [t('pdfWorkTime'), t('pdfTotalBreaks'), t('pdfOverbreakTypes')];
          tableData1Row = [
            `${Math.floor(totalModeratingMinutes / 60)}h ${totalModeratingMinutes % 60}m`,
            `${s.totalBreakMinutes}m`,
            typesStr
          ];
          
          head1Raw.push(t('pdfOverbreakTime'), t('pdfWcTime'), t('pdfWcAlerts'));
          tableData1Row.push(
            `${s.totalOverbreakMinutes}m`,
            s.wcTotalMinutes > 0 ? `${s.wcTotalMinutes}m` : '0m',
            s.wcAlerts > 0 ? `${s.wcAlerts} ${t('pdfAlerts')}` : t('pdfNone')
          );
        }
        
        const head1 = [head1Raw];
        const tableData1 = [tableData1Row];

        autoTable(doc, {
          startY: nextY,
          head: head1,
          body: tableData1,
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          didParseCell: function (data) {
            if (data.section === 'body' && !isNonModOnlyMode) {
              const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
              if (data.column.index === 3 && textStr && textStr !== '0m') {
                data.cell.styles.fillColor = [220, 38, 38];
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = 'bold';
              }
              if (data.column.index === 4 && textStr && textStr !== '0m') {
                 data.cell.styles.fillColor = [217, 119, 6];
                 data.cell.styles.textColor = [0, 0, 0];
                 data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });

        nextY = (doc as any).lastAutoTable.finalY + 10;

        const records = [...s.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
        
        const hasSpecificBreakFilter = options.isWc || options.isIdle || options.isNonMod || options.isShort30Min || options.isRa || options.isAt;
        const isOverbreakGeneral = !hasSpecificBreakFilter && !options.isTardiness && !options.isMinorTardiness && !options.isEarlyLeave && !options.isAbsences && !options.isCheck && !options.activeExtraStatus;

        records.forEach((r, rIdx) => {
            const sortedBreaks = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)));
            
            let allowedConsumed: Record<string, number> = { 'meal': 0, 'short': 0, 'wellness': 0, 'praying': 0, 'wc': 0, 'idle': 0 };
            let allowedLimits: Record<string, number> = {
                'meal': r.mealDuration - r.mealOverbreak,
                'short': r.shortDuration - r.shortOverbreak,
                'wellness': r.wellnessDuration - r.wellnessOverbreak,
                'praying': r.prayingDuration - r.prayingOverbreak,
                'wc': r.wcDuration - r.wcOverbreak,
                'idle': 0
            };

            const dayTableData: any[][] = [];

            sortedBreaks.forEach(b => {
                 let typeKey = b.type;
                 if (typeKey === 'forgot_status') typeKey = 'idle';

                 let isOverbreakInstance = false;
                 let dispText = '-';

                 if (typeKey in allowedLimits) {
                     const allowedLimit = allowedLimits[typeKey];
                     const currentConsumed = allowedConsumed[typeKey];
                     const newConsumed = currentConsumed + b.durationMinutes;

                     if (newConsumed > allowedLimit) {
                         isOverbreakInstance = true;
                         const increment = Math.min(b.durationMinutes, newConsumed - Math.max(allowedLimit, currentConsumed));
                         if (increment > 0) dispText = `+${increment}m`;
                     }
                     
                     if (options.isShort30Min && b.type === 'short') {
                         isOverbreakInstance = true;
                         if (dispText === '-') dispText = `${b.durationMinutes}m`;
                     }
                     allowedConsumed[typeKey] = newConsumed;
                 } else if (b.type === 'non_moderating' && r.nonModDuration > 0) {
                     // Non-moderating should just show its total duration, not as an overbreak
                     // and we don't put anything in dispText (exceeded) since it's not an overbreak
                 }

                 let matchesFilter = false;

                 if (options.isOverbreaks && (b.type === 'meal' || b.type === 'wellness' || b.type === 'praying' || b.type === 'short') && isOverbreakInstance) {
                     matchesFilter = true;
                 }
                 if (options.isShort30Min && b.type === 'short' && isOverbreakInstance) {
                     matchesFilter = true;
                 }
                 if (options.isWc && b.type === 'wc' && isOverbreakInstance) {
                     matchesFilter = true;
                 }
                 if (options.isIdle && typeKey === 'idle' && isOverbreakInstance) {
                     matchesFilter = true;
                 }
                 if (options.isNonMod && b.type === 'non_moderating' && !b.subType?.toLowerCase().includes('review') && !b.subType?.toLowerCase().includes('appeal') && !b.subType?.toLowerCase().includes('awaiting task')) {
                     matchesFilter = true;
                 }
                 if (options.isRa && b.type === 'non_moderating' && (b.subType?.toLowerCase().includes('review') || b.subType?.toLowerCase().includes('appeal'))) {
                     matchesFilter = true;
                 }
                 if (options.isAt && b.type === 'non_moderating' && b.subType?.toLowerCase().includes('awaiting task')) {
                     matchesFilter = true;
                 }
                 
                 let noSpecificFilter = !options.isOverbreaks && !options.isWc && !options.isIdle && !options.isNonMod && !options.isShort30Min && !options.isRa && !options.isAt;
                 
                 if (noSpecificFilter) {
                     matchesFilter = true;
                 }

                 if (!matchesFilter) {
                     isOverbreakInstance = false;
                 }

                 let shouldShow = options.showAllTimeline || false;
                 if (!options.showAllTimeline) {
                     if (hasSpecificBreakFilter || options.isOverbreaks) {
                         shouldShow = matchesFilter && (isOverbreakInstance || (b.type === 'non_moderating' && (options.isNonMod || options.isRa || options.isAt)));
                     } else if (isOverbreakGeneral) {
                         shouldShow = (isOverbreakInstance && dispText !== '-');
                     } else {
                         // For check/tardiness/early leave tabs, show all to give context of the day
                         shouldShow = true;
                     }
                 }

                 if (shouldShow) {
                     let label: string = b.type;
                     if (b.type === 'other') label = b.rawStatus || b.type;
                     else if (b.type === 'forgot_status') label = 'IDLE';
                     else if (b.type === 'non_moderating' && b.subType) label = b.subType;
                     else if (b.type === 'wc') label = 'ORGANIC';

                     dayTableData.push([
                         label.toUpperCase(),
                         b.startTime ? format(new Date(b.startTime), 'HH:mm') : '-',
                         b.endTime ? format(new Date(b.endTime), 'HH:mm') : '-',
                         `${b.durationMinutes}m`,
                         dispText
                     ]);
                 }
            });

            if (dayTableData.length > 0) {
                nextY += 8;

                if (nextY > 270) {
                     doc.addPage();
                     nextY = 20;
                }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text(`${r.date}   |   ${lang === 'pt' ? 'Escala' : 'Shift'}: ${r.scheduledShift || r.inferredShift || t('pdfUnknown')}`, 14, nextY);
                doc.setFont('helvetica', 'normal');
                nextY += 3;

                const headDailyRow = [t('pdfStatus'), t('pdfStartedAt'), t('pdfActualEnd'), lang === 'pt' ? 'Duração (m)' : 'Duration (m)'];
                
                const isNonModOnlyMode = options.isNonMod || options.isRa || options.isAt;
                
                if (!isNonModOnlyMode) {
                   headDailyRow.push(lang === 'pt' ? 'Excedido' : 'Exceeded');
                }
                
                const finalDayTableData = dayTableData.map(row => {
                   if (isNonModOnlyMode) {
                      return row.slice(0, 4);
                   }
                   return row;
                });

                const headDaily = [headDailyRow];

                autoTable(doc, {
                  startY: nextY,
                  head: headDaily,
                  body: finalDayTableData,
                  headStyles: { fillColor: [79, 70, 229], textColor: 255 },
                  alternateRowStyles: { fillColor: [250, 250, 250] },
                  didParseCell: function(data) {
                      if (data.section === 'body' && !isNonModOnlyMode) {
                          const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
                          if (data.column.index === 4 && textStr && textStr !== '-') {
                              const statusCellStr = Array.isArray(data.row.cells[0].text) ? data.row.cells[0].text[0] : data.row.cells[0].text;
                              if (statusCellStr === 'ORGANIC') {
                                  data.cell.styles.fillColor = [217, 119, 6];
                                  data.cell.styles.textColor = [255, 255, 255];
                                  data.cell.styles.fontStyle = 'bold';
                              } else if (statusCellStr === 'NON-MOD' || statusCellStr === 'NON_MODERATING' || statusCellStr.includes('REVIEW') || statusCellStr.includes('APPEAL')) {
                                  // Do not apply red highlighting for non-moderating items
                              } else {
                                  data.cell.styles.fillColor = [220, 38, 38];
                                  data.cell.styles.textColor = [255, 255, 255];
                                  data.cell.styles.fontStyle = 'bold';
                              }
                          }

                          if (data.column.index === 0) {
                              if (textStr === 'MODERATING') {
                                  data.cell.styles.textColor = [34, 197, 94];
                                  data.cell.styles.fontStyle = 'bold';
                              } else if (textStr === 'IDLE' || textStr === 'FORGOT_STATUS') {
                                  data.cell.styles.textColor = [220, 38, 38];
                                  data.cell.styles.fontStyle = 'bold';
                              } else if (textStr === 'ORGANIC') {
                                  data.cell.styles.textColor = [217, 119, 6];
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
                nextY = (doc as any).lastAutoTable.finalY;
            }
        });
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
          s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
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
          s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
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
          s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
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
          s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
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
          s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
          r.date,
          options.activeExtraStatus
        ]);
      });
    });
  } else {
    const isNonModOnlyMode = options.isNonMod || options.isRa || options.isAt;

    const headRow = [
      t('pdfAgent'),
      t('pdfDate'),
      t('pdfStatus'),
      t('pdfStartedAt'),
      t('pdfActualEnd'),
      lang === 'pt' ? 'Duração (m)' : 'Duration (m)',
    ];

    if (!isNonModOnlyMode) {
      headRow.push(lang === 'pt' ? 'Excedido' : 'Exceeded');
    }

    head = [headRow];

    summaries.filter(s => s.totalOverbreakMinutes > 0 || s.wcAlerts > 0 || s.idleAlerts > 0 || s.totalForgotStatusMinutes > 0 || (options.isShort30Min && (s.totalShort30MinRecords || 0) > 0)).forEach(s => {
      s.dailyRecords.forEach(r => {
        const sortedBreaks = [...r.breaks].sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)));
        
        let allowedConsumed: Record<string, number> = {
            'meal': 0,
            'short': 0,
            'wellness': 0,
            'praying': 0,
            'wc': 0,
            'idle': 0
        };
        let allowedLimits: Record<string, number> = {
            'meal': r.mealDuration - r.mealOverbreak,
            'short': r.shortDuration - r.shortOverbreak,
            'wellness': r.wellnessDuration - r.wellnessOverbreak,
            'praying': r.prayingDuration - r.prayingOverbreak,
            'wc': r.wcDuration - r.wcOverbreak,
            'idle': 0
        };

        sortedBreaks.forEach(b => {
           let typeKey = b.type;
           if (typeKey === 'forgot_status') typeKey = 'idle';

           let isOverbreakInstance = false;
           let dispText = '-';

           if (typeKey in allowedLimits) {
               const allowedLimit = allowedLimits[typeKey];
               const currentConsumed = allowedConsumed[typeKey];
               const newConsumed = currentConsumed + b.durationMinutes;

               if (newConsumed > allowedLimit) {
                   isOverbreakInstance = true;
                   const increment = Math.min(b.durationMinutes, newConsumed - Math.max(allowedLimit, currentConsumed));
                   if (increment > 0) {
                       dispText = `+${increment}m`;
                   }
               }
               
               // Special case when we want to display the break in the Short30Min report even if it wasn't an overbreak
               if (options.isShort30Min && b.type === 'short') {
                   isOverbreakInstance = true;
                   if (dispText === '-') {
                       dispText = `${b.durationMinutes}m`;
                   }
               }
               
               allowedConsumed[typeKey] = newConsumed;
           } else if (b.type === 'non_moderating' && r.nonModDuration > 0) {
               // Non-moderating should just show its total duration, not as an overbreak
               // and we don't put anything in dispText (exceeded) since it's not an overbreak
           }

           let matchesFilter = false;

           if (options.isOverbreaks && (b.type === 'meal' || b.type === 'wellness' || b.type === 'praying' || b.type === 'short') && isOverbreakInstance) {
               matchesFilter = true;
           }
           if (options.isShort30Min && b.type === 'short' && isOverbreakInstance) {
               matchesFilter = true;
           }
           if (options.isWc && b.type === 'wc' && isOverbreakInstance) {
               matchesFilter = true;
           }
           if (options.isIdle && typeKey === 'idle' && isOverbreakInstance) {
               matchesFilter = true;
           }
           if (options.isNonMod && b.type === 'non_moderating') {
               matchesFilter = true;
           }
           
           let noSpecificFilter = !options.isOverbreaks && !options.isWc && !options.isIdle && !options.isNonMod && !options.isShort30Min;
           
           if (noSpecificFilter) {
               matchesFilter = true;
           }

           if (!matchesFilter) {
               isOverbreakInstance = false;
           }

           if (matchesFilter && (isOverbreakInstance || (b.type === 'non_moderating' && options.isNonMod))) {
               let label: string = b.type;
               if (b.type === 'other') label = b.rawStatus || b.type;
               else if (b.type === 'forgot_status') label = 'IDLE';
               else if (b.type === 'non_moderating' && b.subType) label = b.subType;
               else if (b.type === 'wc') label = 'ORGANIC';

               const rowData = [
                   s.email ? `${s.employeeName} (${s.email})` : s.employeeName,
                   r.date,
                   label.toUpperCase(),
                   b.startTime ? format(new Date(b.startTime), 'HH:mm') : '-',
                   b.endTime ? format(new Date(b.endTime), 'HH:mm') : '-',
                   `${b.durationMinutes}m`
               ];
               
               if (!(options.isNonMod || options.isRa || options.isAt)) {
                   rowData.push(dispText);
               }

               tableData.push(rowData);
           }
        });
      });
    });
  }

  let lastAgentName = '';
  let agentBgColor = false;
  tableData.forEach((row: any) => {
    if (row[0] === lastAgentName) {
      row[0] = '';
    } else {
      lastAgentName = String(row[0]);
      agentBgColor = !agentBgColor;
    }
    row._bg = agentBgColor;
  });

  autoTable(doc, {
    startY: startYPos,
    head: head,
    body: tableData,
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      1: { minCellWidth: 24 } // Date
    },
    didDrawCell: function (data) {
      if (data.section === 'body' && data.row.index > 0) {
        if (data.row.raw[0] !== '') {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
        }
      }
    },
    didParseCell: function (data) {
      if (data.section === 'body') {
        const rowRaw = data.row.raw as any;
        if (rowRaw._bg) {
            data.cell.styles.fillColor = [250, 250, 250];
        } else {
            data.cell.styles.fillColor = [255, 255, 255];
        }

        if (data.column.index === 1) {
            data.cell.styles.minCellWidth = 24;
        }
        if ((options.isTardiness || options.isMinorTardiness || options.isEarlyLeave) && (data.column.index === 2 || data.column.index === 3)) {
            data.cell.styles.minCellWidth = 24;
        }

        if (!options.isTardiness && !options.isMinorTardiness && !options.isEarlyLeave && !options.isAbsences && !options.isCheck && !options.activeExtraStatus) {
          const textStr = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
          
          if (!options.isNonMod && !options.isRa && !options.isAt && data.column.index === 6 && textStr && textStr !== '-') {
            const statusCellStr = Array.isArray(data.row.cells[2].text) ? data.row.cells[2].text[0] : data.row.cells[2].text;
            if (statusCellStr === 'ORGANIC') {
              data.cell.styles.fillColor = [217, 119, 6];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            } else if (statusCellStr === 'NON-MOD' || statusCellStr === 'NON_MODERATING' || statusCellStr.includes('REVIEW') || statusCellStr.includes('APPEAL')) {
              // Do not apply red highlighting for non-moderating items
            } else {
              data.cell.styles.fillColor = [220, 38, 38];
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          
          if (data.column.index === 2) {
             if (textStr === 'ORGANIC') {
                data.cell.styles.textColor = [217, 119, 6];
                data.cell.styles.fontStyle = 'bold';
             } else if (textStr === 'IDLE' || textStr === 'FORGOT_STATUS') {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
             }
          }
        }
      }
    }
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
