import * as XLSX from 'xlsx';
import { CalendarData } from '../types';

// Helper to convert Excel date serial to string (dd/MM/yyyy)
function formatExcelDate(excelDate: number): string {
  const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export const parseCalendarFile = async (file: File): Promise<{ data: CalendarData[], note: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const calendarData: CalendarData[] = [];
        const seenNames = new Set<string>();

        const now = new Date();
        const threshold = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        threshold.setHours(0, 0, 0, 0);
        
        let foundNote = '';
        if (workbook.SheetNames.length > 0) {
           const firstSheet = workbook.SheetNames[0];
           const match = firstSheet.split('.');
           if (match.length > 1) {
             foundNote = match[match.length - 1]; // everything after the last dot, e.g., "APR" from "2604.APR"
           } else {
             foundNote = firstSheet; // fallback
           }
        }
        
        // Loop through all sheets
        for (const sheetName of workbook.SheetNames) {
           const worksheet = workbook.Sheets[sheetName];
           
           // parse as array of arrays to handle custom column positions
           const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
           
           if (rows.length === 0) continue;

           // Detect header row inside the first 20 rows
           let headerRowIdx = -1;
           for (let i = 0; i < Math.min(20, rows.length); i++) {
              if (rows[i] && rows[i].length > 4) {
                 const valB = String(rows[i][1]).toLowerCase(); // Name
                 const valF = String(rows[i][5]).trim(); // Col F date string
                 const isDateF = typeof rows[i][5] === 'number' || valF.match(/^\d{1,2}[\/\-]\d{1,2}/) || (!isNaN(Date.parse(valF)) && valF.length > 3);
                 if (valB.includes('nome') || valB.includes('name') || valB.includes('agent') || isDateF) {
                     headerRowIdx = i;
                     if (isDateF || valB.includes('name')) break;
                 }
              }
           }

           if (headerRowIdx !== -1) {
              const headers = rows[headerRowIdx];
              
              for (let i = headerRowIdx + 1; i < rows.length; i++) {
                 const row = rows[i];
                 if (!row || row.length < 2) continue;

                 const name = String(row[1] || '').trim(); // Column B
                 if (!name || name === '' || name.toLowerCase() === 'name') continue;

                 const lob = String(row[2] || '').trim(); // Column C
                 const language = String(row[3] || '').trim(); // Column D
                 
                 const schedule: Record<string, string> = {};
                 const lobSchedule: Record<string, string> = {};
                 let firstValidShift = '';
                 
                 for (let col = 5; col < Math.max(headers.length, row.length); col++) {
                    const headerVal = headers[col];
                    if (!headerVal) continue;
                    
                    let dateKey = String(headerVal).trim();
                    let dateObj: Date | null = null;
                    if (typeof headerVal === 'number') {
                       dateObj = new Date(Math.round((headerVal - 25569) * 86400 * 1000));
                       dateKey = formatExcelDate(headerVal);
                    } else if (!isNaN(Date.parse(dateKey))) {
                       dateObj = new Date(dateKey);
                       dateKey = `${String(dateObj.getUTCDate()).padStart(2, '0')}/${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}/${dateObj.getUTCFullYear()}`;
                    }

                    if (dateObj && dateObj < threshold) continue;

                    const shiftVal = String(row[col] || '').trim();
                    if (shiftVal && shiftVal !== '-' && shiftVal.toLowerCase() !== 'vazio') {
                       schedule[dateKey] = shiftVal;
                       if (lob) lobSchedule[dateKey] = lob;
                       
                       // Add variations
                       const parts = dateKey.split('/');
                       if (parts.length >= 2) {
                          schedule[`${parts[0]}/${parts[1]}`] = shiftVal;
                          schedule[`${parts[2]}-${parts[1]}-${parts[0]}`] = shiftVal;
                          if (lob) {
                             lobSchedule[`${parts[0]}/${parts[1]}`] = lob;
                             lobSchedule[`${parts[2]}-${parts[1]}-${parts[0]}`] = lob;
                          }
                       }
                       
                       const isWork = /\d{1,2}:\d{2}/.test(shiftVal);
                       if (isWork) {
                          if (!firstValidShift || !/\d{1,2}:\d{2}/.test(firstValidShift)) {
                             firstValidShift = shiftVal;
                          }
                       } else if (!firstValidShift && shiftVal.toLowerCase() !== 'off') {
                          firstValidShift = shiftVal;
                       }
                    }
                 }

                 const normName = name.toLowerCase();
                 const existingEntry = calendarData.find(c => c.name.toLowerCase() === normName);
                 
                 if (existingEntry) {
                     Object.assign(existingEntry.schedule, schedule);
                     if (existingEntry.lobSchedule) {
                        Object.assign(existingEntry.lobSchedule, lobSchedule);
                     } else {
                        existingEntry.lobSchedule = lobSchedule;
                     }
                     if (!existingEntry.shift && firstValidShift) {
                        existingEntry.shift = firstValidShift;
                     }
                 } else {
                     seenNames.add(normName);
                     calendarData.push({
                       email: '', 
                       name: name,
                       lob: lob,
                       language: language,
                       supervisor: '', 
                       shift: firstValidShift || '', 
                       schedule,
                       lobSchedule
                     });
                 }
              }
           } else {
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
              jsonData.forEach((row: any) => {
                const normalizedRow: Record<string, any> = {};
                for (const key in row) {
                  normalizedRow[key.toLowerCase().trim()] = row[key];
                }

                let email = normalizedRow['email'] || normalizedRow['e-mail'] || normalizedRow['email address'] || '';
                if (!email && typeof normalizedRow['username'] === 'string' && normalizedRow['username'].includes('@')) {
                    email = normalizedRow['username'];
                }

                let name = normalizedRow['name'] || normalizedRow['agent name'] || normalizedRow['full name'] || normalizedRow['employee name'] || '';
                if (!name && !email) return;

                let lob = normalizedRow['lob'] || normalizedRow['line of business'] || normalizedRow['project'] || '';
                let language = normalizedRow['language'] || normalizedRow['lang'] || '';
                let supervisor = normalizedRow['supervisor'] || normalizedRow['manager'] || normalizedRow['team leader'] || normalizedRow['tl'] || '';
                let shift = normalizedRow['shift'] || normalizedRow['default shift'] || '';

                const schedule: Record<string, string> = {};
                const lobSchedule: Record<string, string> = {};
                for (const key in row) {
                  const val = row[key];
                  if (/\d{1,2}[\/\-]\d{1,2}/.test(key) || !isNaN(Date.parse(key))) {
                      const dateObj = new Date(key);
                      if (!isNaN(dateObj.getTime()) && dateObj < threshold) continue;

                      if (typeof val === 'string' && val.match(/\d{2}:\d{2}/)) {
                         schedule[key] = val;
                         if (lob) lobSchedule[key] = String(lob).trim();
                      }
                  }
                }

                const normName = String(name).toLowerCase().trim();
                const existingEntry = calendarData.find(c => (email && c.email && c.email.toLowerCase() === String(email).toLowerCase()) || (normName && c.name.toLowerCase().trim() === normName));
                
                if (existingEntry) {
                   Object.assign(existingEntry.schedule, schedule);
                   if (existingEntry.lobSchedule) {
                      Object.assign(existingEntry.lobSchedule, lobSchedule);
                   } else {
                      existingEntry.lobSchedule = lobSchedule;
                   }
                   if (!existingEntry.shift && shift) existingEntry.shift = String(shift).trim();
                } else {
                   seenNames.add(normName);
                   calendarData.push({
                     email: String(email).toLowerCase().trim(),
                     name: String(name).trim(),
                     lob: String(lob).trim(),
                     language: String(language).trim(),
                     supervisor: String(supervisor).trim(),
                     shift: String(shift).trim() || Object.values(schedule)[0] || '',
                     schedule,
                     lobSchedule
                   });
                }
              });
           }
        }

        resolve({ data: calendarData, note: foundNote });
      } catch (error) {
        console.error("Error parsing calendar Excel:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
