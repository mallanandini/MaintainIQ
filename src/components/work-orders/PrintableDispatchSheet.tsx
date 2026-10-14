import React, { useEffect } from 'react';
import {
  Printer,
  X,
  FileText,
  AlertTriangle,
  Calendar,
  User,
  Wrench,
  Building,
  MapPin,
  Clock,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';
import { WorkOrder } from '../../api/types';

interface PrintableDispatchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
}

export const PrintableDispatchSheet: React.FC<PrintableDispatchSheetProps> = ({
  isOpen,
  onClose,
  workOrder,
}) => {
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

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

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

  const isEmergency =
    workOrder.priority === 'CRITICAL' ||
    workOrder.maintenance_type?.is_emergency ||
    workOrder.maintenance_type?.code === 'EMERGENCY';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Modal Controls - Hidden during print */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">Printable Work-Order Dispatch Sheet</h3>
              <p className="text-[11px] text-slate-300">
                Official field maintenance order, assignment sheet & physical sign-off
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
        <div id="printable-dispatch-document" className="p-8 space-y-6 text-slate-800 bg-white">
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
                    Maintenance & Field Dispatch Operations Sheet
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-xs text-slate-500 font-semibold uppercase">Dispatch Order #</div>
              <div className="text-base font-bold text-slate-900 tracking-wider">
                {workOrder.work_order_number}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Printed: {new Date().toLocaleString()}
              </div>
            </div>
          </div>

          {/* Emergency Alert Banner if Critical */}
          {isEmergency && (
            <div className="bg-rose-50 border-2 border-rose-600 rounded-lg p-3.5 flex items-center gap-3 text-rose-950">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold uppercase tracking-wider text-xs bg-rose-600 text-white px-2 py-0.5 rounded mr-2">
                  PRIORITY: CRITICAL
                </span>
                <span className="text-xs font-semibold">
                  EMERGENCY DISPATCH PROTOCOL ACTIVE. Immediate field response and supervisor sign-off required.
                </span>
              </div>
            </div>
          )}

          {/* Key Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Status
              </span>
              <span className="text-xs font-bold text-slate-900 uppercase inline-block mt-0.5 px-2 py-0.5 bg-slate-200 rounded">
                {workOrder.status}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Priority Tier
              </span>
              <span
                className={`text-xs font-bold uppercase inline-block mt-0.5 px-2 py-0.5 rounded ${
                  workOrder.priority === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800'
                    : workOrder.priority === 'HIGH'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-teal-100 text-teal-800'
                }`}
              >
                {workOrder.priority}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Scheduled Target
              </span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                {formatDate(workOrder.scheduled_date)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Estimated Labor
              </span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                {workOrder.estimated_hours} hrs {workOrder.actual_hours ? `(${workOrder.actual_hours} actual)` : ''}
              </span>
            </div>
          </div>

          {/* Section 1: Target Asset Specifications */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Target Physical Asset Specification
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Asset Name / Title</span>
                <span className="font-bold text-slate-900">{workOrder.asset?.name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Asset Tag / Serial ID</span>
                <span className="font-mono font-bold text-teal-700">{workOrder.asset?.asset_tag || '—'}</span>
                {workOrder.asset?.serial_number && (
                  <span className="text-slate-500 block text-[10px]">SN: {workOrder.asset.serial_number}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Category & Criticality</span>
                <span className="font-medium text-slate-800">
                  {workOrder.asset?.category || 'General'} ({workOrder.asset?.criticality || 'MEDIUM'} Criticality)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Physical Location</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {workOrder.asset?.location || 'Plant Floor / Unspecified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Asset Status</span>
                <span className="font-semibold text-slate-800">{workOrder.asset?.status || 'OPERATIONAL'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Manufacturer / Model</span>
                <span className="font-medium text-slate-800">
                  {workOrder.asset?.manufacturer || '—'} {workOrder.asset?.model_number ? `/ ${workOrder.asset.model_number}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Technician Assignment & Work Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Maintenance Work Scope
                </h2>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Work Order Title</span>
                  <span className="font-bold text-slate-900 text-sm">{workOrder.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Maintenance Type</span>
                  <span className="font-semibold text-slate-800">
                    {workOrder.maintenance_type?.name || 'General Maintenance'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Detailed Scope / Work Description</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {workOrder.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Assigned Technician
                </h2>
              </div>
              <div className="p-4 space-y-3 text-xs">
                {workOrder.technician ? (
                  <>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Technician Name</span>
                      <span className="font-bold text-slate-900 text-sm">{workOrder.technician.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Employee ID</span>
                      <span className="font-mono font-semibold text-teal-700">
                        {workOrder.technician.employee_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Specialization</span>
                      <span className="font-medium text-slate-800">{workOrder.technician.specialization}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Contact</span>
                      <span className="text-slate-700">{workOrder.technician.email}</span>
                      {workOrder.technician.phone && (
                        <span className="block text-slate-600">{workOrder.technician.phone}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-slate-500 italic">
                    Unassigned — Field Technician Pending Assignment
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Safety Compliance & Lockout/Tagout (LOTO) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Mandatory Safety, LOTO & PPE Compliance
              </h2>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400 rounded-xs"></div>
                <span className="text-slate-700 font-medium">Eye Protection / Face Shield</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400 rounded-xs"></div>
                <span className="text-slate-700 font-medium">Steel Toe Footwear</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400 rounded-xs"></div>
                <span className="text-slate-700 font-medium">High-Voltage / Cut Gloves</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400 rounded-xs"></div>
                <span className="text-slate-700 font-medium">Hearing Protection</span>
              </div>
              <div className="col-span-2 sm:col-span-4 mt-2 p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px]">
                <span className="font-bold">LOTO Protocol Required:</span> Verify zero energy state on all electrical,
                hydraulic, and pneumatic lines prior to disassembling covers or touching moving elements.
              </div>
            </div>
          </div>

          {/* Section 4: Physical Sign-Off and Execution Verification */}
          <div className="border-2 border-slate-800 rounded-lg overflow-hidden pt-1">
            <div className="bg-slate-800 text-white px-4 py-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span>Field Dispatch Sign-Off & Verification</span>
              <span className="text-[10px] font-normal text-slate-300">MaintainIQ Enterprise Compliance</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="border-b border-dashed border-slate-400 pb-8 relative">
                <span className="text-slate-500 block text-[11px] mb-1 font-semibold uppercase">
                  1. Dispatched By (Supervisor)
                </span>
                <div className="absolute bottom-1 left-0 right-0 flex justify-between text-[10px] text-slate-500">
                  <span>Sign & Date</span>
                  <span>Time: ___________</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-400 pb-8 relative">
                <span className="text-slate-500 block text-[11px] mb-1 font-semibold uppercase">
                  2. Technician Acknowledgment
                </span>
                <div className="absolute bottom-1 left-0 right-0 flex justify-between text-[10px] text-slate-500">
                  <span>Sign & Date</span>
                  <span>Badge #: ________</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-400 pb-8 relative">
                <span className="text-slate-500 block text-[11px] mb-1 font-semibold uppercase">
                  3. Field Completion Verification
                </span>
                <div className="absolute bottom-1 left-0 right-0 flex justify-between text-[10px] text-slate-500">
                  <span>Lead Sign</span>
                  <span>Actual Hrs: ______</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Footer */}
          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
            MaintainIQ Enterprise Work Order Dispatch Record • Document generated from verified system database • Confidential & Proprietary
          </div>
        </div>
      </div>
    </div>
  );
};
