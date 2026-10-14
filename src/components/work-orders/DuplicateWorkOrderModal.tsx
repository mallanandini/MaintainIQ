import React, { useState, useEffect } from 'react';
import { WorkOrder, Technician, WorkOrderPriority } from '../../api/types';
import { api } from '../../api/client';
import { Copy, X, AlertTriangle, ArrowRight, Loader2, Calendar, User, ShieldAlert } from 'lucide-react';
import { PriorityBadge } from '../ui/StatusBadge';

interface DuplicateWorkOrderModalProps {
  workOrder: WorkOrder;
  technicians: Technician[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newWo: WorkOrder) => void;
}

export const DuplicateWorkOrderModal: React.FC<DuplicateWorkOrderModalProps> = ({
  workOrder,
  technicians,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Tomorrow's date formatted as YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const defaultDate = workOrder.scheduled_date && new Date(workOrder.scheduled_date) > new Date()
    ? workOrder.scheduled_date.split('T')[0]
    : tomorrowStr;

  const [title, setTitle] = useState(`Copy of ${workOrder.title}`);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [priority, setPriority] = useState<WorkOrderPriority>(workOrder.priority);
  const [technicianId, setTechnicianId] = useState<number | ''>(
    workOrder.assigned_technician_id || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(`Copy of ${workOrder.title}`);
      setPriority(workOrder.priority);
      setTechnicianId(workOrder.assigned_technician_id || '');
      setScheduledDate(defaultDate);
      setError(null);
    }
  }, [isOpen, workOrder]);

  if (!isOpen) return null;

  const activeTechnicians = technicians.filter((t) => t.status === 'ACTIVE');
  const isCritical = priority === 'CRITICAL';
  const assetIsOutOfService = workOrder.asset?.status === 'OUT_OF_SERVICE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!scheduledDate) {
      setError('Scheduled date is required.');
      return;
    }

    // Rule 2 check: CRITICAL requires technician
    if (isCritical && !technicianId) {
      setError('Rule 2 Enforced: Critical priority work orders require an assigned technician.');
      return;
    }

    // Rule 5 check: Scheduled date cannot be in the past
    const todayStr = new Date().toISOString().split('T')[0];
    if (scheduledDate < todayStr) {
      setError('Rule 5 Enforced: Scheduled date cannot be in the past.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newWo = await api.duplicateWorkOrder(workOrder.id, {
        title: title.trim(),
        scheduled_date: new Date(scheduledDate).toISOString(),
        priority,
        assigned_technician_id: technicianId ? Number(technicianId) : null,
      });
      onSuccess(newWo);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate work order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-wo-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-md border border-teal-200">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h2 id="duplicate-wo-title" className="text-sm font-semibold text-slate-900">
                Duplicate Work Order
              </h2>
              <p className="text-[11px] text-slate-500">
                Clones <span className="font-mono font-medium text-slate-700">{workOrder.work_order_number}</span> with a new unique number and re-validates all rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="duplicate-form" onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Info Notice */}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Target Asset:</span>
              <span className="font-mono font-medium text-slate-800">
                {workOrder.asset?.asset_tag || `Asset #${workOrder.asset_id}`} — {workOrder.asset?.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Maintenance Type:</span>
              <span className="font-medium text-slate-700">{workOrder.maintenance_type?.name}</span>
            </div>
            {assetIsOutOfService && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-center gap-1.5 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Notice: Asset is OUT_OF_SERVICE. Rule 6 applies (EMERGENCY maintenance only).</span>
              </div>
            )}
          </div>

          {/* New Title */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Priority <span className="text-rose-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical (Mandatory Technician)</option>
            </select>
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Scheduled Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={scheduledDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Per Rule 5, past dates are automatically rejected.
            </p>
          </div>

          {/* Technician Assignment */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Assigned Technician {isCritical && <span className="text-rose-500">* (Required for CRITICAL)</span>}
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value ? Number(e.target.value) : '')}
              required={isCritical}
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">-- {isCritical ? 'Assign technician (Required)' : 'Unassigned (OPEN status)'} --</option>
              {activeTechnicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.specialization}) — Active orders: {t.active_work_orders_count ?? 0}
                </option>
              ))}
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="duplicate-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Duplicating...
              </>
            ) : (
              <>
                Duplicate & Validate
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
