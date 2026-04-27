import * as XLSX from 'xlsx';
import { differenceInMinutes, parse, format, isValid } from 'date-fns';
import { EmployeeDayRecord, BreakSession, EmployeeSummary } from '../types';

const LIMITS = {
  MEAL: 60,
  SHORT: 30,
  WELLNESS: 15,
  PRAYING: 15,
  WC: 10,
};

// Keywords for WC mapping
const WC_KEYWORDS = [
  'bath', 'bathrom', 'bathroom', 'bathroom break', 'bathroom emegency', 
  'bathroom emergency', 'bathroom quick', 'batroom', 'o b', 'ob', 
  'organic', 'organic break', 'emergency bathroom break', 'emergency wc break', 
  'ewc', 'restroom', 'toilet', 'toilet break', 'toillet', 'wc'
];

export async function parseExcelFile(file: File): Promise<EmployeeSummary[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header: 1 to get raw array of arrays
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length <= 1) {
          resolve([]);
          return;
        }

        const employeeMap = new Map<string, any[][]>();

        // Skip header row
        rawData.slice(1).forEach(row => {
          if (!row || row.length < 8) return;
          
          let date = '';
          if (row[0] instanceof Date) {
            date = format(row[0], 'yyyy-MM-dd');
          } else if (typeof row[0] === 'number') {
            if (row[0] > 100000) {
              date = format(new Date(row[0]), 'yyyy-MM-dd');
            } else {
              const d = new Date(Math.round((row[0] - 25569) * 86400 * 1000));
              d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
              date = format(d, 'yyyy-MM-dd');
            }
          } else if (row[0]) {
            const dateStr = String(row[0]).trim();
            const parts = dateStr.split(/[\/\-]/);
            if (parts.length === 3) {
                let p1 = parseInt(parts[0], 10);
                let p2 = parseInt(parts[1], 10);
                let p3 = parseInt(parts[2], 10);
                let year = p3 > 100 ? p3 : (p1 > 100 ? p1 : p3);
                if (year < 100) year += 2000;
                let month = p2;
                let day = p1 > 100 ? p3 : p1;
                if (day <= 12 && month > 12) {
                    const temp = month;
                    month = day;
                    day = temp;
                }
                date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            } else {
              try { 
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) date = format(d, 'yyyy-MM-dd');
              } catch {}
            }
          }

          const email = String(row[1] || '').toLowerCase();
          if (!email || !email.includes('@')) return; 
          
          const namePart = email.split('@')[0];
          const name = namePart.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ').replace(/[0-9]/g, '').trim();

          row.push(name); 
          row.push(email); 
          row[0] = date; // ensure date is correctly formatted string in position 0

          if (!employeeMap.has(email)) {
            employeeMap.set(email, []);
          }
          employeeMap.get(email)!.push(row);
        });

        const summaries: EmployeeSummary[] = [];

        employeeMap.forEach((allRows, _email) => {
          const dailyRecords: EmployeeDayRecord[] = [];
          let totalWorkMinutes = 0;
          let totalBreakMinutes = 0;
          let totalOverbreakMinutes = 0;
          let wcAlertsCount = 0;
          let idleAlertsCount = 0;
          
          let finalName = '';
          let finalDepartment = '';
          let finalEmail = _email;

          // Process all rows into timeline events for this employee
          const allEvents = allRows.map(row => {
             const date = String(row[0] || '');
             const employeeName = row[row.length - 2];
             
             const status = String(row[3] || '').trim().toLowerCase();
             const subStatus = String(row[4] || '').trim().toLowerCase();
             const remarks = String(row[5] || '').trim().toLowerCase();
             
             const durationHours = isNaN(Number(row[6])) ? 0 : Number(row[6]);
             const durationMinutes = Math.round(durationHours * 60);
             
             const rawInfo = String(row[3] || '') + ' ' + String(row[4] || '');
             
             const baseDateArgs = date.split('-').map(Number);
             const baseDate = baseDateArgs.length === 3 ? new Date(baseDateArgs[0], baseDateArgs[1] - 1, baseDateArgs[2]) : new Date();

             let startTime = parseTime(date, row[7]);
             if (!startTime) {
                startTime = new Date(baseDate);
                startTime.setHours(0,0,0,0);
             }
             let endTime = parseTime(date, row[8]);
             if (endTime && durationMinutes > 0) {
                 const diffMins = (endTime.getTime() - startTime.getTime()) / 60000;
                 if (diffMins < 0 || Math.abs(diffMins - durationMinutes) > 60) {
                     endTime = new Date(startTime.getTime() + durationMinutes * 60000);
                 }
             } else if (!endTime) {
                endTime = new Date(startTime.getTime() + durationMinutes * 60000);
             } else if (endTime < startTime) {
                // Only wrap if it represents a realistic shift or break across midnight
                const wrappedDuration = (endTime.getTime() + 86400000 - startTime.getTime()) / 60000;
                if (wrappedDuration <= 16 * 60) {
                    endTime.setDate(endTime.getDate() + 1);
                } else {
                    // It's a typo. E.g., 13:05 to 09:11. We ignore the bad end time.
                    endTime = new Date(startTime.getTime() + durationMinutes * 60000);
                }
             }

             return { date, employeeName, department: String(row[2] || ''), status, subStatus, remarks, rawInfo, durationMinutes, startTime, endTime, row };
          }).sort((a,b) => a.startTime.getTime() - b.startTime.getTime());

          if (allEvents.length === 0) return;
          
          finalName = finalEmail.split('@')[0];
          finalDepartment = allEvents[0].department;

          const isTraining = finalDepartment.toLowerCase().includes('training') || finalEmail.toLowerCase().includes('training');

          // Break into logical shifts
          const shifts: { records: any[][], firstEventTime: Date }[] = [];
          let currentShift: any[] = [];
          let currentShiftStart: Date | null = null;

          allEvents.forEach(e => {
              // A new shift starts if there's a gap of more than 14 hours (840 minutes) 
              // from the START of the current shift.
              if (currentShiftStart) {
                  const hoursFromStart = (e.startTime.getTime() - currentShiftStart.getTime()) / 3600000;
                  if (hoursFromStart > 14) {
                      shifts.push({ records: currentShift, firstEventTime: currentShiftStart });
                      currentShift = [];
                      currentShiftStart = null;
                  }
              }
              
              if (!currentShiftStart) {
                  currentShiftStart = e.startTime;
              }
              currentShift.push(e.row);
          });
          if (currentShift.length > 0 && currentShiftStart) {
             shifts.push({ records: currentShift, firstEventTime: currentShiftStart });
          }

          shifts.forEach(shiftInfo => {
             const shiftRows = shiftInfo.records;
             // Date of the shift is based on the first event time
             const firstRowDate = format(shiftInfo.firstEventTime, 'yyyy-MM-dd'); 
             const record = processDailyRowsFromColumns(firstRowDate, shiftRows);
             
             if (record.breaks.length > 0 || record.totalWorkTimeMillis > 0) {
              dailyRecords.push(record);
              totalWorkMinutes += record.totalWorkTimeMillis / (1000 * 60);
              totalBreakMinutes += (record.mealDuration + record.shortDuration + record.wellnessDuration + record.wcDuration + record.prayingDuration + record.idleDuration);
              totalOverbreakMinutes += record.totalOverbreak;
              if (record.wcDuration > LIMITS.WC) wcAlertsCount++;
              if (record.idleDuration > 0) idleAlertsCount++;
             }
          });

          if (dailyRecords.length > 0) {
            summaries.push({
              employeeName: finalName || 'Unknown',
              email: finalEmail,
              department: finalDepartment,
              isTraining,
              totalWorkMinutes: Math.round(totalWorkMinutes),
              totalBreakMinutes: Math.round(totalBreakMinutes),
              totalOverbreakMinutes: Math.round(totalOverbreakMinutes),
              wcAlerts: wcAlertsCount,
              idleAlerts: idleAlertsCount,
              dailyRecords: dailyRecords.sort((a,b) => a.date.localeCompare(b.date))
            });
          }
        });

        resolve(summaries);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

