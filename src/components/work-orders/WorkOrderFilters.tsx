import React from 'react';
import { Search, X, RotateCcw, Download, Calendar, AlertCircle } from 'lucide-react';
import { Asset, Technician, MaintenanceType } from '../../api/types';

interface WorkOrderFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  assetFilter: string;
  onAssetChange: (assetId: string) => void;
  technicianFilter: string;
  onTechnicianChange: (techId: string) => void;
  maintenanceTypeFilter?: string;
  onMaintenanceTypeChange?: (mType: string) => void;
  isOverdueOnly?: boolean;
  onIsOverdueChange?: (overdue: boolean) => void;
  startDate?: string;
  onStartDateChange?: (date: string) => void;
  endDate?: string;
  onEndDateChange?: (date: string) => void;
  exportUrl?: string;
  assets: Asset[];
  technicians: Technician[];
  maintenanceTypes?: MaintenanceType[];
  onResetFilters: () => void;
}

export const WorkOrderFilters: React.FC<WorkOrderFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  assetFilter,
  onAssetChange,
  technicianFilter,
  onTechnicianChange,
  maintenanceTypeFilter = '',
  onMaintenanceTypeChange,
  isOverdueOnly = false,
  onIsOverdueChange,
  startDate = '',
  onStartDateChange,
  endDate = '',
  onEndDateChange,
  exportUrl,
  assets,
  technicians,
  maintenanceTypes = [],
  onResetFilters,
}) => {
  const hasActiveFilters = Boolean(
    searchQuery ||
    statusFilter ||
    priorityFilter ||
    assetFilter ||
    technicianFilter ||
    maintenanceTypeFilter ||
    isOverdueOnly ||
    startDate ||
    endDate
  );

  return (
    <div className="bg-white dark:bg-[#172338] p-4 rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] mb-4 space-y-3">
      {/* Row 1: Search and Main Selects */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search work orders (e.g., WO-2026-0001, Vibration, Chiller)..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Combined Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Maintenance Type Filter */}
          {onMaintenanceTypeChange && (
            <select
              value={maintenanceTypeFilter}
              onChange={(e) => onMaintenanceTypeChange(e.target.value)}
              className="text-xs py-2 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[150px] truncate cursor-pointer"
            >
              <option value="">All Types</option>
              {maintenanceTypes.map((mt) => (
                <option key={mt.id} value={mt.id}>
                  {mt.name}
                </option>
              ))}
            </select>
          )}

          {/* Asset Filter */}
          <select
            value={assetFilter}
            onChange={(e) => onAssetChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[170px] truncate cursor-pointer"
          >
            <option value="">All Assets</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.asset_tag} — {a.name}
              </option>
            ))}
          </select>

          {/* Technician Filter */}
          <select
            value={technicianFilter}
            onChange={(e) => onTechnicianChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[160px] truncate cursor-pointer"
          >
            <option value="">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.specialization})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Date Filters, Overdue Toggle & Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#334155]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Overdue Checkbox */}
          {onIsOverdueChange && (
            <label className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-[#FDA4AF] font-medium cursor-pointer select-none bg-rose-50 dark:bg-[#4C1826]/70 hover:bg-rose-100/80 dark:hover:bg-[#4C1826] px-2 py-1 rounded border border-rose-200 dark:border-rose-900/60 transition-colors">
              <input
                type="checkbox"
                checked={isOverdueOnly}
                onChange={(e) => onIsOverdueChange(e.target.checked)}
                className="w-3.5 h-3.5 text-rose-600 rounded border-rose-300 dark:border-[#334155] focus:ring-rose-500"
              />
              <AlertCircle className="w-3 h-3 text-rose-600 dark:text-[#FDA4AF]" />
              <span>Overdue Only</span>
            </label>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Scheduled:</span>
          </div>

          {onStartDateChange && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="text-xs py-1 px-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          )}

          {onEndDateChange && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="text-xs py-1 px-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs py-1 px-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#131F32] hover:bg-slate-200 dark:hover:bg-[#1E3048] border border-transparent dark:border-[#334155] rounded transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3 text-slate-500 dark:text-slate-300" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Export CSV Action */}
        {exportUrl && (
          <a
            href={exportUrl}
            download="maintainiq_work_orders.csv"
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-md font-medium transition-colors shadow-2xs cursor-pointer ml-auto"
            title="Export currently filtered work orders to RFC 4180 CSV"
          >
            <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Export CSV</span>
          </a>
        )}
      </div>
    </div>
  );
};
