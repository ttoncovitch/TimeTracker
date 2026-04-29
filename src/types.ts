
export interface BreakSession {
  type: 'meal' | 'short' | 'wellness' | 'wc' | 'praying' | 'idle' | 'other' | 'forgot_status' | 'offline' | 'moderating' | 'non_moderating' | 'meeting' | 'training';
  rawStatus?: string;
  subType?: string;
  remarks?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface EmployeeDayRecord {
  date: string;
  employeeName: string;
  totalWorkTimeMillis: number;
  breaks: BreakSession[];
  
  // Accumulated durations in minutes
  mealDuration: number;
  shortDuration: number;
  wellnessDuration: number;
  wcDuration: number;
  prayingDuration: number;
  idleDuration: number;
  
  // Overbreaks in minutes
  mealOverbreak: number;
  shortOverbreak: number;
  wellnessOverbreak: number;
  prayingOverbreak: number;
  wcOverbreak: number; // WC alert if > 10m
  idleOverbreak: number;
  
  totalOverbreak: number;

  tardinessMinutes: number;
  earlyLeaveMinutes: number;

  inferredShift?: string;
  hasMealWithoutShortAnomaly?: boolean;
}

export interface EmployeeSummary {
  employeeName: string;
  email: string;
  department: string;
  isTraining: boolean;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  totalOverbreakMinutes: number;
  totalTardinessMinutes: number;
  totalEarlyLeaveMinutes: number;
  wcAlerts: number;
  idleAlerts: number;
  wcTotalMinutes?: number;
  idleTotalMinutes?: number;
  dailyRecords: EmployeeDayRecord[];
}

export interface DashboardStats {
  totalEmployees: number;
  totalOverbreakMinutes: number;
  topProblematicEmployees: { name: string; overbreak: number }[];
  wcAlertCount: number;
}
