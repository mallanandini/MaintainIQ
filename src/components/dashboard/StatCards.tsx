import React from 'react';
import { DashboardStats } from '../../api/types';
import { ClipboardList, AlertOctagon, CheckCircle2, Cpu, Users, Clock } from 'lucide-react';
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
      color: 'text-slate-900',
      iconColor: 'text-teal-600 bg-teal-50',
      onClick: () => onFilterStatus && onFilterStatus(''),
    },
    {
      title: 'Critical Attention',
      value: stats.work_orders.critical_active,
      sub: stats.work_orders.critical_active > 0 ? 'Technicians dispatched' : 'No critical emergencies',
      icon: AlertOctagon,
      color: stats.work_orders.critical_active > 0 ? 'text-rose-600' : 'text-slate-900',
      iconColor: stats.work_orders.critical_active > 0 ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' : 'text-slate-500 bg-slate-100',
      onClick: () => onFilterPriority && onFilterPriority('CRITICAL'),
    },
    {
      title: 'Overdue Schedules',
      value: stats.work_orders.overdue,
      sub: 'Past target schedule date',
      icon: Clock,
      color: stats.work_orders.overdue > 0 ? 'text-amber-600' : 'text-slate-900',
      iconColor: stats.work_orders.overdue > 0 ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-200' : 'text-slate-500 bg-slate-100',
    },
    {
      title: 'Completed Orders',
      value: stats.work_orders.completed,
      sub: `${stats.work_orders.total} cumulative all-time`,
      icon: CheckCircle2,
      color: 'text-emerald-700',
      iconColor: 'text-emerald-600 bg-emerald-50',
      onClick: () => onFilterStatus && onFilterStatus('COMPLETED'),
    },
    {
      title: 'Assets Under Watch',
      value: stats.assets.total,
      sub: `${stats.assets.out_of_service} Out of Service · ${stats.assets.under_maintenance} In Maintenance`,
      icon: Cpu,
      color: 'text-slate-900',
      iconColor: 'text-indigo-600 bg-indigo-50',
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
            className={cn(
              'p-4 bg-white rounded border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all',
              c.onClick && 'hover:border-slate-300 hover:shadow cursor-pointer'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 tracking-tight">{c.title}</span>
              <div className={cn('p-1.5 rounded', c.iconColor)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className={cn('text-2xl font-bold tracking-tight', c.color)}>{c.value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">{c.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