const SHIFTS = [
  { startHour: 7, startMinute: 0, endHour: 16, endMinute: 0, label: 'Morning (07:00-16:00)' },
  { startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, label: 'Morning (08:00-17:00)' },
  { startHour: 14, startMinute: 0, endHour: 23, endMinute: 0, label: 'Late (14:00-23:00)' },
  { startHour: 22, startMinute: 30, endHour: 7, endMinute: 30, label: 'Nightshift (22:30-07:30)', crossesMidnight: true }
];

function processDailyRowsFromColumns(date: string, rows: any[][]): EmployeeDayRecord {
  const breaks: BreakSession[] = [];
  let totalWorkTimeMillis = 0;
  
  let employeeName = '';
  
  // Base date parsing for fallback
  const [year, month, day] = date.split('-').map(Number);
  const baseDate = year && month && day ? new Date(year, month - 1, day) : new Date();

  // 1. Initial Parse and extract
  const events = rows.map(row => {
    if (row.length === 0) return null;
    employeeName = row[row.length - 2];
    
    const status = String(row[3] || '').trim().toLowerCase();
    const subStatus = String(row[4] || '').trim().toLowerCase();
    const remarks = String(row[5] || '').trim().toLowerCase();
    
    const durationHours = isNaN(Number(row[6])) ? 0 : Number(row[6]);
    const durationMinutes = Math.round(durationHours * 60);
    
    let startTime = parseTime(date, row[7]);
    if (!startTime) {
       startTime = new Date(baseDate);
       startTime.setHours(0,0,0,0);
    }
    let endTime = parseTime(date, row[8]);
    if (endTime && durationMinutes > 0) {
        const diffMins = (endTime.getTime() - startTime.getTime()) / 60000;
        if (diffMins < 0 || Math.abs(diffMins - durationMinutes) > 60) {
            endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        }
    } else if (!endTime) {
       endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    } else if (endTime < startTime) {
        const wrappedDuration = (endTime.getTime() + 86400000 - startTime.getTime()) / 60000;
        if (wrappedDuration <= 16 * 60) {
            endTime.setDate(endTime.getDate() + 1);
        } else {
            // It's a typo. E.g., 13:05 to 09:11. We ignore the bad end time.
            endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        }
    }

    return { status, subStatus, remarks, durationMinutes, startTime, endTime, rawInfo: String(row[3] || '') + ' ' + String(row[4] || '') };
  }).filter(e => e !== null) as any[];

  if (events.length === 0) {
      return {
        date, employeeName: employeeName || 'Unknown', totalWorkTimeMillis: 0, breaks: [],
        mealDuration: 0, shortDuration: 0, wellnessDuration: 0, wcDuration: 0, prayingDuration: 0, idleDuration: 0,
        mealOverbreak: 0, shortOverbreak: 0, wellnessOverbreak: 0, prayingOverbreak: 0, wcOverbreak: 0, idleOverbreak: 0, totalOverbreak: 0
      };
  }

  // 2. Identify Shift
  const minWorkTime = events.reduce((min, e) => (e.startTime < min ? e.startTime : min), events[0].startTime);

  let closestShift = SHIFTS[0];
  let minDiff = Infinity;
  SHIFTS.forEach(shift => {
    // Check diff against today's shift start
    const d = new Date(minWorkTime);
    d.setHours(shift.startHour, shift.startMinute, 0, 0);
    let diff = Math.abs(d.getTime() - minWorkTime.getTime());
    
    // Check diff against yesterday's shift start (relevant for early morning logs belonging to nightshift)
    const dYesterday = new Date(minWorkTime);
    dYesterday.setDate(dYesterday.getDate() - 1);
    dYesterday.setHours(shift.startHour, shift.startMinute, 0, 0);
    const diffYesterday = Math.abs(dYesterday.getTime() - minWorkTime.getTime());
    
    diff = Math.min(diff, diffYesterday);

    if (diff < minDiff) {
       minDiff = diff;
       closestShift = shift;
    }
  });

  const shiftStartLimit = new Date(minWorkTime);
  shiftStartLimit.setHours(closestShift.startHour, closestShift.startMinute, 0, 0);
  // If the first event is well before the shift start limit today, 
  // it means the shift actually started yesterday.
  if (minWorkTime.getTime() < shiftStartLimit.getTime() - 6 * 3600000) {
     shiftStartLimit.setDate(shiftStartLimit.getDate() - 1);
  }
  
  const shiftEndLimit = new Date(shiftStartLimit);
  if (closestShift.crossesMidnight) {
    shiftEndLimit.setDate(shiftEndLimit.getDate() + 1);
  } else {
    // Since we handle both crossed and uncrossed shifts, ensure end is after start
    // Morning shifts don't cross, but Late shifts might slightly cross or night shifts definitely do.
  }
  shiftEndLimit.setHours(closestShift.endHour, closestShift.endMinute, 0, 0);
  if (shiftEndLimit.getTime() <= shiftStartLimit.getTime()) {
      shiftEndLimit.setDate(shiftEndLimit.getDate() + 1);
  }
  
  const shiftEndPlus10 = new Date(shiftEndLimit.getTime() + 10 * 60000);

  // 3. Process Events
  events.forEach(e => {
    const combinedInfo = `${e.status} ${e.subStatus} ${e.remarks}`.toLowerCase();
    
    let isWork = false;
    if (e.status.includes('trabalho') || e.status.includes('work') || e.status.includes('available') || e.status.includes('on queue') || e.status.includes('em chamada') || e.status.includes('in call') || e.status.includes('moderat') || combinedInfo.includes('non-moderat')) {
       isWork = true;
       totalWorkTimeMillis += e.durationMinutes * 60 * 1000;
    } 

    if (!isWork || combinedInfo.includes('moderat') || combinedInfo.includes('non-moderat') || combinedInfo.includes('meeting') || combinedInfo.includes('training')) {
       let currentBreakType: BreakSession['type'] = 'other';
       
       if (e.startTime > shiftEndPlus10) {
           currentBreakType = 'forgot_status';
       } else if (combinedInfo.includes('non-moderat')) {
           currentBreakType = 'non_moderating';
       } else if (combinedInfo.includes('moderat')) {
           currentBreakType = 'moderating';
       } else if (combinedInfo.includes('training') || combinedInfo.includes('treinamento')) {
           currentBreakType = 'training';
       } else if (combinedInfo.includes('meeting') || combinedInfo.includes('reunião') || combinedInfo.includes('reuniao')) {
           currentBreakType = 'meeting';
       } else if (combinedInfo.includes('meal') || combinedInfo.includes('almoço')) {
           currentBreakType = 'meal';
       } else if (WC_KEYWORDS.some(k => combinedInfo.includes(k) || combinedInfo === k)) {
           currentBreakType = 'wc';
       } else if (combinedInfo.includes('praying') || combinedInfo.includes('oracao') || combinedInfo.includes('oração') || combinedInfo.includes('reza') || combinedInfo.includes('rezar')) {
           currentBreakType = 'praying';
       } else if (combinedInfo.includes('offline') || combinedInfo === 'off' || combinedInfo.includes('deslogado') || combinedInfo.includes('fim')) {
           currentBreakType = 'offline';
       } else if (combinedInfo.includes('idle') || combinedInfo.includes('inativo') || combinedInfo.includes('ocioso') || combinedInfo.includes('sem atividade')) {
           currentBreakType = 'idle';
       } else if (combinedInfo.includes('wellness') || combinedInfo.includes('bem-estar') || combinedInfo.includes('bem estar')) {
           currentBreakType = 'wellness';
       } else if (combinedInfo.includes('short') || combinedInfo.includes('pausa')) {
           currentBreakType = 'short';
       }
       
       // If the duration is impossibly long (> 3 hours), they forgot to change status. Reclassify to avoid breaking metrics.
       if (e.durationMinutes > 180 && currentBreakType !== 'offline' && currentBreakType !== 'idle' && currentBreakType !== 'moderating' && currentBreakType !== 'non_moderating') {
           currentBreakType = 'forgot_status';
       }

       // Handle long events spanning past shift end
       if (e.endTime > shiftEndPlus10) {
           const durationInside = Math.max(0, (shiftEndLimit.getTime() - e.startTime.getTime()) / 60000);
           const durationOutside = Math.max(0, (e.endTime.getTime() - Math.max(e.startTime.getTime(), shiftEndLimit.getTime())) / 60000);
           
           const adjustedTypeInside: 'forgot_status' = 'forgot_status';

           if (durationInside > 0 && currentBreakType !== 'offline') {
               breaks.push({
                   type: adjustedTypeInside,
                   rawStatus: e.rawStatus || e.rawInfo?.trim() || '',
                   startTime: e.startTime,
                   endTime: new Date(e.startTime.getTime() + durationInside * 60000),
                   durationMinutes: Math.round(durationInside)
               });
           }
           if (durationOutside > 0 && currentBreakType !== 'offline') {
               breaks.push({
                   type: 'forgot_status',
                   rawStatus: currentBreakType === 'idle' ? 'Forgot to change / Idle' : 'Forgot to change status',
                   startTime: new Date(e.endTime.getTime() - durationOutside * 60000),
                   endTime: e.endTime,
                   durationMinutes: Math.round(durationOutside)
               });
           }
           if (currentBreakType === 'offline') {
               breaks.push({
                   type: currentBreakType,
                   rawStatus: e.rawStatus || e.rawInfo?.trim() || '',
                   startTime: e.startTime,
                   endTime: e.endTime,
                   durationMinutes: e.durationMinutes
               });
           }
       } else {
           breaks.push({
               type: currentBreakType,
               rawStatus: e.rawStatus || e.rawInfo?.trim() || '',
               startTime: e.startTime,
               endTime: e.endTime,
               durationMinutes: e.durationMinutes
           });
       }
    }
  });

  const mealDuration = breaks.filter(b => b.type === 'meal').reduce((sum, b) => sum + b.durationMinutes, 0);
  const shortDuration = breaks.filter(b => b.type === 'short').reduce((sum, b) => sum + b.durationMinutes, 0);
  const wellnessDuration = breaks.filter(b => b.type === 'wellness').reduce((sum, b) => sum + b.durationMinutes, 0);
  const prayingDuration = breaks.filter(b => b.type === 'praying').reduce((sum, b) => sum + b.durationMinutes, 0);
  const wcDuration = breaks.filter(b => b.type === 'wc').reduce((sum, b) => sum + b.durationMinutes, 0);
  const idleDuration = breaks.filter(b => b.type === 'idle').reduce((sum, b) => sum + b.durationMinutes, 0);

  let mealOver = Math.max(0, mealDuration - LIMITS.MEAL);
  let shortOver = Math.max(0, shortDuration - LIMITS.SHORT);
  
  let hasMealWithoutShortAnomaly = false;
  
  if (mealDuration > 70 && shortDuration === 0) { // Using 70m to cover 10m threshold mentioned
      hasMealWithoutShortAnomaly = true;
      mealOver = Math.max(0, mealDuration - (LIMITS.MEAL + LIMITS.SHORT));
  } else if (mealOver > 15 && shortDuration === 0) {
      hasMealWithoutShortAnomaly = true;
      mealOver = Math.max(0, mealDuration - (LIMITS.MEAL + LIMITS.SHORT));
  }

  const wellnessOver = Math.max(0, wellnessDuration - LIMITS.WELLNESS);
  const prayingOver = Math.max(0, prayingDuration - LIMITS.PRAYING);
  const wcOver = wcDuration > LIMITS.WC ? wcDuration - LIMITS.WC : 0;
  
  const idleOver = idleDuration;
  
  const totalOver = mealOver + shortOver + wellnessOver + prayingOver + idleOver;

  return {
    date,
    employeeName: employeeName || 'Unknown',
    inferredShift: closestShift.label,
    hasMealWithoutShortAnomaly,
    totalWorkTimeMillis,
    breaks,
    mealDuration,
    shortDuration,
    wellnessDuration,
    wcDuration,
    prayingDuration,
    idleDuration,
    mealOverbreak: mealOver,
    shortOverbreak: shortOver,
    wellnessOverbreak: wellnessOver,
    prayingOverbreak: prayingOver,
    wcOverbreak: wcOver,
    idleOverbreak: idleOver,
    totalOverbreak: totalOver
  };
}

function parseTime(dateStr: string, rawTime: any): Date | null {
    if (rawTime === undefined || rawTime === null || rawTime === '') return null;
    
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    let d = new Date(year, month - 1, day);

    if (rawTime instanceof Date) {
        d.setHours(rawTime.getHours(), rawTime.getMinutes(), rawTime.getSeconds(), 0);
        return d;
    }

    if (typeof rawTime === 'number') {
        const fraction = rawTime % 1;
        const totalSeconds = Math.round(fraction * 24 * 3600);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        d.setHours(hours, minutes, seconds, 0);
        return d;
    }
    
    const timeStr = String(rawTime).trim();
    if (/^\d{1,2}:\d{2}/.test(timeStr)) {
        const parts = timeStr.split(':').map(Number);
        d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
        return d;
    }

    const fullParsed = new Date(`${dateStr} ${timeStr}`);
    if (!isNaN(fullParsed.getTime())) return fullParsed;
    
    return null;
}
