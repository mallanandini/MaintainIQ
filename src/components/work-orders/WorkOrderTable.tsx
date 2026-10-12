import React from 'react';
import { WorkOrder } from '../../api/types';
import { StatusBadge, PriorityBadge } from '../ui/StatusBadge';
import { formatDate, formatShortDate } from '../../lib/utils';
import { 
  ChevronRight, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle,
  FileQuestion,
  Wrench
} from 'lucide-react';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
  error?: string | null;
  onSelectWorkOrder: (id: number) => void;
  onOpenCreateWO: () => void;
  onResetFilters?: () => void;
}

export const WorkOrderTable: React.FC<WorkOrderTableProps> = ({
  workOrders,
  isLoading,
  error,
  onSelectWorkOrder,
  onOpenCreateWO,
  onResetFilters,
}) => {
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
          className="mt-4 px-4 py-1.5 bg-rose-600 text-white text-xs font-medium rounded hover:bg-rose-700 transition-colors"
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
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
          >
            Create Work Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-36">WO Number</th>
              <th className="py-3 px-4 min-w-[240px]">Title & Asset</th>
              <th className="py-3 px-3 w-28">Priority</th>
              <th className="py-3 px-3 w-32">Status</th>
              <th className="py-3 px-4 min-w-[160px]">Technician</th>
              <th className="py-3 px-4 w-36">Scheduled</th>
              <th className="py-3 px-3 w-20 text-right">Est. Hrs</th>
              <th className="py-3 px-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {workOrders.map((wo) => (
              <tr
                key={wo.id}
                onClick={() => onSelectWorkOrder(wo.id)}
                className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
              >
                {/* WO Number */}
                <td className="py-3.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-teal-700 font-semibold group-hover:underline">
                      {wo.work_order_number}
                    </span>
                  </div>
                </td>

                {/* Title & Asset info */}
                <td className="py-3.5 px-4">
                  <div className="font-medium text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                    {wo.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                      {wo.asset?.asset_tag || `Asset #${wo.asset_id}`}
                    </span>
                    <span>·</span>
                    <span className="truncate max-w-[200px]">{wo.asset?.name || 'Asset'}</span>
                    <span>·</span>
                    <span className="text-slate-400">{wo.maintenance_type?.name}</span>
                  </div>
                </td>

                {/* Priority */}
                <td className="py-3.5 px-3">
                  <PriorityBadge priority={wo.priority} />
                </td>

                {/* Status */}
                <td className="py-3.5 px-3">
                  <StatusBadge status={wo.status} />
                </td>

                {/* Technician */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {wo.technician ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-700">
                        {wo.technician.name.charAt(0)}
                      </div>
                      <div className="truncate max-w-[130px]">
                        <div className="font-medium text-slate-800 text-[11px] truncate">
                          {wo.technician.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {wo.technician.specialization}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-300" /> Unassigned
                    </span>
                  )}
                </td>

                {/* Scheduled Date */}
                <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatShortDate(wo.scheduled_date)}</span>
                  </div>
                </td>

                {/* Est Hours */}
                <td className="py-3.5 px-3 text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                  {wo.estimated_hours.toFixed(1)}h
                </td>

                {/* Arrow */}
                <td className="py-3.5 px-3 text-right">
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
        <div>Showing <span className="font-medium text-slate-800">{workOrders.length}</span> work orders</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Critical
          </span>
        </div>
      </div>
    </div>
  );
};
