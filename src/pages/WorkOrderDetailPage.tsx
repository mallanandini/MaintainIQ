import React, { useState, useEffect } from 'react';
import { WorkOrder, Technician, WorkOrderStatus } from '../api/types';
import { api } from '../api/client';
import { StatusBadge, PriorityBadge, AssetStatusBadge } from '../components/ui/StatusBadge';
import { StatusHistoryTimeline } from '../components/work-orders/StatusHistoryTimeline';
import { TransitionModal } from '../components/work-orders/TransitionModal';
import { formatDate, formatShortDate } from '../lib/utils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Wrench,
  Cpu,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Edit2,
  Save,
  Check,
  Building,
  MapPin,
  Tag
} from 'lucide-react';

interface WorkOrderDetailPageProps {
  workOrderId: number;
  technicians: Technician[];
  onBack: () => void;
  onSelectAsset?: (assetId: number) => void;
  onSelectTechnician?: (techId: number) => void;
}

export const WorkOrderDetailPage: React.FC<WorkOrderDetailPageProps> = ({
  workOrderId,
  technicians,
  onBack,
  onSelectAsset,
  onSelectTechnician,
}) => {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal State
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<any>('MEDIUM');
  const [editTechId, setEditTechId] = useState<string>('');
  const [editEstHours, setEditEstHours] = useState<string>('1.0');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWorkOrder(workOrderId);
      setWorkOrder(data);
      setEditTitle(data.title);
      setEditDescription(data.description);
      setEditPriority(data.priority);
      setEditTechId(data.assigned_technician_id ? String(data.assigned_technician_id) : '');
      setEditEstHours(String(data.estimated_hours));
    } catch (err: any) {
      setError(err.message || 'Failed to load work order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [workOrderId]);

  const handleTransition = async (payload: any) => {
    await api.transitionWorkOrder(workOrderId, payload);
    await fetchDetail();
  };

  const handleSaveEdit = async () => {
    setUpdateError(null);
    setIsSavingEdit(true);
    try {
      await api.updateWorkOrder(workOrderId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        assigned_technician_id: editTechId ? parseInt(editTechId, 10) : null,
        estimated_hours: parseFloat(editEstHours) || 1.0,
      });
      setIsEditing(false);
      await fetchDetail();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update work order.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
        <div className="h-10 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-3 gap-6 pt-4">
          <div className="col-span-2 h-96 bg-slate-100 rounded"></div>
          <div className="h-96 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-900">Work order not found</h3>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded cursor-pointer"
        >
          Return to List
        </button>
      </div>
    );
  }

  const isTerminal = workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Work Orders
        </button>

        {/* Lifecycle State Actions */}
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <>
              <button
                onClick={() => setIsTransitionOpen(true)}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Transition Status</span>
              </button>

              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </>
          )}

          {isTerminal && (
            <div className="text-xs font-medium text-slate-500 italic px-2 py-1 bg-slate-100 rounded">
              Terminal state — edits and transitions locked.
            </div>
          )}
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white p-6 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                {workOrder.work_order_number}
              </span>
              <StatusBadge status={workOrder.status} />
              <PriorityBadge priority={workOrder.priority} />
              <span className="text-xs text-slate-400 font-mono">
                Created {formatDate(workOrder.created_at)}
              </span>
            </div>

            {!isEditing ? (
              <h2 className="text-xl font-bold text-slate-900 tracking-tight pt-1">
                {workOrder.title}
              </h2>
            ) : (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-bold text-slate-900 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Update Error Banner */}
        {updateError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div>{updateError}</div>
          </div>
        )}

        {/* Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <div className="text-slate-400 text-[11px] uppercase font-semibold">Scheduled Target</div>
            <div className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDate(workOrder.scheduled_date)}</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px] uppercase font-semibold">Maintenance Type</div>
            <div className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
              <Wrench className="w-3.5 h-3.5 text-slate-400" />
              <span>{workOrder.maintenance_type?.name}</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px] uppercase font-semibold">Estimated Labor</div>
            <div className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{workOrder.estimated_hours} hours</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px] uppercase font-semibold">Actual Labor</div>
            <div className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>{workOrder.actual_hours ? `${workOrder.actual_hours} hours` : 'Pending completion'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scope & Resolution (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              Scope of Work & Procedures
            </h3>
            {!isEditing ? (
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                {workOrder.description}
              </p>
            ) : (
              <textarea
                rows={5}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            )}
          </div>

          {/* Edit Inline Controls when in Edit Mode */}
          {isEditing && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 text-xs">
              <h4 className="font-semibold text-slate-900">Modify Work Order Assignment & Priority</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full py-1.5 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL (Requires assigned technician)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assigned Technician</label>
                  <select
                    value={editTechId}
                    onChange={(e) => setEditTechId(e.target.value)}
                    className="w-full py-1.5 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Completion / Cancellation Records */}
          {workOrder.status === 'COMPLETED' && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Work Order Resolution Report</span>
              </div>
              <p className="text-xs text-emerald-800 whitespace-pre-wrap leading-relaxed pl-6">
                {workOrder.resolution_summary || 'Resolved per standard operating procedure.'}
              </p>
            </div>
          )}

          {workOrder.status === 'CANCELLED' && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-5 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Work Order Cancellation Record</span>
              </div>
              <p className="text-xs text-rose-800 whitespace-pre-wrap leading-relaxed pl-6">
                {workOrder.cancellation_reason || 'Cancelled by dispatcher.'}
              </p>
            </div>
          )}

          {/* Status History Timeline */}
          <div className="bg-white p-6 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
              <span>Lifecycle Status History</span>
              <span className="text-[11px] font-normal text-slate-400">
                {workOrder.status_history?.length || 0} events recorded
              </span>
            </h3>
            <StatusHistoryTimeline history={workOrder.status_history} />
          </div>
        </div>

        {/* Right Column: Asset & Technician Details (1 Col) */}
        <div className="space-y-6">
          {/* Asset Card */}
          <div className="bg-white p-5 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Cpu className="w-4 h-4 text-teal-600" />
                <span>Target Asset</span>
              </div>
              {workOrder.asset && (
                <AssetStatusBadge status={workOrder.asset.status} className="scale-90" />
              )}
            </div>

            {workOrder.asset ? (
              <div className="space-y-2 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{workOrder.asset.name}</div>
                  <div className="font-mono text-[11px] text-teal-700 font-medium">
                    {workOrder.asset.asset_tag}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-slate-600 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{workOrder.asset.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Category: {workOrder.asset.category}</span>
                  </div>
                  {workOrder.asset.serial_number && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      <span>S/N: {workOrder.asset.serial_number}</span>
                    </div>
                  )}
                </div>

                {onSelectAsset && (
                  <button
                    onClick={() => onSelectAsset(workOrder.asset!.id)}
                    className="w-full mt-2 py-1.5 text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors cursor-pointer"
                  >
                    View Asset & Maintenance History
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No asset linked</div>
            )}
          </div>

          {/* Technician Card */}
          <div className="bg-white p-5 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <User className="w-4 h-4 text-teal-600" />
                <span>Assigned Technician</span>
              </div>
              {workOrder.technician && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {workOrder.technician.status}
                </span>
              )}
            </div>

            {workOrder.technician ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                    {workOrder.technician.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{workOrder.technician.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {workOrder.technician.specialization}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-600 text-[11px]">
                  <div>Email: {workOrder.technician.email}</div>
                  {workOrder.technician.phone && <div>Phone: {workOrder.technician.phone}</div>}
                  <div>ID: {workOrder.technician.employee_id}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No technician assigned yet.
                {!isTerminal && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="block mx-auto mt-2 text-teal-700 font-semibold text-[11px] hover:underline"
                  >
                    Assign Technician
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      {isTransitionOpen && (
        <TransitionModal
          workOrder={workOrder}
          technicians={technicians}
          isOpen={isTransitionOpen}
          onClose={() => setIsTransitionOpen(false)}
          onTransition={handleTransition}
        />
      )}
    </div>
  );
};
