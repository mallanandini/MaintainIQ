import React from 'react';
import { WorkOrder, WorkOrderPriority } from '../api/types';
import { Clock, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { cn } from './utils';

export type SlaCategory = 'ON_TRACK' | 'AT_RISK' | 'SCHEDULE_OVERDUE' | 'BREACHED' | 'MET' | 'COMPLETED_LATE' | 'CANCELLED';

export interface SlaEvaluation {
  category: SlaCategory;
  label: string;
  badgeClass: string;
  icon: React.ElementType;
  description: string;
  deadlineDate: Date;
  scheduledDate: Date;
  hoursWindow: number;
}

export const SLA_WINDOW_HOURS: Record<WorkOrderPriority, number> = {
  CRITICAL: 4,     // 4-hour emergency resolution window
  HIGH: 24,        // 24-hour expedited resolution window
  MEDIUM: 72,      // 3 days standard maintenance window
  LOW: 168,        // 7 days routine maintenance window
};

export function evaluateWorkOrderSla(wo: WorkOrder): SlaEvaluation {
  const scheduledDate = new Date(wo.scheduled_date);
  const hoursWindow = SLA_WINDOW_HOURS[wo.priority] || 72;
  const deadlineDate = new Date(scheduledDate.getTime() + hoursWindow * 60 * 60 * 1000);
  const now = new Date();

  if (wo.status === 'CANCELLED') {
    return {
      category: 'CANCELLED',
      label: 'Cancelled',
      badgeClass: 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      icon: Clock,
      description: 'Order cancelled before completion',
      deadlineDate,
      scheduledDate,
      hoursWindow,
    };
  }

  if (wo.status === 'COMPLETED') {
    let completedDate = new Date(wo.updated_at);
    if (wo.status_history) {
      const compRecord = wo.status_history.find((h) => h.to_status === 'COMPLETED');
      if (compRecord) {
        completedDate = new Date(compRecord.created_at || compRecord.changed_at || wo.updated_at);
      }
    }

    if (completedDate.getTime() <= deadlineDate.getTime()) {
      return {
        category: 'MET',
        label: 'SLA Met',
        badgeClass: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: CheckCircle2,
        description: `Resolved within ${hoursWindow}h SLA target`,
        deadlineDate,
        scheduledDate,
        hoursWindow,
      };
    } else {
      return {
        category: 'COMPLETED_LATE',
        label: 'Resolved Past Deadline',
        badgeClass: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        icon: Clock,
        description: `Resolved after ${hoursWindow}h deadline expired`,
        deadlineDate,
        scheduledDate,
        hoursWindow,
      };
    }
  }

  // Non-terminal statuses: OPEN, ASSIGNED, IN_PROGRESS
  const diffFromDeadline = deadlineDate.getTime() - now.getTime();
  const diffFromScheduled = scheduledDate.getTime() - now.getTime();

  // If past SLA deadline -> BREACHED
  if (diffFromDeadline < 0) {
    const hoursOver = Math.abs(Math.round(diffFromDeadline / (1000 * 60 * 60)));
    return {
      category: 'BREACHED',
      label: `SLA Breached (+${hoursOver}h)`,
      badgeClass: 'bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-[#FDA4AF] border-rose-200 dark:border-rose-900/60 font-bold animate-pulse',
      icon: AlertOctagon,
      description: `Breached ${hoursWindow}h SLA limit by ${hoursOver} hours`,
      deadlineDate,
      scheduledDate,
      hoursWindow,
    };
  }

  // If past scheduled date but before SLA deadline -> SCHEDULE_OVERDUE
  if (diffFromScheduled < 0) {
    const hoursOver = Math.abs(Math.round(diffFromScheduled / (1000 * 60 * 60)));
    return {
      category: 'SCHEDULE_OVERDUE',
      label: `Overdue (+${hoursOver}h)`,
      badgeClass: 'bg-amber-50 dark:bg-[#452A16] text-amber-800 dark:text-[#FDBA74] border-amber-300 dark:border-amber-900/60',
      icon: AlertTriangle,
      description: `Scheduled start was ${hoursOver} hours ago`,
      deadlineDate,
      scheduledDate,
      hoursWindow,
    };
  }

  // If within 2 hours of SLA deadline -> AT_RISK
  if (diffFromDeadline < 2 * 60 * 60 * 1000) {
    const minutesLeft = Math.max(1, Math.round(diffFromDeadline / (1000 * 60)));
    return {
      category: 'AT_RISK',
      label: `At Risk (${minutesLeft}m left)`,
      badgeClass: 'bg-amber-100 dark:bg-[#423819] text-amber-900 dark:text-[#FDE68A] border-amber-300 dark:border-yellow-900/60 font-bold',
      icon: AlertTriangle,
      description: `Less than 2 hours before SLA breach`,
      deadlineDate,
      scheduledDate,
      hoursWindow,
    };
  }

  // Otherwise -> ON_TRACK
  const hoursLeft = Math.round(diffFromDeadline / (1000 * 60 * 60));
  return {
    category: 'ON_TRACK',
    label: `${hoursLeft}h to Deadline`,
    badgeClass: 'bg-teal-50 dark:bg-[#123C32] text-teal-700 dark:text-[#6EE7B7] border-teal-200 dark:border-emerald-900/60',
    icon: Clock,
    description: `On schedule for ${hoursWindow}h target window`,
    deadlineDate,
    scheduledDate,
    hoursWindow,
  };
}

interface SlaBadgeProps {
  workOrder?: WorkOrder | null;
  wo?: WorkOrder | null;
  showDetails?: boolean;
  className?: string;
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({
  workOrder,
  wo,
  showDetails = false,
  className,
}) => {
  const target = workOrder || wo;
  if (!target) return null;

  const sla = evaluateWorkOrderSla(target);
  const Icon = sla.icon;

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <span
        title={sla.description}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border tracking-tight shrink-0',
          sla.badgeClass
        )}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{sla.label}</span>
      </span>
      {showDetails && (
        <span className="text-[10px] text-slate-400 mt-0.5 truncate">{sla.description}</span>
      )}
    </div>
  );
};
