import * as XLSX from 'xlsx';

export interface StaffInfoEntry {
    email: string;
    fullName: string;
    role: string;
    lob: string;
    language: string;
    tl?: string;
    status: string;
}

export async function parseStaffInfoFile(file: File): Promise<{ data: StaffInfoEntry[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let sheetName = workbook.SheetNames.find(sn => sn.toLowerCase().includes('staff info'));
        if (!sheetName) sheetName = workbook.SheetNames[0]; // fallback
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
        if (rows.length < 2) {
             throw new Error('Staff Info format not recognized');
        }

        const entries: StaffInfoEntry[] = [];
        
        // Assume row 0 or 1 is headers. We can just use indices as requested:
        // E = 4
        // P or something (wait, let's verify indices)
        // A=0, B=1, C=2, D=3, E=4 (Name)
        // F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14, P=15, Q=16, R=17 (LOB)
        // AE: A=1..Z=26, AA=27, AB=28, AC=29, AD=30, AE=31
        // BN: B is 2, N is 14 -> 26*1 + 14 = 40 (wait... A=1..Z=26. AA=27..AZ=52. BA=53..BN=53+13=66. index 65)

        for (let i = 1; i < rows.length; i++) {
           const row = rows[i];
           if (!row || row.length < 5) continue;
           
           const statusStr = String(row[0] || '').trim().toUpperCase();
           const name = String(row[4] || '').trim();
           // if name is empty skip
           if (!name) continue;

           const roleStr = String(row[5] || '').trim();
           const lobStr = String(row[17] || '').trim();
           const langStr = String(row[30] || '').trim(); // AE is index 30
           const emailStr = String(row[65] || '').trim().toLowerCase(); // BN is index 65
           const tlStr = String(row[9] || '').trim(); // J is index 9
           
           if (!emailStr) continue;

           entries.push({
               email: emailStr,
               fullName: name,
               role: roleStr,
               lob: lobStr,
               language: langStr,
               tl: tlStr,
               status: statusStr
           });
        }

        resolve({ data: entries });
      } catch (error) {
        console.error("Error parsing staff info file:", error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
  });
}
