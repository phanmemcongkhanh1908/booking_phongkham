import { 
  CheckCircle2, Clock, Check, Loader2, Play, 
  Ban, XCircle, AlertCircle, RefreshCw, CalendarOff 
} from 'lucide-react';

export const STATUS_ALIASES: Record<string, string> = {
  REQUESTED: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_SERVICE: 'IN_SERVICE',
  COMPLETED: 'COMPLETED',
  CANCEL_PATIENT: 'CANCELLED',
  CANCEL_CLINIC: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  WAITLIST: 'WAITLIST',
  BLOCKED: 'BLOCKED',
  RESCHEDULED: 'RESCHEDULED'
};

export const APPOINTMENT_STATUSES = {
  AVAILABLE: {
    label: 'Còn trống',
    icon: CheckCircle2,
    color: 'var(--status-available)',
    bg: 'var(--status-available-bg)',
    token: 'available',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    icon: Clock,
    color: 'var(--status-pending)',
    bg: 'var(--status-pending-bg)',
    token: 'pending',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    icon: Check,
    color: 'var(--status-confirmed)',
    bg: 'var(--status-confirmed-bg)',
    token: 'confirmed',
  },
  CHECKED_IN: {
    label: 'Đã đến',
    icon: Loader2,
    color: 'var(--status-checked-in)',
    bg: 'var(--status-checked-in-bg)',
    token: 'checked-in',
  },
  IN_SERVICE: {
    label: 'Đang điều trị',
    icon: Play,
    color: 'var(--status-in-service)',
    bg: 'var(--status-in-service-bg)',
    token: 'in-service',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    icon: CheckCircle2,
    color: 'var(--status-completed)',
    bg: 'var(--status-completed-bg)',
    token: 'completed',
  },
  CANCELLED: {
    label: 'Đã hủy',
    icon: XCircle,
    color: 'var(--status-cancelled)',
    bg: 'var(--status-cancelled-bg)',
    token: 'cancelled',
  },
  NO_SHOW: {
    label: 'Không đến',
    icon: AlertCircle,
    color: 'var(--status-no-show)',
    bg: 'var(--status-no-show-bg)',
    token: 'no-show',
  },
  WAITLIST: {
    label: 'Danh sách chờ',
    icon: Clock,
    color: 'var(--status-waitlist)',
    bg: 'var(--status-waitlist-bg)',
    token: 'waitlist',
  },
  BLOCKED: {
    label: 'Khóa',
    icon: Ban,
    color: 'var(--status-blocked)',
    bg: 'var(--status-blocked-bg)',
    token: 'blocked',
  },
  RESCHEDULED: {
    label: 'Đã dời lịch',
    icon: RefreshCw,
    color: 'var(--info)',
    bg: 'var(--info)', // Note: Should probably be bg-info-light
    token: 'info',
  }
};

export const LABEL_OVERRIDES: Record<string, string> = {
  CANCEL_PATIENT: 'Khách hủy',
  CANCEL_CLINIC: 'PK hủy'
};

export const NEXT_ACTIONS: Record<string, string[]> = {
  REQUESTED: ['CONFIRMED', 'CANCEL_CLINIC'],
  PENDING: ['CONFIRMED', 'CANCEL_CLINIC'],
  CONFIRMED: ['CHECKED_IN', 'NO_SHOW', 'CANCEL_CLINIC'],
  CHECKED_IN: ['IN_SERVICE', 'CANCEL_CLINIC'],
  IN_SERVICE: ['COMPLETED'],
  WAITLIST: ['CONFIRMED', 'CANCEL_CLINIC'],
  RESCHEDULED: ['CONFIRMED', 'CANCEL_CLINIC'],
  COMPLETED: [],
  CANCEL_PATIENT: [],
  CANCEL_CLINIC: [],
  NO_SHOW: [],
  BLOCKED: []
};
