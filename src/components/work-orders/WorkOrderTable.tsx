import React from 'react';
import { WorkOrder } from '../../api/types';
import { StatusBadge, PriorityBadge } from '../ui/StatusBadge';
import { SlaBadge } from '../../lib/sla';
import { formatShortDate, cn } from '../../lib/utils';
import {
  ChevronRight,
  User,
  Calendar,
  Clock,
  AlertCircle,
  FileQuestion,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Copy,
  ExternalLink
} from 'lucide-react';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
  error?: string | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (column: string) => void;
  selectedIds: number[];
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: number) => void;
  onSelectWorkOrder: (id: number) => void;
  onOpenDrawer: (wo: WorkOrder) => void;
  onOpenDuplicate: (wo: WorkOrder) => void;
  onOpenCreateWO: () => void;
  onResetFilters?: () => void;
}

export const WorkOrderTable: React.FC<WorkOrderTableProps> = ({
  workOrders,
  isLoading,
  error,
  totalCount,
  currentPage,
  pageSize,
  sortBy,
  sortOrder = 'asc',
  onPageChange,
  onPageSizeChange,
  onSortChange,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectRow,
  onSelectWorkOrder,
  onOpenDrawer,
  onOpenDuplicate,
  onOpenCreateWO,
  onResetFilters,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(startIndex + workOrders.length - 1, totalCount);

  const allVisibleSelected =
    workOrders.length > 0 && workOrders.every((wo) => selectedIds.includes(wo.id));
  const someVisibleSelected =
    workOrders.some((wo) => selectedIds.includes(wo.id)) && !allVisibleSelected;

  const renderSortIndicator = (col: string) => {
    if (sortBy !== col) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline opacity-0 group-hover/col:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="w-3 h-3 text-teal-600 ml-1 inline" />
    ) : (
      <ArrowUp className="w-3 h-3 text-teal-600 ml-1 inline" />
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded border border-slate-200/90 overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/6"></div>
        </div>
        <div className="space-y-3 pt-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded p-6 text-center text-rose-800">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="font-semibold text-sm">Failed to load work orders</h3>
        <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-1.5 bg-rose-600 text-white text-xs font-medium rounded hover:bg-rose-700 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No work orders found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No work orders match the current search or filters. Try adjusting your criteria or create a new order.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
          <button
            onClick={onOpenCreateWO}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
          >
            Create Work Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#131F32] rounded border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider select-none">
              {/* Checkbox column */}
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someVisibleSelected;
                  }}
                  onChange={onToggleSelectAll}
                  aria-label="Select all work orders on current page"
                  className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 dark:border-[#334155] focus:ring-teal-500 cursor-pointer"
                />
              </th>

              {/* WO Number */}
              <th
                onClick={() => onSortChange('work_order_number')}
                className="py-3 px-3 w-36 cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>WO Number</span>
                {renderSortIndicator('work_order_number')}
              </th>

              {/* Title & Asset */}
              <th
                onClick={() => onSortChange('title')}
                className="py-3 px-3 min-w-[220px] cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>Title & Asset</span>
                {renderSortIndicator('title')}
              </th>

              {/* Priority */}
              <th
                onClick={() => onSortChange('priority')}
                className="py-3 px-3 w-24 cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>Priority</span>
                {renderSortIndicator('priority')}
              </th>

              {/* Status */}
              <th
                onClick={() => onSortChange('status')}
                className="py-3 px-3 w-28 cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>Status</span>
                {renderSortIndicator('status')}
              </th>

              {/* SLA Indicator */}
              <th className="py-3 px-3 w-28">
                <span>SLA Target</span>
              </th>

              {/* Technician */}
              <th className="py-3 px-3 min-w-[150px]">
                <span>Technician</span>
              </th>

              {/* Scheduled Date */}
              <th
                onClick={() => onSortChange('scheduled_date')}
                className="py-3 px-3 w-32 cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>Scheduled</span>
                {renderSortIndicator('scheduled_date')}
              </th>

              {/* Est Hours */}
              <th
                onClick={() => onSortChange('estimated_hours')}
                className="py-3 px-3 w-20 text-right cursor-pointer group/col hover:text-slate-800 dark:hover:text-white"
              >
                <span>Est. Hrs</span>
                {renderSortIndicator('estimated_hours')}
              </th>

              {/* Actions */}
              <th className="py-3 px-3 w-24 text-right">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-xs text-slate-700 dark:text-slate-200">
            {workOrders.map((wo) => {
              const isSelected = selectedIds.includes(wo.id);

              return (
                <tr
                  key={wo.id}
                  className={cn(
                    "transition-colors group bg-white dark:bg-[#131F32]",
                    isSelected ? 'bg-teal-50/40 dark:bg-teal-950/40 hover:bg-teal-50/70 dark:hover:bg-teal-950/60' : 'hover:bg-slate-50/70 dark:hover:bg-[#1E3048]'
                  )}
                >
                  {/* Select Checkbox */}
                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectRow(wo.id)}
                      aria-label={`Select ${wo.work_order_number}`}
                      className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 dark:border-[#334155] focus:ring-teal-500 cursor-pointer"
                    />
                  </td>

                  {/* WO Number */}
                  <td className="py-3 px-3 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenDrawer(wo)}
                      className="text-teal-700 dark:text-teal-400 font-semibold hover:underline text-left cursor-pointer"
                      title="Open quick drawer"
                    >
                      {wo.work_order_number}
                    </button>
                  </td>

                  {/* Title & Asset info */}
                  <td className="py-3 px-3">
                    <div
                      onClick={() => onOpenDrawer(wo)}
                      className="font-medium text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-400 transition-colors line-clamp-1 cursor-pointer"
                      title={wo.title}
                    >
                      {wo.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#172338] border border-transparent dark:border-[#334155] px-1 py-0.2 rounded text-[10px]">
                        {wo.asset?.asset_tag || `Asset #${wo.asset_id}`}
                      </span>
                      <span>·</span>
                      <span className="truncate max-w-[170px] dark:text-slate-300">{wo.asset?.name || 'Asset'}</span>
                      <span>·</span>
                      <span className="text-slate-400 dark:text-slate-400">{wo.maintenance_type?.name}</span>
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-3">
                    <PriorityBadge priority={wo.priority} />
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <StatusBadge status={wo.status} />
                  </td>

                  {/* SLA Indicator */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <SlaBadge workOrder={wo} />
                  </td>

                  {/* Technician */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {wo.technician ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                          {wo.technician.name.charAt(0)}
                        </div>
                        <div className="truncate max-w-[120px]">
                          <div className="font-medium text-slate-800 dark:text-white text-[11px] truncate">
                            {wo.technician.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {wo.technician.specialization}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-300 dark:text-slate-600" /> Unassigned
                      </span>
                    )}
                  </td>

                  {/* Scheduled Date */}
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatShortDate(wo.scheduled_date)}</span>
                    </div>
                  </td>

                  {/* Est Hours */}
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {wo.estimated_hours.toFixed(1)}h
                  </td>

                  {/* Action icons */}
                  <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onOpenDrawer(wo)}
                        className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition-colors cursor-pointer"
                        title="Quick View Drawer"
                        aria-label="Quick View Drawer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDuplicate(wo)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition-colors cursor-pointer"
                        title="Duplicate Order"
                        aria-label="Duplicate Order"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectWorkOrder(wo.id)}
                        className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition-colors cursor-pointer"
                        title="Full Details Page"
                        aria-label="Full Details Page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination & Status Footer */}
      <div className="px-4 py-3 bg-slate-50/50 dark:bg-[#111B2E] border-t border-slate-200/80 dark:border-[#334155] text-[11px] text-slate-500 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            Showing <span className="font-medium text-slate-800 dark:text-white">{startIndex}</span> to{' '}
            <span className="font-medium text-slate-800 dark:text-white">{endIndex}</span> of{' '}
            <span className="font-medium text-slate-800 dark:text-white">{totalCount}</span> work orders
          </div>
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-[#334155]">
            <span className="text-slate-400 dark:text-slate-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
              aria-label="Items per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Page Navigators */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="First Page"
            aria-label="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-white">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Last Page"
            aria-label="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
