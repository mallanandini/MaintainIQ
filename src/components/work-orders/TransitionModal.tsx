import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatus, Technician } from '../../api/types';
import { StatusBadge } from '../ui/StatusBadge';
import { AlertTriangle, X, Check, ArrowRight } from 'lucide-react';

interface TransitionModalProps {
  workOrder: WorkOrder;
  technicians: Technician[];
  isOpen: boolean;
  onClose: () => void;
  initialTargetStatus?: WorkOrderStatus;
  onTransition: (data: {
    to_status: WorkOrderStatus;
    notes?: string;
    changed_by?: string;
    actual_hours?: number;
    resolution_summary?: string;
    cancellation_reason?: string;
  }) => Promise<void>;
}

export const TransitionModal: React.FC<TransitionModalProps> = ({
  workOrder,
  technicians,
  isOpen,
  onClose,
  initialTargetStatus,
  onTransition,
}) => {
  if (!isOpen) return null;

  const currentStatus = workOrder.status;

  // Determine allowed target states per the lifecycle rules
  const allowedTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
    OPEN: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  const nextOptions = allowedTransitions[currentStatus] || [];
  const [selectedTarget, setSelectedTarget] = useState<WorkOrderStatus>(
    (initialTargetStatus && nextOptions.includes(initialTargetStatus))
      ? initialTargetStatus
      : (nextOptions[0] || currentStatus)
  );
  const [changedBy, setChangedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [actualHours, setActualHours] = useState<string>(
    workOrder.actual_hours ? String(workOrder.actual_hours) : String(workOrder.estimated_hours)
  );
  const [resolutionSummary, setResolutionSummary] = useState(workOrder.resolution_summary || '');
  const [cancellationReason, setCancellationReason] = useState(workOrder.cancellation_reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side rule pre-validation
    if (selectedTarget === 'COMPLETED' && !resolutionSummary.trim()) {
      setErrorMessage('Please provide a resolution summary before completing the work order.');
      return;
    }

    if (selectedTarget === 'CANCELLED' && !cancellationReason.trim()) {
      setErrorMessage('Please state the reason for cancelling this work order.');
      return;
    }

    if (selectedTarget === 'IN_PROGRESS' && !workOrder.assigned_technician_id) {
      setErrorMessage('Cannot move to In Progress without an assigned technician. Please assign a technician first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onTransition({
        to_status: selectedTarget,
        changed_by: changedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        actual_hours: selectedTarget === 'COMPLETED' && actualHours ? parseFloat(actualHours) : undefined,
        resolution_summary: selectedTarget === 'COMPLETED' ? resolutionSummary.trim() : undefined,
        cancellation_reason: selectedTarget === 'CANCELLED' ? cancellationReason.trim() : undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Transition failed. Recheck business rules.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-[#111B2E] text-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm tracking-tight">Transition Work Order Lifecycle</h3>
            <p className="text-xs text-slate-300 font-mono mt-0.5">{workOrder.work_order_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current vs Target State */}
          <div className="p-3 bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-white uppercase font-semibold">Current State</div>
              <div className="mt-1">
                <StatusBadge status={currentStatus} />
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-white" />
            <div>
              <div className="text-[10px] text-slate-500 dark:text-white uppercase font-semibold">Target State</div>
              <div className="mt-1">
                <StatusBadge status={selectedTarget} />
              </div>
            </div>
          </div>

          {/* Target State Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-white mb-1">
              Select Valid Transition State
            </label>
            <div className="grid grid-cols-2 gap-2">
              {nextOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedTarget(opt)}
                  className={`py-2 px-3 text-xs font-semibold rounded border text-left flex items-center justify-between transition-colors cursor-pointer ${
                    selectedTarget === opt
                      ? 'border-teal-600 dark:border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                      : 'border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-[#1E3048]'
                  }`}
                >
                  <span>{opt}</span>
                  {selectedTarget === opt && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Changed By Operator (Optional when authentication is absent) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-white mb-1">
              Operator / Changed By <span className="text-slate-400 dark:text-white font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              placeholder="e.g. Lead Dispatcher or Tech ID"
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Extra inputs for COMPLETED */}
          {selectedTarget === 'COMPLETED' && (
            <div className="p-3.5 bg-emerald-50/60 dark:bg-[#123C32]/40 border border-emerald-200 dark:border-emerald-800 rounded space-y-3">
              <div className="text-xs font-semibold text-emerald-900 dark:text-[#6EE7B7]">Completion Details</div>
              <div>
                <label className="block text-[11px] font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                  Actual Labor Hours Spent
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 border border-emerald-300 dark:border-emerald-800 rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                  Resolution Summary & Technical Root Cause
                </label>
                <textarea
                  rows={3}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Describe repair actions taken, parts replaced, and clearance checks performed..."
                  className="w-full text-xs p-2.5 border border-emerald-300 dark:border-emerald-800 rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Extra inputs for CANCELLED */}
          {selectedTarget === 'CANCELLED' && (
            <div className="p-3.5 bg-rose-50/60 dark:bg-[#4C1826]/40 border border-rose-200 dark:border-rose-900/60 rounded space-y-3">
              <div className="text-xs font-semibold text-rose-900 dark:text-[#FDA4AF]">Cancellation Record</div>
              <div>
                <label className="block text-[11px] font-medium text-rose-800 dark:text-rose-300 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Duplicate ticket, redundant work, parts obsolete..."
                  className="w-full text-xs p-2.5 border border-rose-300 dark:border-rose-900/60 rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Transition Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-white mb-1">
              Transition Log Comment (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Initial inspections cleared, moving to floor rebuild"
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-[#4C1826]/50 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-700 dark:text-[#FDA4AF] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Verifying Transition...' : 'Apply Transition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
