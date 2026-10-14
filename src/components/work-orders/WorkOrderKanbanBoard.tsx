import React, { useState } from 'react';
import { WorkOrder, WorkOrderStatus } from '../../api/types';
import { PriorityBadge } from '../ui/StatusBadge';
import { SlaBadge } from '../../lib/sla';
import { formatShortDate } from '../../lib/utils';
import {
  User,
  Calendar,
  MoreVertical,
  ExternalLink,
  Copy,
  Eye,
  Wrench,
  GripVertical
} from 'lucide-react';

interface WorkOrderKanbanBoardProps {
  workOrders: WorkOrder[];
  isLoading: boolean;
  onSelectWorkOrder: (id: number) => void;
  onOpenDrawer: (wo: WorkOrder) => void;
  onOpenDuplicate: (wo: WorkOrder) => void;
  onRequestTransition: (wo: WorkOrder, targetStatus: WorkOrderStatus) => void;
  onNotification?: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
}

const COLUMNS: { status: WorkOrderStatus; title: string; color: string; badgeClass: string }[] = [
  { status: 'OPEN', title: 'Open', color: 'border-slate-300 dark:border-slate-600', badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
  { status: 'ASSIGNED', title: 'Assigned', color: 'border-blue-300 dark:border-blue-600', badgeClass: 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300' },
  { status: 'IN_PROGRESS', title: 'In Progress', color: 'border-amber-300 dark:border-amber-600', badgeClass: 'bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-[#FDBA74]' },
  { status: 'COMPLETED', title: 'Completed', color: 'border-emerald-300 dark:border-emerald-600', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-[#6EE7B7]' },
  { status: 'CANCELLED', title: 'Cancelled', color: 'border-rose-300 dark:border-rose-600', badgeClass: 'bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-[#FDA4AF]' },
];

export const WorkOrderKanbanBoard: React.FC<WorkOrderKanbanBoardProps> = ({
  workOrders,
  isLoading,
  onSelectWorkOrder,
  onOpenDrawer,
  onOpenDuplicate,
  onRequestTransition,
  onNotification = (msg) => alert(msg),
}) => {
  const [draggedOrder, setDraggedOrder] = useState<WorkOrder | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<WorkOrderStatus | null>(null);
  const [openMenuWoId, setOpenMenuWoId] = useState<number | null>(null);

  // Group work orders by status
  const ordersByStatus: Record<WorkOrderStatus, WorkOrder[]> = {
    OPEN: [],
    ASSIGNED: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    CANCELLED: [],
  };

  workOrders.forEach((wo) => {
    if (ordersByStatus[wo.status]) {
      ordersByStatus[wo.status].push(wo);
    }
  });

  const handleDragStart = (e: React.DragEvent, wo: WorkOrder) => {
    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
      e.preventDefault();
      onNotification(
        `Cannot move order ${wo.work_order_number}: Terminal orders (${wo.status}) are immutable per business rules.`,
        'warning'
      );
      return;
    }
    setDraggedOrder(wo);
    e.dataTransfer.setData('text/plain', String(wo.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: WorkOrderStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnStatus) {
      setDragOverColumn(columnStatus);
    }
  };

  const handleDragLeave = (columnStatus: WorkOrderStatus) => {
    if (dragOverColumn === columnStatus) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: WorkOrderStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedOrder) return;
    const wo = draggedOrder;
    setDraggedOrder(null);

    if (wo.status === targetStatus) return;

    // Validate state transitions
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      OPEN: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[wo.status] || [];

    if (!allowed.includes(targetStatus)) {
      if (targetStatus === 'COMPLETED') {
        onNotification(
          `Cannot drag ${wo.work_order_number} to COMPLETED: An order must first be IN_PROGRESS and fulfill all inspection checklist requirements.`,
          'warning'
        );
      } else if (wo.status === 'OPEN' && targetStatus === 'IN_PROGRESS') {
        onNotification(
          `Cannot move ${wo.work_order_number} directly to IN_PROGRESS: The work order must be ASSIGNED to a technician first.`,
          'warning'
        );
      } else {
        onNotification(
          `Invalid state transition: Cannot change status from ${wo.status} to ${targetStatus}.`,
          'error'
        );
      }
      return;
    }

    onRequestTransition(wo, targetStatus);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="bg-slate-100/70 dark:bg-[#131F32] rounded-lg p-3 space-y-3 border border-slate-200/80 dark:border-[#334155]">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
            <div className="space-y-2">
              <div className="h-28 bg-white dark:bg-[#172338] rounded border border-slate-200 dark:border-[#334155] animate-pulse" />
              <div className="h-28 bg-white dark:bg-[#172338] rounded border border-slate-200 dark:border-[#334155] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start min-h-[500px]">
      {COLUMNS.map((column) => {
        const columnOrders = ordersByStatus[column.status] || [];
        const isTarget = dragOverColumn === column.status;

        return (
          <div
            key={column.status}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={() => handleDragLeave(column.status)}
            onDrop={(e) => handleDrop(e, column.status)}
            className={`flex flex-col bg-slate-100/70 dark:bg-[#131F32] rounded-lg border-t-4 ${column.color} p-2.5 min-h-[450px] transition-colors ${
              isTarget ? 'bg-teal-50/70 dark:bg-teal-950/60 ring-2 ring-teal-500' : 'border border-slate-200/80 dark:border-[#334155]'
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-1.5 py-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-slate-800 dark:text-white">{column.title}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${column.badgeClass}`}>
                  {columnOrders.length}
                </span>
              </div>
            </div>

            {/* Column Orders List */}
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[75vh] pr-0.5">
              {columnOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-400 text-xs italic border border-dashed border-slate-200 dark:border-[#334155] rounded bg-white/40 dark:bg-[#172338]/40">
                  No orders in {column.title}
                </div>
              ) : (
                columnOrders.map((wo) => {
                  const isTerminal = wo.status === 'COMPLETED' || wo.status === 'CANCELLED';

                  return (
                    <div
                      key={wo.id}
                      draggable={!isTerminal}
                      onDragStart={(e) => handleDragStart(e, wo)}
                      onClick={() => onOpenDrawer(wo)}
                      className={`bg-white dark:bg-[#172338] rounded-md border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-3 cursor-pointer hover:border-teal-400 dark:hover:border-teal-400 hover:shadow-xs transition-all relative group ${
                        isTerminal ? 'opacity-90' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      {/* Drag Handle & Top Badges */}
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isTerminal && (
                            <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
                            {wo.work_order_number}
                          </span>
                          <PriorityBadge priority={wo.priority} />
                        </div>

                        {/* Menu button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuWoId(openMenuWoId === wo.id ? null : wo.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-[#1E3048] transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {openMenuWoId === wo.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-6 z-30 w-36 bg-white dark:bg-[#172338] border border-slate-200 dark:border-[#334155] rounded-md shadow-lg py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in"
                            >
                              <button
                                onClick={() => {
                                  setOpenMenuWoId(null);
                                  onOpenDrawer(wo);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1E3048] flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400" /> Quick View
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuWoId(null);
                                  onSelectWorkOrder(wo.id);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1E3048] flex items-center gap-1.5 cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> Full Details
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuWoId(null);
                                  onOpenDuplicate(wo);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#1E3048] flex items-center gap-1.5 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-2 leading-tight group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors mb-2">
                        {wo.title}
                      </h4>

                      {/* Equipment Tag */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                        <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono bg-slate-100 dark:bg-[#111B2E] border border-transparent dark:border-[#334155] px-1 py-0.2 rounded text-[10px] text-slate-700 dark:text-slate-300">
                          {wo.asset?.asset_tag || `Asset #${wo.asset_id}`}
                        </span>
                        <span className="truncate">{wo.asset?.name}</span>
                      </div>

                      {/* SLA Indicator */}
                      <div className="mb-2">
                        <SlaBadge workOrder={wo} />
                      </div>

                      {/* Footer: Technician & Schedule */}
                      <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        {wo.technician ? (
                          <div className="flex items-center gap-1.5 truncate max-w-[110px]" title={wo.technician.name}>
                            <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[9px] font-bold">
                              {wo.technician.name.charAt(0)}
                            </div>
                            <span className="truncate text-slate-700 dark:text-slate-300">{wo.technician.name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px] flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-300 dark:text-slate-600" /> Unassigned
                          </span>
                        )}

                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatShortDate(wo.scheduled_date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
