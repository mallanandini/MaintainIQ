import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { Asset, Technician, WorkOrderPriority, WorkOrderStatus } from '../../api/types';

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
  assets: Asset[];
  technicians: Technician[];
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
  assets,
  technicians,
  onResetFilters,
}) => {
  const hasActiveFilters = Boolean(
    searchQuery || statusFilter || priorityFilter || assetFilter || technicianFilter
  );

  return (
    <div className="bg-white p-4 rounded border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] mb-5 space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search work orders (e.g., WO-2026-0001, Vibration, Chiller)..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Combined Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
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
            className="text-xs py-2 px-2.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Asset Filter */}
          <select
            value={assetFilter}
            onChange={(e) => onAssetChange(e.target.value)}
            className="text-xs py-2 px-2.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[180px] truncate cursor-pointer"
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
            className="text-xs py-2 px-2.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 max-w-[170px] truncate cursor-pointer"
          >
            <option value="">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.specialization})
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs py-2 px-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
