import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  Cpu, 
  Users, 
  ArrowRight, 
  PlusCircle, 
  ShieldCheck, 
  BarChart3, 
  FileCheck, 
  Activity,
  Layers,
  ExternalLink
} from 'lucide-react';
import { DashboardStats, WorkOrder, Asset, Technician } from '../api/types';
import { api } from '../api/client';
import { StatCards } from '../components/dashboard/StatCards';
import { StatusBadge, PriorityBadge } from '../components/ui/StatusBadge';
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';

interface OverviewPageProps {
  stats: DashboardStats | null;
  assets: Asset[];
  technicians: Technician[];
  onSelectWorkOrder: (id: number) => void;
  onNavigate: (tab: string) => void;
  onOpenCreateWO: () => void;
  onRefresh: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  stats,
  assets,
  technicians,
  onSelectWorkOrder,
  onNavigate,
  onOpenCreateWO,
}) => {
  const [recentOrders, setRecentOrders] = useState<WorkOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [healthSummary, setHealthSummary] = useState<{
    low: number;
    moderate: number;
    high: number;
    critical: number;
    needs_attention: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingOrders(true);

    Promise.all([
      api.getWorkOrders(),
      api.getFleetAssetHealth().catch(() => null),
    ])
      .then(([orders, health]) => {
        if (!isMounted) return;
        setRecentOrders(orders.slice(0, 6));
        if (health) {
          setHealthSummary({
            low: health.summary.low_risk_count,
            moderate: health.summary.moderate_risk_count,
            high: health.summary.high_risk_count,
            critical: health.summary.critical_risk_count,
            needs_attention: health.summary.attention_required_count,
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load overview data:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingOrders(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeTechCount = technicians.filter((t) => t.status === 'ACTIVE').length;
  const outOfServiceAssets = assets.filter((a) => a.status === 'OUT_OF_SERVICE').length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Welcome & Context Header */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-teal-950 rounded-lg p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Layers className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Enterprise v3.0
            </span>
            <span className="text-slate-400 text-xs">Operations Command Center</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            MaintainIQ Executive Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            Centralized dispatch monitoring, equipment health analytics, and compliance governance across all active plant facilities.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <button
              type="button"
              onClick={onOpenCreateWO}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <PlusCircle className="w-4 h-4" />
              Create Work Order
            </button>
            <button
              type="button"
              onClick={() => onNavigate('work-orders')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-teal-400" />
              Dispatch Queue
            </button>
            <button
              type="button"
              onClick={() => onNavigate('assets')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-indigo-400" />
              Asset Fleet ({assets.length})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert Banner if Active Critical Orders Exist */}
      {stats && stats.work_orders.critical_active > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-rose-100 text-rose-700 shrink-0">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-rose-900 tracking-tight flex items-center gap-2">
                CRITICAL DISPATCH ATTENTION REQUIRED
                <span className="text-[11px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  {stats.work_orders.critical_active} Open
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                Critical priority work orders mandate technician dispatch and emergency service protocol enforcement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('work-orders')}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer shrink-0"
          >
            Review Critical Orders
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary KPI Cards */}
      <StatCards
        stats={stats}
        onFilterStatus={() => onNavigate('work-orders')}
        onFilterPriority={() => onNavigate('work-orders')}
      />

      {/* Two-Column Operational Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Recent Active Work Orders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 dark:border-[#334155] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Recent Work Order Dispatches
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Latest maintenance records and ongoing floor executions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('work-orders')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
              >
                View all ({stats?.work_orders.total || 0})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingOrders ? (
              <div className="p-4">
                <TableSkeleton rows={4} columns={4} />
              </div>
            ) : recentOrders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No work orders available"
                description="Create your first maintenance work order to dispatch technicians."
                actionLabel="Create Work Order"
                onAction={onOpenCreateWO}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#334155]">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => onSelectWorkOrder(order.id)}
                    className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-[#1E3048] transition-colors cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-900 dark:text-teal-400 group-hover:text-teal-600 transition-colors">
                          {order.work_order_number}
                        </span>
                        <PriorityBadge priority={order.priority} />
                        <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {order.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Cpu className="w-3 h-3 text-slate-400" />
                          {order.asset?.asset_tag || `Asset #${order.asset_id}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(order.scheduled_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {order.technician && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Users className="w-3 h-3 text-slate-400" />
                            {order.technician.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={order.status} />
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Fleet Health & Workforce Overview */}
        <div className="space-y-6">
          {/* Asset Fleet Health Card */}
          <div className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#334155]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  Asset Fleet Risk Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assets')}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-700 font-semibold cursor-pointer"
              >
                Inspect Registry →
              </button>
            </div>

            {healthSummary ? (
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-emerald-50/80 dark:bg-[#123C32] border border-emerald-200/70 dark:border-emerald-900/60">
                    <div className="text-[10px] text-emerald-800 dark:text-[#6EE7B7] font-sans font-medium">Low Risk</div>
                    <div className="text-lg font-bold text-emerald-900 dark:text-[#6EE7B7]">{healthSummary.low}</div>
                  </div>
                  <div className="p-2.5 rounded bg-amber-50/80 dark:bg-[#423819] border border-amber-200/70 dark:border-yellow-900/60">
                    <div className="text-[10px] text-amber-800 dark:text-[#FDE68A] font-sans font-medium">Moderate</div>
                    <div className="text-lg font-bold text-amber-900 dark:text-[#FDE68A]">{healthSummary.moderate}</div>
                  </div>
                  <div className="p-2.5 rounded bg-orange-50/80 dark:bg-[#452A16] border border-orange-200/70 dark:border-amber-900/60">
                    <div className="text-[10px] text-orange-800 dark:text-[#FDBA74] font-sans font-medium">High Risk</div>
                    <div className="text-lg font-bold text-orange-900 dark:text-[#FDBA74]">{healthSummary.high}</div>
                  </div>
                  <div className="p-2.5 rounded bg-rose-50/80 dark:bg-[#4C1826] border border-rose-200/70 dark:border-rose-900/60">
                    <div className="text-[10px] text-rose-800 dark:text-[#FDA4AF] font-sans font-medium">Critical Risk</div>
                    <div className="text-lg font-bold text-rose-900 dark:text-[#FDA4AF]">{healthSummary.critical}</div>
                  </div>
                </div>

                {outOfServiceAssets > 0 && (
                  <div className="text-[11px] font-sans text-rose-700 dark:text-[#FDA4AF] bg-rose-50 dark:bg-[#4C1826]/70 p-2 rounded border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                    <span>Out of Service Machinery:</span>
                    <span className="font-bold font-mono">{outOfServiceAssets} assets</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                Loading asset fleet risk metrics...
              </div>
            )}
          </div>

          {/* Workforce Availability Snapshot */}
          <div className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#334155]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  Technician Workforce
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('technicians')}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-700 font-semibold cursor-pointer"
              >
                Directory →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-50 dark:bg-[#131F32] border border-slate-200/80 dark:border-[#334155]">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Active On-Duty</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">{activeTechCount}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 dark:bg-[#131F32] border border-slate-200/80 dark:border-[#334155]">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Roster</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">{technicians.length}</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              Deterministic skill matching and intelligent workload balancing active for technician dispatch.
            </div>
          </div>

          {/* Enterprise Guardrails Status */}
          <div className="bg-slate-900 dark:bg-[#080F1E] rounded p-4 text-slate-300 text-xs space-y-2.5 border border-slate-800 dark:border-[#334155]">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              Enterprise Governance
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Strict sequential unique WO numbering
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Mandatory tech dispatch on Critical priority
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Zero past-date scheduling enforced (UTC)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Terminal status immutability & audit lock
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
