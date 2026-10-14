import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Cpu,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  XCircle,
  FileText,
  RotateCcw,
  User,
  ExternalLink,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { api } from '../../api/client';
import {
  MaintenanceAnalytics,
  OverdueWorkOrderReportItem,
  TechnicianWorkloadReportItem
} from '../../api/types';
import { cn, formatDate, formatShortDate } from '../../lib/utils';
import { PriorityBadge, StatusBadge } from '../ui/StatusBadge';
import { useTheme } from '../../context/ThemeContext';

interface MaintenanceAnalyticsViewProps {
  onSelectAsset?: (assetId: number) => void;
  onSelectWorkOrder?: (orderId: number) => void;
  compact?: boolean;
}

export const MaintenanceAnalyticsView: React.FC<MaintenanceAnalyticsViewProps> = ({
  onSelectAsset,
  onSelectWorkOrder,
  compact = false,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'charts' | 'overdue' | 'technicians'>('charts');

  // Date Range Filtering State
  const [datePreset, setDatePreset] = useState<'ALL' | '7D' | '30D' | '90D' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Analytics Data State
  const [data, setData] = useState<MaintenanceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reports State
  const [overdueReport, setOverdueReport] = useState<OverdueWorkOrderReportItem[]>([]);
  const [isLoadingOverdue, setIsLoadingOverdue] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);

  const [techReport, setTechReport] = useState<TechnicianWorkloadReportItem[]>([]);
  const [isLoadingTech, setIsLoadingTech] = useState(false);
  const [techError, setTechError] = useState<string | null>(null);

  // Date Presets Logic
  const applyPreset = (preset: 'ALL' | '7D' | '30D' | '90D' | 'CUSTOM') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '7D') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '30D') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === '90D') {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const analyticsData = await api.getMaintenanceAnalytics({
        top_assets_limit: 6,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
      });
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch maintenance analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch Overdue Report
  const fetchOverdueReport = useCallback(async () => {
    setIsLoadingOverdue(true);
    setOverdueError(null);
    try {
      const res = await api.getOverdueWorkOrdersReport();
      setOverdueReport(res);
    } catch (err: any) {
      setOverdueError(err.message || 'Failed to fetch overdue work orders report.');
    } finally {
      setIsLoadingOverdue(false);
    }
  }, []);

  // Fetch Technician Workload Report
  const fetchTechReport = useCallback(async () => {
    setIsLoadingTech(true);
    setTechError(null);
    try {
      const res = await api.getTechnicianWorkloadReport();
      setTechReport(res);
    } catch (err: any) {
      setTechError(err.message || 'Failed to fetch technician workload report.');
    } finally {
      setIsLoadingTech(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (activeTab === 'overdue') {
      fetchOverdueReport();
    } else if (activeTab === 'technicians') {
      fetchTechReport();
    }
  }, [activeTab, fetchOverdueReport, fetchTechReport]);

  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const chartTextColor = isDark ? '#FFFFFF' : '#000000';
  const chartGridColor = isDark ? '#334155' : '#CBD5E1';

  const handleResetDateFilters = () => {
    applyPreset('ALL');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "text-xs px-3 py-2 rounded shadow-xl font-sans z-50 border",
          isDark ? "bg-[#172033] text-white border-slate-700" : "bg-white text-black border-slate-300"
        )}>
          <div className={cn("font-bold mb-1", isDark ? "text-white" : "text-black")}>
            {label || payload[0]?.name}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className={cn(isDark ? "text-slate-300" : "text-black font-semibold")}>{entry.name || 'Count'}:</span>
              <span className={cn("font-bold", isDark ? "text-white" : "text-black")}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Reporting Filter Controls */}
      <div className="bg-white dark:bg-[#172338] p-4 rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                Maintenance Intelligence & Audit Reports
              </h2>
              <span className="text-[10px] bg-slate-100 dark:bg-[#131F32] text-slate-600 dark:text-white px-2 py-0.5 rounded-full font-mono border border-slate-200 dark:border-[#334155]">
                Verified Database Metrics (Refreshed On Demand)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white mt-1">
              On-demand operational reporting for SLA adherence, equipment velocity, and workforce workload.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                fetchAnalytics();
                if (activeTab === 'overdue') fetchOverdueReport();
                if (activeTab === 'technicians') fetchTechReport();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[#131F32] hover:bg-slate-100 dark:hover:bg-[#1E3048] border border-slate-200 dark:border-[#334155] rounded font-medium transition cursor-pointer"
              title="Refresh all metrics"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Preset Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#334155] text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 dark:text-white font-semibold mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-white" />
              Date Window:
            </span>
            {(['ALL', '7D', '30D', '90D'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
                  datePreset === preset
                    ? 'bg-teal-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-[#131F32] hover:bg-slate-200 dark:hover:bg-[#1E3048] text-slate-600 dark:text-white'
                )}
              >
                {preset === 'ALL' ? 'All Time' : preset === '7D' ? 'Last 7 Days' : preset === '30D' ? 'Last 30 Days' : 'Last 90 Days'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 dark:text-white">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setStartDate(e.target.value);
                }}
                className="py-1 px-2 text-xs border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 dark:text-white">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setEndDate(e.target.value);
                }}
                className="py-1 px-2 text-xs border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {(startDate || endDate || datePreset !== 'ALL') && (
              <button
                onClick={handleResetDateFilters}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 dark:text-white hover:text-slate-900 bg-slate-100 dark:bg-[#131F32] hover:bg-slate-200 dark:hover:bg-[#1E3048] border dark:border-[#334155] rounded transition-colors cursor-pointer"
                title="Reset to All Time"
              >
                <RotateCcw className="w-3 h-3 text-slate-400 dark:text-white" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-[#334155]">
          <button
            onClick={() => setActiveTab('charts')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'charts'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048]'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Charts & Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'overdue'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048]'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Overdue Work Orders Audit</span>
            {data && data.overdue_metrics.overdue_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-mono">
                {data.overdue_metrics.overdue_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('technicians')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'technicians'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048]'
            )}
          >
            <Users className="w-3.5 h-3.5 text-teal-500" />
            <span>Technician Workload & Utilization</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CHARTS & OVERVIEW */}
      {activeTab === 'charts' && (
        <>
          {isLoading ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm animate-pulse space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-md" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-slate-100 rounded-md" />
                <div className="h-64 bg-slate-100 rounded-md" />
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg border border-rose-200 p-6 shadow-sm text-center">
              <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm text-slate-900">Failed to Load Maintenance Analytics</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !data || data.summary.total_work_orders === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No Maintenance Records Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No work orders matched the current date filters. Clear filters or create new work orders to view analytics graphs.
              </p>
              {(startDate || endDate) && (
                <button
                  onClick={handleResetDateFilters}
                  className="mt-3 px-3.5 py-1.5 bg-teal-600 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Clear Date Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Comprehensive KPI Highlight Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Total Orders */}
                <div
                  className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs"
                  title="Total work orders created within the specified date window"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-white text-xs mb-1">
                    <span className="font-medium">Total Orders</span>
                    <FileText className="w-4 h-4 text-slate-400 dark:text-white" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {data.summary.total_work_orders}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-white mt-1">
                    In selected date scope
                  </div>
                </div>

                {/* Completion Rate */}
                <div
                  className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs"
                  title="Formula: (Completed Work Orders ÷ Total Work Orders) × 100%"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-white text-xs mb-1">
                    <span className="font-medium">Completion Rate</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {data.summary.completion_rate_percentage.toFixed(1)}%
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#131F32] rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(data.summary.completion_rate_percentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-white mt-1">
                    {data.summary.completed_work_orders} of {data.summary.total_work_orders} orders
                  </div>
                </div>

                {/* Cancellation Rate */}
                <div
                  className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs"
                  title="Formula: (Cancelled Work Orders ÷ Total Work Orders) × 100%"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-white text-xs mb-1">
                    <span className="font-medium">Cancellation Rate</span>
                    <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {(data.summary.cancellation_rate_percentage || 0).toFixed(1)}%
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#131F32] rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(data.summary.cancellation_rate_percentage || 0, 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-white mt-1">
                    {data.summary.cancelled_work_orders} cancelled
                  </div>
                </div>

                {/* Active Dispatch */}
                <div
                  className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs"
                  title="Active: Non-terminal work orders (OPEN + ASSIGNED + IN_PROGRESS)"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-white text-xs mb-1">
                    <span className="font-medium">Active Dispatch</span>
                    <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400">
                    {data.summary.active_work_orders}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white mt-1">
                    Open / Assigned / In Progress
                  </div>
                </div>

                {/* Overdue Orders */}
                <div
                  className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs"
                  title="Overdue Rule: Scheduled date strictly prior to current UTC and non-terminal status (OPEN, ASSIGNED, IN_PROGRESS)"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-white text-xs mb-1">
                    <span className="font-medium">Overdue Orders</span>
                    <AlertTriangle className={cn("w-4 h-4", data.overdue_metrics.overdue_count > 0 ? "text-amber-500" : "text-slate-400 dark:text-white")} />
                  </div>
                  <div className={cn("text-2xl font-bold font-mono", data.overdue_metrics.overdue_count > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>
                    {data.overdue_metrics.overdue_count}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white mt-1 flex items-center gap-1">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{data.overdue_metrics.critical_overdue_count} critical</span>
                    <span>· {data.overdue_metrics.high_overdue_count} high</span>
                  </div>
                </div>
              </div>

              {/* Turnaround Time & Cancellation Reasons (if applicable) */}
              {(data.summary.avg_completion_time_hours !== null && data.summary.avg_completion_time_hours !== undefined ||
                (data.summary.cancellation_reasons_breakdown && data.summary.cancellation_reasons_breakdown.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.summary.avg_completion_time_hours !== null && data.summary.avg_completion_time_hours !== undefined && (
                    <div className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Average Work-Order Turnaround Time
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-white">
                            Measured from creation to completed status history record
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                          {data.summary.avg_completion_time_hours.toFixed(1)} hrs
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-white block">mean turnaround</span>
                      </div>
                    </div>
                  )}

                  {data.summary.cancellation_reasons_breakdown && data.summary.cancellation_reasons_breakdown.length > 0 && (
                    <div className="bg-white dark:bg-[#172338] p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs space-y-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Cancellation Audit Breakdown
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.summary.cancellation_reasons_breakdown.map((r, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-rose-50 dark:bg-[#4C1826] text-rose-800 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60"
                          >
                            <span className="font-semibold">{r.reason}:</span>
                            <span className="font-mono font-bold">{r.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main Charts Row 1: Status Distribution & Monthly Completion Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Status Distribution (5 cols) */}
                <div className="lg:col-span-5 bg-white dark:bg-[#172338] p-5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Work Order Status Distribution</h3>
                      <p className="text-xs text-slate-500 dark:text-white">Breakdown of orders across workflow lifecycle</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-[#131F32] text-slate-600 dark:text-white px-2 py-0.5 rounded border dark:border-[#334155]">
                      {data.summary.total_work_orders} total
                    </span>
                  </div>

                  <div className="h-60 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.status_distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="label"
                        >
                          {data.status_distribution.map((entry, index) => (
                            <Cell key={`status-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#334155] grid grid-cols-2 gap-2 text-xs">
                    {data.status_distribution.map((item) => (
                      <div key={item.status} className="flex items-center justify-between p-1.5 rounded bg-slate-50/70 dark:bg-[#131F32] border border-slate-100 dark:border-[#334155]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-700 dark:text-white font-medium truncate">{item.label}</span>
                        </div>
                        <div className="font-mono text-slate-900 dark:text-white font-semibold shrink-0">
                          {item.count} <span className="text-[10px] text-slate-400 dark:text-white font-normal">({item.percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly Completion Trend (7 cols) */}
                <div className="lg:col-span-7 bg-white dark:bg-[#172338] p-5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Monthly Completed Orders Trend</h3>
                      <p className="text-xs text-slate-500 dark:text-white">Historical velocity based on verified completion audit timestamps</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800 font-medium">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Past 6 Months</span>
                    </div>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.monthly_completion_trend}
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTextColor, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chartTextColor, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="completed_count"
                          name="Completed Orders"
                          stroke="#0d9488"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorCompleted)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-xs text-slate-500 dark:text-white">
                    <span>Aggregated by completion date</span>
                    <span className="font-mono font-medium text-teal-700 dark:text-teal-400">
                      Total: {data.monthly_completion_trend.reduce((acc, curr) => acc + curr.completed_count, 0)} completed
                    </span>
                  </div>
                </div>
              </div>

              {/* Charts Row 2: Technician Workloads & Priority Tiers */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Technician Workload (7 cols) */}
                <div className="lg:col-span-7 bg-white dark:bg-[#172338] p-5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Technician Active Workload</h3>
                      <p className="text-xs text-slate-500 dark:text-white">Active assigned work orders vs. estimated backlog labor hours</p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-white">
                      Top {data.technician_workloads.length} Technicians
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.technician_workloads}
                        margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: chartTextColor, fontWeight: 600 }}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chartTextColor, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} formatter={(value) => <span style={{ color: chartTextColor, fontWeight: 600 }}>{value}</span>} />
                        <Bar
                          dataKey="active_work_orders_count"
                          name="Active Orders"
                          fill="#0f766e"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="active_estimated_hours"
                          name="Estimated Backlog (hrs)"
                          fill="#38bdf8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Priority Breakdown & Overdue Metrics (5 cols) */}
                <div className="lg:col-span-5 bg-white dark:bg-[#172338] p-5 rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Work Order Priority Tiers</h3>
                        <p className="text-xs text-slate-500 dark:text-white">Distribution across urgency levels</p>
                      </div>
                      <Layers className="w-4 h-4 text-slate-400 dark:text-white" />
                    </div>

                    <div className="space-y-2.5">
                      {data.priority_distribution.map((item) => (
                        <div key={item.priority} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 dark:text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.label}
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white font-bold">
                              {item.count} <span className="text-slate-400 dark:text-white font-normal">({item.percentage.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-[#131F32] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: item.color,
                                width: `${Math.min(item.percentage, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overdue Calculation Rule Card */}
                  <div className="bg-slate-50 dark:bg-[#131F32] rounded-md border border-slate-200 dark:border-[#334155] p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-white text-xs font-semibold">
                      <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>Documented Overdue Rule</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-white leading-relaxed">
                      {data.overdue_metrics.rule_description}
                    </p>
                    <div className="pt-2 border-t border-slate-200 dark:border-[#334155] flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-white">Total flagged as overdue:</span>
                      <span className={cn("font-bold font-mono px-2 py-0.5 rounded", data.overdue_metrics.overdue_count > 0 ? "bg-amber-100 dark:bg-[#452A16] text-amber-800 dark:text-[#FDBA74]" : "bg-emerald-100 dark:bg-[#123C32] text-emerald-800 dark:text-[#6EE7B7]")}>
                        {data.overdue_metrics.overdue_count} Work Orders
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Frequently Maintained Assets */}
              <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Most Frequently Maintained Assets</h3>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-white">
                    Top equipment by cumulative maintenance tickets
                  </span>
                </div>

                {data.frequently_maintained_assets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 dark:text-white">
                    No work order history recorded for registered physical assets in this range.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-slate-600 dark:text-white font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Asset Tag / Name</th>
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4">Criticality</th>
                          <th className="py-2.5 px-4 text-right">Total WOs</th>
                          <th className="py-2.5 px-4 text-right">Active WOs</th>
                          <th className="py-2.5 px-4 text-right">Completed WOs</th>
                          {onSelectAsset && <th className="py-2.5 px-4 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#334155] dark:bg-[#131F32]">
                        {data.frequently_maintained_assets.map((asset) => (
                          <tr key={asset.asset_id} className="hover:bg-slate-50/80 dark:hover:bg-[#1E3048] transition-colors">
                            <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                              <div className="font-mono text-teal-700 dark:text-teal-400 text-[11px]">{asset.asset_tag}</div>
                              <div className="text-slate-800 dark:text-white">{asset.name}</div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-white">{asset.category}</td>
                            <td className="py-2.5 px-4">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-semibold font-mono",
                                  asset.criticality === "CRITICAL"
                                    ? "bg-rose-100 dark:bg-[#4C1826] text-rose-800 dark:text-[#FDA4AF]"
                                    : asset.criticality === "HIGH"
                                    ? "bg-amber-100 dark:bg-[#452A16] text-amber-800 dark:text-[#FDBA74]"
                                    : "bg-slate-100 dark:bg-[#172338] text-slate-700 dark:text-white border dark:border-[#334155]"
                                )}
                              >
                                {asset.criticality}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {asset.total_work_orders}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-teal-700 dark:text-teal-400 font-medium">
                              {asset.active_work_orders}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                              {asset.completed_work_orders}
                            </td>
                            {onSelectAsset && (
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => onSelectAsset(asset.asset_id)}
                                  className="inline-flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                                >
                                  <span>Inspect</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: OVERDUE WORK ORDERS REPORT */}
      {activeTab === 'overdue' && (
        <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Overdue Work Orders Audit Report
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-[#FDBA74] border border-amber-200 dark:border-amber-900/60 rounded font-semibold">
                  {overdueReport.length} Flagged
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white mt-1">
                Active non-terminal work orders where scheduled date has lapsed past current UTC timestamp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={api.getOverdueReportExportUrl()}
                download="maintainiq_overdue_work_orders.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Export overdue work orders report to CSV"
              >
                <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Export Overdue CSV</span>
              </a>
              <button
                onClick={fetchOverdueReport}
                className="p-1.5 text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition cursor-pointer"
                title="Refresh Report"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isLoadingOverdue ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-white animate-pulse">
              Loading overdue audit records from MySQL database...
            </div>
          ) : overdueError ? (
            <div className="p-6 text-center text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
              <span>{overdueError}</span>
            </div>
          ) : overdueReport.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-[#123C32] text-emerald-600 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Zero Overdue Work Orders</h4>
              <p className="text-xs text-slate-500 dark:text-white max-w-sm mx-auto">
                Excellent! All active work orders are within their planned scheduled dates and SLAs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-slate-600 dark:text-white font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Work Order</th>
                    <th className="py-2.5 px-4">Priority / Status</th>
                    <th className="py-2.5 px-4">Asset Details</th>
                    <th className="py-2.5 px-4">Assigned Tech</th>
                    <th className="py-2.5 px-4">Scheduled Date</th>
                    <th className="py-2.5 px-4 text-right">Days Overdue</th>
                    {onSelectWorkOrder && <th className="py-2.5 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#334155] dark:bg-[#131F32]">
                  {overdueReport.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1E3048] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-teal-700 dark:text-teal-400 text-xs">
                          {item.work_order_number}
                        </div>
                        <div className="font-medium text-slate-800 dark:text-white line-clamp-1">{item.title}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PriorityBadge priority={item.priority} />
                          <StatusBadge status={item.status} showIcon={false} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-white">{item.asset_name || `Asset #${item.asset_id}`}</div>
                        <div className="text-[11px] text-slate-500 dark:text-white font-mono">
                          {item.asset_tag} {item.location ? `• ${item.location}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-white font-medium">
                          {item.technician_name || (
                            <span className="text-slate-400 dark:text-white italic">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-white">
                        {formatShortDate(item.scheduled_date)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="inline-block px-2 py-0.5 rounded bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-[#FDA4AF] font-bold border border-rose-200 dark:border-rose-900/60">
                          {item.days_overdue} day{item.days_overdue === 1 ? '' : 's'} late
                        </span>
                      </td>
                      {onSelectWorkOrder && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectWorkOrder(item.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold cursor-pointer"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TECHNICIAN WORKLOAD REPORT */}
      {activeTab === 'technicians' && (
        <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Technician Workload & Capacity Audit
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-[#131F32] text-slate-600 dark:text-white border border-slate-200 dark:border-[#334155] rounded font-semibold">
                  {techReport.length} Staff
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white mt-1">
                Active work order allocation, estimated backlog hours, and current workload utilization tiers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={api.getTechnicianWorkloadReportExportUrl()}
                download="maintainiq_technician_workload.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Export technician workload report to CSV"
              >
                <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Export Workload CSV</span>
              </a>
              <button
                onClick={fetchTechReport}
                className="p-1.5 text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition cursor-pointer"
                title="Refresh Report"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isLoadingTech ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-white animate-pulse">
              Computing live technician workloads from database...
            </div>
          ) : techError ? (
            <div className="p-6 text-center text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
              <span>{techError}</span>
            </div>
          ) : techReport.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-white">
              No registered technicians found in database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-slate-600 dark:text-white font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Technician</th>
                    <th className="py-2.5 px-4">Specialization</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Active Orders</th>
                    <th className="py-2.5 px-4 text-right">Backlog Hours</th>
                    <th className="py-2.5 px-4 text-right">Completed WOs</th>
                    <th className="py-2.5 px-4 text-right">Total Assigned</th>
                    <th className="py-2.5 px-4 text-right">Capacity Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#334155] dark:bg-[#131F32]">
                  {techReport.map((tech) => (
                    <tr key={tech.technician_id} className="hover:bg-slate-50/80 dark:hover:bg-[#1E3048] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{tech.name}</div>
                        <div className="font-mono text-teal-700 dark:text-teal-400 text-[11px]">{tech.employee_id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-white font-medium">
                        {tech.specialization}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono",
                            tech.status === "ACTIVE"
                              ? "bg-emerald-50 dark:bg-[#123C32] text-emerald-700 dark:text-[#6EE7B7] border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-100 dark:bg-[#131F32] text-slate-600 dark:text-white border border-slate-200 dark:border-[#334155]"
                          )}
                        >
                          {tech.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                        {tech.active_work_orders_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-white">
                        {tech.active_estimated_hours.toFixed(1)} hrs
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        {tech.completed_work_orders_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-white">
                        {tech.total_assigned_count}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block",
                            tech.utilization_status === "OVERLOADED"
                              ? "bg-rose-100 dark:bg-[#4C1826] text-rose-800 dark:text-[#FDA4AF] border border-rose-300 dark:border-rose-900/60"
                              : tech.utilization_status === "HEAVY"
                              ? "bg-amber-100 dark:bg-[#452A16] text-amber-800 dark:text-[#FDBA74] border border-amber-300 dark:border-amber-900/60"
                              : tech.utilization_status === "OPTIMAL"
                              ? "bg-teal-100 dark:bg-[#123C32] text-teal-800 dark:text-[#6EE7B7] border border-teal-300 dark:border-teal-800"
                              : "bg-emerald-100 dark:bg-[#123C32] text-emerald-800 dark:text-[#6EE7B7] border border-emerald-300 dark:border-emerald-800"
                          )}
                        >
                          {tech.utilization_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
