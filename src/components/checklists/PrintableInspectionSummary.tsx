import React from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ShieldCheck,
  Calendar,
  User,
  Wrench,
  Paperclip,
  Check
} from 'lucide-react';
import { WorkOrder, WorkOrderChecklist } from '../../api/types';

interface PrintableInspectionSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: WorkOrderChecklist;
  workOrder: WorkOrder;
}

export const PrintableInspectionSummary: React.FC<PrintableInspectionSummaryProps> = ({
  isOpen,
  onClose,
  checklist,
  workOrder,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCompleted = Boolean(checklist.completed_at);
  const hasFailures = checklist.has_failed_items;

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Modal Controls - Hidden during print */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">Printable Inspection Report</h3>
              <p className="text-[11px] text-slate-300">
                Official digital inspection certificate & verification record
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-inspection-document" className="p-8 space-y-6 text-slate-800 bg-white">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-900">
                <div className="w-8 h-8 rounded bg-teal-700 text-white font-black flex items-center justify-center text-base tracking-wider font-mono">
                  IQ
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                    MaintainIQ Enterprise
                  </h1>
                  <p className="text-[11px] tracking-widest text-slate-500 uppercase font-semibold">
                    Quality Assurance & Equipment Maintenance Verification
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right sm:text-right">
              <span
                className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider border ${
                  hasFailures
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {hasFailures ? 'Inspection Failed' : isCompleted ? 'Certified Pass' : 'In Progress'}
              </span>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                Ref: {workOrder.work_order_number} | Doc ID: CHK-{checklist.id}
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Work Order</span>
              <span className="font-mono font-bold text-slate-900">{workOrder.work_order_number}</span>
              <span className="block text-[11px] text-slate-600 truncate">{workOrder.title}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Equipment</span>
              <span className="font-mono font-bold text-teal-700">
                {workOrder.asset?.asset_tag || '—'}
              </span>
              <span className="block text-[11px] text-slate-600 truncate">
                {workOrder.asset?.name || '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Location & Category</span>
              <span className="font-semibold text-slate-900">
                {workOrder.asset?.location || '—'}
              </span>
              <span className="block text-[11px] text-slate-500">
                {workOrder.asset?.category || 'General'}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Technician</span>
              <span className="font-semibold text-slate-900">
                {workOrder.technician?.name || 'Unassigned'}
              </span>
              <span className="block text-[11px] text-slate-500">
                {workOrder.technician?.specialization || '—'}
              </span>
            </div>
          </div>

          {/* Checklist Summary KPI Bar */}
          <div className="grid grid-cols-5 gap-3 text-center">
            <div className="p-2.5 rounded border border-slate-200 bg-white">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Items</span>
              <span className="text-base font-bold text-slate-900">{checklist.total_items}</span>
            </div>
            <div className="p-2.5 rounded border border-emerald-200 bg-emerald-50/50">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Passed</span>
              <span className="text-base font-bold text-emerald-700">{checklist.passed_items}</span>
            </div>
            <div className="p-2.5 rounded border border-rose-200 bg-rose-50/50">
              <span className="text-[10px] font-bold uppercase text-rose-700 block">Failed</span>
              <span className="text-base font-bold text-rose-700">{checklist.failed_items}</span>
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">N / A</span>
              <span className="text-base font-bold text-slate-600">{checklist.na_items}</span>
            </div>
            <div className="p-2.5 rounded border border-teal-200 bg-teal-50/50">
              <span className="text-[10px] font-bold uppercase text-teal-700 block">Completion</span>
              <span className="text-base font-bold text-teal-800">{checklist.completion_percentage}%</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-200">
              Checklist Item Verification Records
            </h3>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-slate-600 text-[11px]">
                  <th className="py-2 px-2.5 w-10 text-center font-bold">#</th>
                  <th className="py-2 px-3 font-bold">Inspection Requirement</th>
                  <th className="py-2 px-3 w-28 text-center font-bold">Status</th>
                  <th className="py-2 px-3 font-bold">Observations & Notes</th>
                  <th className="py-2 px-3 w-36 font-bold">Inspector / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {checklist.items.map((item, idx) => {
                  const isPass = item.status === 'PASS';
                  const isFail = item.status === 'FAIL';
                  const isNA = item.status === 'NOT_APPLICABLE';
                  const isPending = item.status === 'PENDING';

                  return (
                    <tr
                      key={item.id}
                      className={isFail ? 'bg-rose-50/60' : idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                    >
                      <td className="py-2.5 px-2.5 text-center font-mono font-semibold text-slate-500">
                        {item.order_index}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{item.item_text}</span>
                          {item.is_required && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded uppercase">
                              Required
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                        )}
                        {item.has_attachment && item.attachment_filename && (
                          <div className="flex items-center gap-1 text-[10px] text-teal-700 font-medium mt-1">
                            <Paperclip className="w-3 h-3 text-teal-600" />
                            <span>Evidence: {item.attachment_filename}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isFail
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isNA
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isPass && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                          {isFail && <XCircle className="w-3 h-3 text-rose-700" />}
                          {isNA && <MinusCircle className="w-3 h-3 text-slate-600" />}
                          {isPending && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                          <span>{item.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {item.notes ? (
                          <span className="italic">{item.notes}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <div>{item.inspected_by || '—'}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(item.inspected_at)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Observations */}
          {checklist.summary_notes && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <span className="font-bold uppercase text-slate-700 text-[11px]">
                Overall Inspector Summary & Disposition Notes:
              </span>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {checklist.summary_notes}
              </p>
            </div>
          )}

          {/* Formal Sign-Off Box */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspected By</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {checklist.completed_by || workOrder.technician?.name || 'Verified Technician'}
                </span>
                <span className="block text-[11px] text-slate-500">
                  Certified Maintenance Specialist
                </span>
              </div>
              <div className="border-b border-slate-400 pb-1 w-64">
                <span className="text-[10px] uppercase text-slate-400 block mb-4">Technician Signature</span>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sign-off Date & Time</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {formatDate(checklist.completed_at || checklist.updated_at)}
                </span>
                <span className="block text-[11px] text-slate-500">
                  Timestamp recorded into immutable audit history
                </span>
              </div>
              <div className="border-b border-slate-400 pb-1 w-64">
                <span className="text-[10px] uppercase text-slate-400 block mb-4">Quality Lead / Supervisor Stamp</span>
              </div>
            </div>
          </div>

          {/* Footer Legal Disclaimer */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
            MaintainIQ Digital Asset Maintenance System • Document generated electronically on{' '}
            {new Date().toISOString()} • Preserved for regulatory compliance.
          </div>
        </div>
      </div>
    </div>
  );
};
