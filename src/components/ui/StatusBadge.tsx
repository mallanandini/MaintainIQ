import React from 'react';
import { WorkOrderStatus, WorkOrderPriority, AssetStatus, TechnicianStatus } from '../../api/types';
import { cn } from '../../lib/utils';
import { AlertTriangle, Clock, CheckCircle2, XCircle, UserCheck, Play } from 'lucide-react';

interface StatusBadgeProps {
  status: WorkOrderStatus;
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showIcon = true }) => {
  const configs: Record<WorkOrderStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    OPEN: {
      label: 'Open',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      icon: Clock,
    },
    ASSIGNED: {
      label: 'Assigned',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      icon: UserCheck,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-teal-50',
      text: 'text-teal-800',
      border: 'border-teal-300',
      icon: Play,
    },
    COMPLETED: {
      label: 'Completed',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-300',
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
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
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    },
    CRITICAL: {
      label: 'Critical',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-300',
      dot: 'bg-rose-600 animate-pulse',
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
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
    UNDER_MAINTENANCE: {
      label: 'Under Maintenance',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
    },
    OUT_OF_SERVICE: {
      label: 'Out of Service',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-300',
    },
    DECOMMISSIONED: {
      label: 'Decommissioned',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-300',
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
