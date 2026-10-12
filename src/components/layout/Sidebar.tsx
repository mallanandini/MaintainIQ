import React from 'react';
import { 
  ClipboardList, 
  Cpu, 
  Users, 
  PlusCircle, 
  BarChart3, 
  ShieldCheck, 
  RotateCcw,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DashboardStats } from '../../api/types';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  stats?: DashboardStats | null;
  onOpenCreateWO: () => void;
  onTriggerSeed: () => void;
  isSeeding: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  stats,
  onOpenCreateWO,
  onTriggerSeed,
  isSeeding,
}) => {
  const navItems = [
    {
      id: 'work-orders',
      label: 'Work Orders',
      icon: ClipboardList,
      badge: stats ? stats.work_orders.active : undefined,
    },
    {
      id: 'assets',
      label: 'Asset Registry',
      icon: Cpu,
      badge: stats ? stats.assets.total : undefined,
    },
    {
      id: 'technicians',
      label: 'Technicians',
      icon: Users,
      badge: stats ? stats.technicians.active : undefined,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-8 h-8 rounded bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold tracking-tight">
          <Layers className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm tracking-tight flex items-center gap-1.5">
            MaintainIQ
            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded border border-teal-500/30 font-mono font-medium">v1.0</span>
          </div>
          <div className="text-[11px] text-slate-400">Enterprise CMMS</div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4 border-b border-slate-800/60">
        <button
          onClick={onOpenCreateWO}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Create Work Order
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors text-left cursor-pointer',
                isActive
                  ? 'bg-slate-800 text-white font-semibold border-l-2 border-teal-400 pl-2.5'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn('w-4 h-4', isActive ? 'text-teal-400' : 'text-slate-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                    isActive ? 'bg-slate-700 text-teal-300' : 'bg-slate-800/90 text-slate-400'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Operational KPI Summary */}
      {stats && (
        <div className="p-4 mx-3 mb-4 rounded bg-slate-800/40 border border-slate-800 text-xs space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Critical Watch</span>
            {stats.work_orders.critical_active > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-slate-900/70 p-2 rounded border border-slate-800/80">
              <div className="text-slate-400 text-[10px]">Critical WOs</div>
              <div className={cn('text-sm font-bold', stats.work_orders.critical_active > 0 ? 'text-rose-400' : 'text-slate-300')}>
                {stats.work_orders.critical_active}
              </div>
            </div>
            <div className="bg-slate-900/70 p-2 rounded border border-slate-800/80">
              <div className="text-slate-400 text-[10px]">Overdue</div>
              <div className={cn('text-sm font-bold', stats.work_orders.overdue > 0 ? 'text-amber-400' : 'text-slate-300')}>
                {stats.work_orders.overdue}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Seeder / System Status */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-[11px] text-slate-400 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>FastAPI + SQLite/Postgres</span>
          </div>
        </div>
        <button
          onClick={onTriggerSeed}
          disabled={isSeeding}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[11px] rounded transition-colors cursor-pointer"
        >
          <RotateCcw className={cn('w-3 h-3', isSeeding && 'animate-spin text-teal-400')} />
          {isSeeding ? 'Seeding Data...' : 'Reset Demo Dataset'}
        </button>
      </div>
    </aside>
  );
};
