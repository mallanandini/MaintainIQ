import React, { useState } from 'react';
import { Technician, BulkAssignTechnicianResponse } from '../../api/types';
import { api } from '../../api/client';
import { Users, X, AlertTriangle, CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';

interface BulkAssignModalProps {
  selectedIds: number[];
  technicians: Technician[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkAssignModal: React.FC<BulkAssignModalProps> = ({
  selectedIds,
  technicians,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedTechId, setSelectedTechId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkAssignTechnicianResponse | null>(null);

  if (!isOpen) return null;

  const activeTechnicians = technicians.filter((t) => t.status === 'ACTIVE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) {
      setError('Please select an active technician to assign.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.bulkAssignTechnician({
        work_order_ids: selectedIds,
        technician_id: Number(selectedTechId),
      });
      setResult(res);
      if (res.success_count > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Bulk assignment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTechId('');
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-assign-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-md border border-teal-200">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 id="bulk-assign-title" className="text-sm font-semibold text-slate-900">
                Bulk Assign Technician
              </h2>
              <p className="text-[11px] text-slate-500">
                Assign {selectedIds.length} selected work {selectedIds.length === 1 ? 'order' : 'orders'} to an active technician
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <form id="bulk-assign-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-600">
                <span className="font-semibold text-slate-800">{selectedIds.length}</span> work orders selected for assignment. Terminal orders (<code className="text-slate-700 font-mono">COMPLETED</code>, <code className="text-slate-700 font-mono">CANCELLED</code>) will be skipped safely per business rules.
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1.5">
                  Select Active Technician <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">-- Choose active technician --</option>
                  {activeTechnicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} — {tech.specialization} (Active orders: {tech.active_work_orders_count ?? 0})
                    </option>
                  ))}
                </select>
                {activeTechnicians.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No active technicians currently available in the system.
                  </p>
                )}
              </div>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 text-xs">
                    Bulk Operation Completed
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {result.success_count} succeeded, {result.failure_count} skipped/failed out of {result.total_requested}.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    {result.success_count} Success
                  </span>
                  {result.failure_count > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                      {result.failure_count} Failed
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] uppercase font-semibold text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-2">WO Number</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {result.results.map((item) => (
                      <tr key={item.work_order_id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-medium text-slate-800">
                          {item.work_order_number || `#${item.work_order_id}`}
                        </td>
                        <td className="p-2">
                          {item.success ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                              <XCircle className="w-3 h-3 text-rose-600" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-600 truncate max-w-[200px]" title={item.error || ''}>
                          {item.error || 'Assigned successfully'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulk-assign-form"
                disabled={isSubmitting || !selectedTechId}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    Assign {selectedIds.length} Orders
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
