import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatusHistory } from '../../api/types';
import { api } from '../../api/client';
import { StatusBadge, PriorityBadge } from '../ui/StatusBadge';
import { SlaBadge } from '../../lib/sla';
import { StatusHistoryTimeline } from './StatusHistoryTimeline';
import { formatDate, formatShortDate } from '../../lib/utils';
import {
  X,
  ExternalLink,
  Copy,
  ArrowRightLeft,
  Calendar,
  Clock,
  User,
  Wrench,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  MapPin,
  Layers
} from 'lucide-react';

interface WorkOrderDetailDrawerProps {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFullDetails: (id: number) => void;
  onOpenDuplicate: (wo: WorkOrder) => void;
  onOpenTransition: (wo: WorkOrder) => void;
}

export const WorkOrderDetailDrawer: React.FC<WorkOrderDetailDrawerProps> = ({
  workOrder,
  isOpen,
  onClose,
  onViewFullDetails,
  onOpenDuplicate,
  onOpenTransition,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const [history, setHistory] = useState<WorkOrderStatusHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!isOpen || !workOrder) {
      setHistory([]);
      return;
    }

    // Load status history
    setIsLoadingHistory(true);
    api.getWorkOrderHistory(workOrder.id)
      .then((hist: WorkOrderStatusHistory[]) => setHistory(hist))
      .catch(() => {
        if (workOrder.status_history) {
          setHistory(workOrder.status_history);
        }
      })
      .finally(() => setIsLoadingHistory(false));
  }, [isOpen, workOrder?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !workOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#172338] h-full shadow-2xl border-l border-slate-200 dark:border-[#334155] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={`Work Order Details: ${workOrder.work_order_number}`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-[#334155] bg-slate-50/70 dark:bg-[#111B2E] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                  {workOrder.work_order_number}
                </span>
                <StatusBadge status={workOrder.status} />
                <PriorityBadge priority={workOrder.priority} />
                <SlaBadge workOrder={workOrder} />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2 mt-1">
                {workOrder.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-[#1E3048] transition-colors cursor-pointer shrink-0"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-[#334155] flex-wrap">
            <button
              type="button"
              onClick={() => onViewFullDetails(workOrder.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Full Details
            </button>

            {workOrder.status !== 'COMPLETED' && workOrder.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={() => onOpenTransition(workOrder)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#131F32] hover:bg-slate-50 dark:hover:bg-[#1E3048] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#334155] text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Change Status
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenDuplicate(workOrder)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#131F32] hover:bg-slate-50 dark:hover:bg-[#1E3048] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#334155] text-xs font-medium rounded transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Duplicate Order
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] px-5 shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Overview & Specifications
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-teal-600 dark:border-teal-400 text-teal-700 dark:text-teal-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Activity Timeline ({history.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700 dark:text-slate-200 space-y-5 bg-white dark:bg-[#172338]">
          {activeTab === 'overview' ? (
            <>
              {/* Description */}
              <div className="bg-slate-50/80 dark:bg-[#111B2E] p-3.5 rounded-lg border border-slate-200/80 dark:border-[#334155]">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Scope & Description
                </span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {workOrder.description || 'No description provided.'}
                </p>
              </div>

              {/* Asset & Technician Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Asset Details */}
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                    <Wrench className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Target Equipment</span>
                  </div>
                  {workOrder.asset ? (
                    <div className="space-y-1 text-[11px]">
                      <div className="font-medium text-slate-800 dark:text-white">{workOrder.asset.name}</div>
                      <div className="font-mono text-slate-500 dark:text-slate-400">{workOrder.asset.asset_tag}</div>
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{workOrder.asset.location}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-slate-400">Status:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{workOrder.asset.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">Asset #{workOrder.asset_id}</div>
                  )}
                </div>

                {/* Technician Details */}
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                    <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Assigned Technician</span>
                  </div>
                  {workOrder.technician ? (
                    <div className="space-y-1 text-[11px]">
                      <div className="font-medium text-slate-800 dark:text-white">{workOrder.technician.name}</div>
                      <div className="text-slate-500 dark:text-slate-400">{workOrder.technician.specialization}</div>
                      <div className="text-slate-500 dark:text-slate-400">{workOrder.technician.email}</div>
                      <div className="pt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          workOrder.technician.status === 'ACTIVE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-[#FDBA74]'
                        }`}>
                          {workOrder.technician.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic py-2">
                      No technician currently assigned.
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance & Timing Grid */}
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] space-y-3">
                <div className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Execution & Timing Specs</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Maintenance Type</span>
                    <span className="font-medium text-slate-800 dark:text-white">
                      {workOrder.maintenance_type?.name || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Scheduled Date</span>
                    <span className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatShortDate(workOrder.scheduled_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Estimated Effort</span>
                    <span className="font-medium text-slate-800 dark:text-white flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {workOrder.estimated_hours} hrs
                    </span>
                  </div>
                  {workOrder.actual_hours != null && (
                    <div>
                      <span className="text-slate-400 block">Actual Logged</span>
                      <span className="font-medium text-slate-800 dark:text-white font-mono">
                        {workOrder.actual_hours} hrs
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block">Created On</span>
                    <span className="text-slate-600 dark:text-slate-300 font-mono">
                      {formatDate(workOrder.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Updated</span>
                    <span className="text-slate-600 dark:text-slate-300 font-mono">
                      {formatDate(workOrder.updated_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Completion or Cancellation Details if terminal */}
              {workOrder.status === 'COMPLETED' && workOrder.resolution_summary && (
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Resolution Summary</span>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-200 leading-relaxed text-[11px]">
                    {workOrder.resolution_summary}
                  </p>
                </div>
              )}

              {workOrder.status === 'CANCELLED' && workOrder.cancellation_reason && (
                <div className="p-3.5 bg-rose-50/70 dark:bg-[#4C1826]/70 border border-rose-200 dark:border-rose-900/60 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-rose-900 dark:text-[#FDA4AF]">
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Cancellation Reason</span>
                  </div>
                  <p className="text-rose-800 dark:text-[#FDA4AF] leading-relaxed text-[11px]">
                    {workOrder.cancellation_reason}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Activity Timeline Tab */
            <div>
              {isLoadingHistory ? (
                <div className="py-8 text-center text-slate-400 animate-pulse">
                  Loading activity timeline...
                </div>
              ) : (
                <StatusHistoryTimeline history={history} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#111B2E] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>MaintainIQ Enterprise v3.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 dark:bg-[#1E3048] hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
