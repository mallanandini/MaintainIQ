import React from 'react';
import { WorkOrderStatus, WorkOrderPriority, AssetStatus } from '../../api/types';
import { cn } from '../../lib/utils';
import { Clock, CheckCircle2, XCircle, UserCheck, Play } from 'lucide-react';

interface StatusBadgeProps {
  status: WorkOrderStatus;
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showIcon = true }) => {
  const configs: Record<WorkOrderStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    OPEN: {
      label: 'Open',
      bg: 'bg-slate-100 dark:bg-slate-800/90',
      text: 'text-slate-700 dark:text-slate-200',
      border: 'border-slate-300 dark:border-slate-600',
      icon: Clock,
    },
    ASSIGNED: {
      label: 'Assigned',
      bg: 'bg-indigo-50 dark:bg-indigo-950/70',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
      icon: UserCheck,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-teal-50 dark:bg-teal-950/70',
      text: 'text-teal-800 dark:text-teal-300',
      border: 'border-teal-300 dark:border-teal-800',
      icon: Play,
    },
    COMPLETED: {
      label: 'Completed',
      bg: 'bg-emerald-50 dark:bg-emerald-950/70',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-800',
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-rose-50 dark:bg-[#4C1826]/70',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-900/60',
      icon: XCircle,
    },
  };

  const config = configs[status] || configs.OPEN;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border tracking-wide uppercase',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: WorkOrderPriority;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const configs: Record<WorkOrderPriority, { label: string; bg: string; text: string; border: string; dot: string }> = {
    LOW: {
      label: 'Low',
      bg: 'bg-slate-50 dark:bg-slate-800/80',
      text: 'text-slate-600 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-400',
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-sky-50 dark:bg-sky-950/70',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800',
      dot: 'bg-sky-500 dark:bg-sky-400',
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-50 dark:bg-[#452A16]',
      text: 'text-amber-800 dark:text-[#FDBA74]',
      border: 'border-amber-200 dark:border-amber-900/60',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    CRITICAL: {
      label: 'Critical',
      bg: 'bg-rose-50 dark:bg-[#4C1826]',
      text: 'text-rose-700 dark:text-[#FDA4AF]',
      border: 'border-rose-300 dark:border-rose-900/60',
      dot: 'bg-rose-600 dark:bg-rose-400 animate-pulse',
    },
  };

  const config = configs[priority] || configs.MEDIUM;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold border uppercase tracking-wider',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
};

interface AssetStatusBadgeProps {
  status: AssetStatus;
  className?: string;
}

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({ status, className }) => {
  const configs: Record<AssetStatus, { label: string; bg: string; text: string; border: string }> = {
    OPERATIONAL: {
      label: 'Operational',
      bg: 'bg-emerald-50 dark:bg-emerald-950/70',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    UNDER_MAINTENANCE: {
      label: 'Under Maintenance',
      bg: 'bg-amber-50 dark:bg-[#452A16]',
      text: 'text-amber-800 dark:text-[#FDBA74]',
      border: 'border-amber-200 dark:border-amber-900/60',
    },
    OUT_OF_SERVICE: {
      label: 'Out of Service',
      bg: 'bg-rose-50 dark:bg-[#4C1826]',
      text: 'text-rose-700 dark:text-[#FDA4AF]',
      border: 'border-rose-300 dark:border-rose-900/60',
    },
    DECOMMISSIONED: {
      label: 'Decommissioned',
      bg: 'bg-slate-100 dark:bg-slate-800/80',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-300 dark:border-slate-700',
    },
  };

  const config = configs[status] || configs.OPERATIONAL;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
};
