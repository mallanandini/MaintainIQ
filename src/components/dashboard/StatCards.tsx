import React from 'react';
import { DashboardStats } from '../../api/types';
import { ClipboardList, AlertOctagon, CheckCircle2, Cpu, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardsProps {
  stats: DashboardStats | null;
  onFilterStatus?: (status: string) => void;
  onFilterPriority?: (priority: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, onFilterStatus, onFilterPriority }) => {
  if (!stats) return null;

  const cards = [
    {
      title: 'Active Work Orders',
      value: stats.work_orders.active,
      sub: `${stats.work_orders.open} Open · ${stats.work_orders.in_progress} In Progress`,
      icon: ClipboardList,
      color: 'text-slate-900 dark:text-white',
      iconColor: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300',
      tooltip: 'Active: Non-terminal work orders (OPEN + ASSIGNED + IN_PROGRESS)',
      onClick: () => onFilterStatus && onFilterStatus(''),
    },
    {
      title: 'Critical Attention',
      value: stats.work_orders.critical_active,
      sub: stats.work_orders.critical_active > 0 ? 'Technicians dispatched' : 'No critical emergencies',
      icon: AlertOctagon,
      color: stats.work_orders.critical_active > 0 ? 'text-rose-600 dark:text-[#FDA4AF]' : 'text-slate-900 dark:text-white',
      iconColor: stats.work_orders.critical_active > 0 
        ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200 dark:bg-[#4C1826] dark:text-[#FDA4AF] dark:ring-rose-900/60' 
        : 'text-slate-500 bg-slate-100 dark:bg-[#111B2E] dark:text-slate-400',
      tooltip: 'Critical priority work orders requiring mandatory technician dispatch',
      onClick: () => onFilterPriority && onFilterPriority('CRITICAL'),
    },
    {
      title: 'Overdue Schedules',
      value: stats.work_orders.overdue,
      sub: 'Scheduled date lapsed & non-terminal',
      icon: Clock,
      color: stats.work_orders.overdue > 0 ? 'text-amber-600 dark:text-[#FDBA74]' : 'text-slate-900 dark:text-white',
      iconColor: stats.work_orders.overdue > 0 
        ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-200 dark:bg-[#452A16] dark:text-[#FDBA74] dark:ring-amber-900/60' 
        : 'text-slate-500 bg-slate-100 dark:bg-[#111B2E] dark:text-slate-400',
      tooltip: 'Overdue: Scheduled date < now UTC with non-terminal status (OPEN, ASSIGNED, IN_PROGRESS)',
    },
    {
      title: 'Completed Orders',
      value: stats.work_orders.completed,
      sub: `${stats.work_orders.total} cumulative all-time`,
      icon: CheckCircle2,
      color: 'text-emerald-700 dark:text-[#6EE7B7]',
      iconColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300',
      tooltip: 'Completed orders (Terminal state: verified maintenance completed)',
      onClick: () => onFilterStatus && onFilterStatus('COMPLETED'),
    },
    {
      title: 'Assets Under Watch',
      value: stats.assets.total,
      sub: `${stats.assets.out_of_service} Out of Service · ${stats.assets.under_maintenance} In Maintenance`,
      icon: Cpu,
      color: 'text-slate-900 dark:text-white',
      iconColor: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300',
      tooltip: 'Total physical machinery registered across all plant facilities',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            onClick={c.onClick}
            title={c.tooltip}
            className={cn(
              'p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all',
              c.onClick && 'hover:border-slate-300 dark:hover:border-slate-500 hover:shadow dark:hover:bg-[#1E3048] cursor-pointer'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-300 tracking-tight">{c.title}</span>
              <div className={cn('p-1.5 rounded', c.iconColor)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className={cn('text-2xl font-bold tracking-tight', c.color)}>{c.value}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{c.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
