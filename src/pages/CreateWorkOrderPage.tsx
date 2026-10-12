import React, { useState } from 'react';
import { 
  Asset, 
  Technician, 
  MaintenanceType, 
  WorkOrderPriority, 
  CreateWorkOrderPayload, 
  WorkOrder 
} from '../api/types';
import { api } from '../api/client';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  ShieldAlert,
  Info
} from 'lucide-react';
import { AssetStatusBadge } from '../components/ui/StatusBadge';

interface CreateWorkOrderPageProps {
  assets: Asset[];
  technicians: Technician[];
  maintenanceTypes: MaintenanceType[];
  onBack: () => void;
  onSuccess: (newOrder: WorkOrder) => void;
}

export const CreateWorkOrderPage: React.FC<CreateWorkOrderPageProps> = ({
  assets,
  technicians,
  maintenanceTypes,
  onBack,
  onSuccess,
}) => {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState<string>(assets[0] ? String(assets[0].id) : '');
  const [maintenanceTypeId, setMaintenanceTypeId] = useState<string>(
    maintenanceTypes[0] ? String(maintenanceTypes[0].id) : ''
  );
  const [priority, setPriority] = useState<WorkOrderPriority>('MEDIUM');
  const [technicianId, setTechnicianId] = useState<string>('');
  
  // Default scheduled date = tomorrow 09:00 AM in local ISO format
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const defaultDateStr = tomorrow.toISOString().slice(0, 16);

  const [scheduledDate, setScheduledDate] = useState<string>(defaultDateStr);
  const [estimatedHours, setEstimatedHours] = useState<string>('2.0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected entities for rule checking
  const selectedAsset = assets.find((a) => String(a.id) === assetId);
  const selectedMaintType = maintenanceTypes.find((m) => String(m.id) === maintenanceTypeId);

  // Business Rule Live Warnings:
  // Rule 2: CRITICAL orders must have an assigned technician
  const isRule2Violated = priority === 'CRITICAL' && !technicianId;

  // Rule 5: Cannot be scheduled in the past
  const isDateInPast = (() => {
    if (!scheduledDate) return false;
    const chosen = new Date(scheduledDate);
    const now = new Date();
    // allow 2 minute buffer
    return chosen.getTime() < (now.getTime() - 120000);
  })();

  // Rule 6: OUT_OF_SERVICE asset cannot receive non-emergency orders
  const isAssetOutOfService = selectedAsset?.status === 'OUT_OF_SERVICE';
  const isEmergencyOrder = selectedMaintType?.is_emergency || selectedMaintType?.code === 'EMERGENCY' || priority === 'CRITICAL';
  const isRule6Violated = isAssetOutOfService && !isEmergencyOrder;

  const isAssetDecommissioned = selectedAsset?.status === 'DECOMMISSIONED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isDateInPast) {
      setErrorMessage('Rule 5 Violation: Scheduled date cannot be in the past.');
      return;
    }

    if (isRule2Violated) {
      setErrorMessage('Rule 2 Violation: CRITICAL work orders must have an assigned technician.');
      return;
    }

    if (isAssetDecommissioned) {
      setErrorMessage(`Asset '${selectedAsset?.name}' is DECOMMISSIONED and cannot receive new work orders.`);
      return;
    }

    if (isRule6Violated) {
      setErrorMessage(`Rule 6 Violation: Asset '${selectedAsset?.name}' is OUT_OF_SERVICE and can only receive Emergency maintenance or CRITICAL priority work orders.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateWorkOrderPayload = {
        title: title.trim(),
        description: description.trim(),
        asset_id: parseInt(assetId, 10),
        maintenance_type_id: parseInt(maintenanceTypeId, 10),
        priority,
        assigned_technician_id: technicianId ? parseInt(technicianId, 10) : null,
        scheduled_date: new Date(scheduledDate).toISOString(),
        estimated_hours: parseFloat(estimatedHours) || 1.0,
      };

      const created = await api.createWorkOrder(payload);
      onSuccess(created);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create work order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Back button & Breadcrumb */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-4 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Work Orders
      </button>

      <div className="bg-white rounded-lg border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900">Create Work Order</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register a maintenance work order with automated unique sequencing and lifecycle rule validation.
          </p>
        </div>

        {/* Business Rule Live Alert Banners */}
        <div className="px-6 pt-4 space-y-2">
          {isRule2Violated && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Rule 2 Requirement:</strong> CRITICAL priority work orders must have an assigned technician before submission.
              </div>
            </div>
          )}

          {isRule6Violated && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Rule 6 Constraint:</strong> Selected asset is <strong>OUT_OF_SERVICE</strong>. You must select maintenance type <strong>Emergency</strong> or set priority to <strong>CRITICAL</strong>.
              </div>
            </div>
          )}

          {isDateInPast && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Rule 5 Constraint:</strong> Work orders cannot be scheduled in the past.
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              1. Work Order Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Order Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Main Spindle Vibration Telemetry Fault"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Scope of Work & Symptoms <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail the failure mode, observed temperature/pressure readings, physical symptoms, and specific maintenance procedures..."
                className="w-full text-xs p-3 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Asset & Maintenance Classification */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              2. Target Asset & Maintenance Type
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asset Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Target Asset <span className="text-rose-500">*</span>
                  </label>
                  {selectedAsset && (
                    <AssetStatusBadge status={selectedAsset.status} className="scale-90" />
                  )}
                </div>
                <select
                  required
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_tag} — {a.name} ({a.status})
                    </option>
                  ))}
                </select>
                {selectedAsset && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Location: {selectedAsset.location} · Category: {selectedAsset.category}
                  </div>
                )}
              </div>

              {/* Maintenance Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maintenance Type <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={maintenanceTypeId}
                  onChange={(e) => setMaintenanceTypeId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {maintenanceTypes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.is_emergency ? '(EMERGENCY)' : ''}
                    </option>
                  ))}
                </select>
                {selectedMaintType?.description && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {selectedMaintType.description}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Priority & Dispatch Assignment */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              3. Priority & Technician Dispatch
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority Level <span className="text-rose-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                  className={`w-full text-xs px-3 py-2 border rounded bg-white focus:outline-none cursor-pointer ${
                    priority === 'CRITICAL' ? 'border-rose-400 font-semibold text-rose-700' : 'border-slate-300'
                  }`}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL (Requires Assigned Tech)</option>
                </select>
                <div className="mt-1 text-[11px] text-slate-500">
                  {priority === 'CRITICAL'
                    ? 'Requires mandatory assigned technician dispatch.'
                    : 'Standard operational priority queue.'}
                </div>
              </div>

              {/* Technician */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Technician {priority === 'CRITICAL' ? <span className="text-rose-500">* (Required)</span> : '(Optional)'}
                </label>
                <select
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  className={`w-full text-xs px-3 py-2 border rounded bg-white focus:outline-none cursor-pointer ${
                    isRule2Violated ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'
                  }`}
                >
                  <option value="">-- Leave Unassigned (Status: OPEN) --</option>
                  {technicians
                    .filter((t) => t.status === 'ACTIVE')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.specialization} ({t.employee_id})
                      </option>
                    ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500">
                  {technicianId ? 'Will immediately set initial status to ASSIGNED.' : 'Will create with status OPEN.'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Schedule & Labor Estimate */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              4. Target Schedule & Labor Estimate
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scheduled Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scheduled Date & Time <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded bg-white focus:outline-none ${
                      isDateInPast ? 'border-rose-400 text-rose-700' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Must be scheduled for future or current datetime.
                </div>
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Labor Hours <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  required
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  Target expected downtime and technician wrench time.
                </div>
              </div>
            </div>
          </div>

          {/* Server Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Backend Rule Rejection:</div>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isRule2Violated || isRule6Violated || isDateInPast}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? 'Creating Work Order...' : 'Submit Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
