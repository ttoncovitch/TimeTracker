
export interface BreakSession {
  type: 'meal' | 'short' | 'wellness' | 'wc' | 'praying' | 'idle' | 'other' | 'forgot_status' | 'offline' | 'moderating' | 'non_moderating' | 'meeting' | 'training';
  rawStatus?: string;
  subType?: string;
  remarks?: string;
  originalStatus?: string;
  originalSubStatus?: string;
  originalRemark?: string;
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
  nonModDuration: number;
  reviewAndAppealDuration: number;
  awaitingTasksDuration: number;
  
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
  actualStartTime?: Date | null;
  actualEndTime?: Date | null;

  inferredShift?: string;
  scheduledShift?: string;
  hasSingleShort30m?: boolean;
  hasMealWithoutShortAnomaly?: boolean;
}

export interface CalendarData {
  email: string;
  name: string;
  lob?: string;
  language?: string;
  supervisor?: string;
  shift?: string; // If fixed shift, or schedule per date
  schedule?: Record<string, string>; // date -> shift mapping
}

export interface EmployeeSummary {
  employeeName: string;
  email: string;
  department: string;
  lob?: string;
  language?: string;
  supervisor?: string;
  shift?: string; // from calendar
  calendarName?: string; // overriding inferred name
  isTraining: boolean;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  totalOverbreakMinutes: number;
  totalTardinessMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalNonModMinutes: number;
  totalReviewAndAppealMinutes: number;
  totalAwaitingTasksMinutes: number;
  totalShort30MinRecords?: number;
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
