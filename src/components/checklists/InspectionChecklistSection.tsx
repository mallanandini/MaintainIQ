import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Upload,
  Paperclip,
  Trash2,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  WorkOrder,
  WorkOrderChecklist,
  WorkOrderChecklistItem,
  ChecklistTemplate,
  ChecklistItemStatus
} from '../../api/types';
import { api } from '../../api/client';
import { PrintableInspectionSummary } from './PrintableInspectionSummary';

interface InspectionChecklistSectionProps {
  workOrder: WorkOrder;
  onChecklistUpdated?: () => void;
}

export const InspectionChecklistSection: React.FC<InspectionChecklistSectionProps> = ({
  workOrder,
  onChecklistUpdated,
}) => {
  const [checklist, setChecklist] = useState<WorkOrderChecklist | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Per-item action state
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [itemInspectors, setItemInspectors] = useState<Record<number, string>>({});

  // Finalize state
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [finalSummaryNotes, setFinalSummaryNotes] = useState<string>('');
  const [finalInspectorName, setFinalInspectorName] = useState<string>(
    workOrder.technician?.name || 'Assigned Technician'
  );
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Printable modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Hidden file input refs mapped by item id
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const loadChecklist = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWorkOrderChecklist(workOrder.id);
      setChecklist(data);

      if (data) {
        // Initialize local note state for quick editing
        const notesMap: Record<number, string> = {};
        const inspectorsMap: Record<number, string> = {};
        data.items.forEach((it) => {
          notesMap[it.id] = it.notes || '';
          inspectorsMap[it.id] = it.inspected_by || workOrder.technician?.name || '';
        });
        setItemNotes(notesMap);
        setItemInspectors(inspectorsMap);
        if (data.summary_notes) {
          setFinalSummaryNotes(data.summary_notes);
        }
        if (data.completed_by) {
          setFinalInspectorName(data.completed_by);
        }
      } else {
        // Fetch available templates for initialization
        const tmpls = await api.getChecklistTemplates({
          asset_category: workOrder.asset?.category,
        });
        setTemplates(tmpls);
        if (tmpls.length > 0) {
          setSelectedTemplateId(tmpls[0].id);
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('404')) {
        // 404 means checklist not yet initialized
        setChecklist(null);
        try {
          const tmpls = await api.getChecklistTemplates();
          setTemplates(tmpls);
          if (tmpls.length > 0) {
            setSelectedTemplateId(tmpls[0].id);
          }
        } catch {}
      } else {
        setError(err.message || 'Failed to load checklist.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, [workOrder.id]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const tmplId = typeof selectedTemplateId === 'number' ? selectedTemplateId : undefined;
      const created = await api.initializeWorkOrderChecklist(workOrder.id, {
        template_id: tmplId,
      });
      setChecklist(created);
      await loadChecklist();
      onChecklistUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize inspection checklist.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleUpdateStatus = async (item: WorkOrderChecklistItem, newStatus: ChecklistItemStatus) => {
    if (checklist?.completed_at) return; // Locked once finalized
    setUpdatingItemId(item.id);
    setError(null);
    try {
      const inspector = itemInspectors[item.id] || workOrder.technician?.name || 'Technician';
      const notes = itemNotes[item.id] ?? item.notes ?? undefined;

      await api.updateChecklistItem(workOrder.id, item.id, {
        status: newStatus,
        notes: notes || undefined,
        inspected_by: inspector,
      });

      // Reload fresh state
      const refreshed = await api.getWorkOrderChecklist(workOrder.id);
      setChecklist(refreshed);
      onChecklistUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update checklist item status.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleSaveNotes = async (item: WorkOrderChecklistItem) => {
    if (checklist?.completed_at) return;
    setUpdatingItemId(item.id);
    try {
      const inspector = itemInspectors[item.id] || workOrder.technician?.name || 'Technician';
      await api.updateChecklistItem(workOrder.id, item.id, {
        notes: itemNotes[item.id] || '',
        inspected_by: inspector,
      });
      const refreshed = await api.getWorkOrderChecklist(workOrder.id);
      setChecklist(refreshed);
      onChecklistUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save notes.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleFileUpload = async (itemId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side file size check (5 MB cap)
    if (file.size > 5 * 1024 * 1024) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 5 MB limit.`);
      event.target.value = '';
      return;
    }

    setUploadingItemId(itemId);
    setError(null);
    try {
      await api.uploadChecklistAttachment(workOrder.id, itemId, file);
      const refreshed = await api.getWorkOrderChecklist(workOrder.id);
      setChecklist(refreshed);
      onChecklistUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachment.');
    } finally {
      setUploadingItemId(null);
      if (event.target) event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (itemId: number) => {
    if (checklist?.completed_at) return;
    if (!window.confirm('Are you sure you want to remove this evidence file?')) return;

    setUploadingItemId(itemId);
    try {
      await api.deleteChecklistAttachment(workOrder.id, itemId);
      const refreshed = await api.getWorkOrderChecklist(workOrder.id);
      setChecklist(refreshed);
      onChecklistUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete attachment.');
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleCompleteChecklist = async () => {
    setFinalizeError(null);
    setIsFinalizing(true);
    try {
      const completed = await api.completeWorkOrderChecklist(workOrder.id, {
        summary_notes: finalSummaryNotes.trim() || undefined,
        completed_by: finalInspectorName.trim() || undefined,
      });
      setChecklist(completed);
      onChecklistUpdated?.();
    } catch (err: any) {
      setFinalizeError(err.message || 'Failed to finalize inspection checklist.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#172338] p-6 rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-xs space-y-4 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
        <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
      </div>
    );
  }

  // Not initialized yet card
  if (!checklist) {
    return (
      <div className="bg-white dark:bg-[#172338] p-6 rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#334155]">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Digital Inspection Checklist
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-[#131F32] px-2 py-0.5 rounded border border-transparent dark:border-[#334155]">
            Not Initialized
          </span>
        </div>

        <div className="p-4 bg-teal-50/50 dark:bg-[#131F32] border border-teal-100 dark:border-[#334155] rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-950/60 rounded text-teal-700 dark:text-teal-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">
                Quality Inspection & Standard Verification
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Attach a standardized digital checklist for{' '}
                <strong className="text-slate-800 dark:text-white">{workOrder.asset?.name || 'this asset'}</strong>.
                Technicians can verify safety tolerances, log observations, and attach photographic
                evidence directly from the field.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
                Select Inspection Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : '')}
                className="w-full py-1.5 px-2.5 text-xs bg-white dark:bg-[#111B2E] text-slate-900 dark:text-white border border-slate-300 dark:border-[#334155] rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.title} ({tmpl.asset_category || 'General'} • {tmpl.items?.length || 0} checks)
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:self-end">
              <button
                onClick={handleInitialize}
                disabled={isInitializing}
                className="w-full sm:w-auto px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Initializing...</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Initialize Checklist</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-[#4C1826]/70 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  const isFinalized = Boolean(checklist.completed_at);

  return (
    <div className="bg-white dark:bg-[#172338] p-6 rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#334155]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {checklist.title}
            </h3>
            {isFinalized ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-[#123C32] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Finalized & Certified
              </span>
            ) : checklist.has_failed_items ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                Failures Detected
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                In Progress ({checklist.completion_percentage}%)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Digital verification protocol snapshot with strict audit immutability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E3048] text-slate-700 dark:text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Prominent Failure Callout if any items are FAIL */}
      {checklist.has_failed_items && (
        <div className="p-3.5 bg-rose-50/90 dark:bg-[#4C1826]/70 border border-rose-300 dark:border-rose-900/60 rounded-lg flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">
              Critical Inspection Failure ({checklist.failed_items} item{checklist.failed_items > 1 ? 's' : ''} failed)
            </span>
            <p className="text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed">
              One or more inspection requirements failed standard criteria. Review technician notes
              and evidence attachments before returning equipment to production.
            </p>
          </div>
        </div>
      )}

      {/* Progress & Stat Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span>Inspection Progress:</span>
            <strong className="text-slate-900 dark:text-white">{checklist.completion_percentage}%</strong>
            <span className="text-[11px] text-slate-400">
              ({checklist.passed_items + checklist.failed_items + checklist.na_items} of {checklist.total_items} inspected)
            </span>
          </div>

          {checklist.incomplete_required_count > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-[#452A16] px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
              {checklist.incomplete_required_count} required item(s) pending
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-[#131F32] rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-300 ${
              checklist.has_failed_items
                ? 'bg-rose-500'
                : checklist.completion_percentage === 100
                ? 'bg-emerald-500'
                : 'bg-teal-600'
            }`}
            style={{ width: `${checklist.completion_percentage}%` }}
          />
        </div>

        {/* Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center text-xs">
          <div className="p-1.5 rounded bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155]">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total</span>
            <span className="font-bold text-slate-800 dark:text-white">{checklist.total_items}</span>
          </div>
          <div className="p-1.5 rounded bg-emerald-50/60 dark:bg-[#123C32]/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Passed</span>
            <span className="font-bold">{checklist.passed_items}</span>
          </div>
          <div className="p-1.5 rounded bg-rose-50/60 dark:bg-[#4C1826]/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase block">Failed</span>
            <span className="font-bold">{checklist.failed_items}</span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-slate-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">N / A</span>
            <span className="font-bold">{checklist.na_items}</span>
          </div>
          <div className="p-1.5 rounded bg-amber-50/60 dark:bg-[#452A16]/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase block">Pending</span>
            <span className="font-bold">{checklist.pending_items}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-[#4C1826]/70 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Checklist Items List */}
      <div className="space-y-3 pt-1">
        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between">
          <span>Verification Checklist Items</span>
          <span className="text-[11px] font-normal text-slate-400">
            Click status to record response
          </span>
        </h4>

        <div className="space-y-2.5">
          {checklist.items.map((item) => {
            const isItemUpdating = updatingItemId === item.id;
            const isItemUploading = uploadingItemId === item.id;
            const isPass = item.status === 'PASS';
            const isFail = item.status === 'FAIL';
            const isNA = item.status === 'NOT_APPLICABLE';
            const isPending = item.status === 'PENDING';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  isFail
                    ? 'bg-rose-50/40 dark:bg-[#4C1826]/40 border-rose-200 dark:border-rose-900/60'
                    : isPass
                    ? 'bg-emerald-50/20 dark:bg-[#123C32]/30 border-emerald-200/80 dark:border-emerald-900/50'
                    : isNA
                    ? 'bg-slate-50/80 dark:bg-[#131F32] border-slate-200 dark:border-[#334155]'
                    : 'bg-white dark:bg-[#131F32] border-slate-200 dark:border-[#334155] shadow-2xs'
                }`}
              >
                {/* Item Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        #{item.order_index}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.item_text}</span>
                      {item.is_required ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                          Required
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium uppercase tracking-wider bg-slate-100 dark:bg-[#172338] text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-[#334155]">
                          Optional
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pl-5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center gap-1 sm:self-start shrink-0">
                    <button
                      type="button"
                      disabled={isFinalized || isItemUpdating}
                      onClick={() => handleUpdateStatus(item, 'PASS')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                        isPass
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-[#172338] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#334155] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>PASS</span>
                    </button>

                    <button
                      type="button"
                      disabled={isFinalized || isItemUpdating}
                      onClick={() => handleUpdateStatus(item, 'FAIL')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                        isFail
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white dark:bg-[#172338] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#334155] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-300 dark:hover:border-rose-700'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>FAIL</span>
                    </button>

                    <button
                      type="button"
                      disabled={isFinalized || isItemUpdating}
                      onClick={() => handleUpdateStatus(item, 'NOT_APPLICABLE')}
                      className={`px-2 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                        isNA
                          ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                          : 'bg-white dark:bg-[#172338] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#334155] hover:bg-slate-100 dark:hover:bg-[#1E3048] hover:text-slate-700 dark:hover:text-white'
                      }`}
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>N/A</span>
                    </button>
                  </div>
                </div>

                {/* Notes & Evidence Attachment Row */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-[#334155] grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  {/* Notes Field (md:col-span-8) */}
                  <div className="md:col-span-8 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Technician Observation & Measurement:</span>
                      {!isFinalized && itemNotes[item.id] !== (item.notes || '') && (
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(item)}
                          disabled={isItemUpdating}
                          className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold cursor-pointer"
                        >
                          Save Note
                        </button>
                      )}
                    </div>
                    {!isFinalized ? (
                      <input
                        type="text"
                        value={itemNotes[item.id] ?? ''}
                        onChange={(e) =>
                          setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onBlur={() => handleSaveNotes(item)}
                        placeholder="e.g. Measured 64.5 PSI, zero fluid leaks detected..."
                        className="w-full text-xs p-1.5 px-2 bg-white dark:bg-[#111B2E] text-slate-900 dark:text-white border border-slate-300 dark:border-[#334155] placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    ) : (
                      <p className="text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-[#111B2E] p-1.5 rounded border border-slate-200/60 dark:border-[#334155]">
                        {item.notes || 'No specific notes recorded.'}
                      </p>
                    )}
                  </div>

                  {/* Attachment & Evidence (md:col-span-4) */}
                  <div className="md:col-span-4 space-y-1">
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">Evidence Documentation:</span>

                    {item.has_attachment && item.attachment_filename ? (
                      <div className="flex items-center justify-between gap-1.5 p-1 px-2 rounded bg-white dark:bg-[#111B2E] border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 text-[11px]">
                        <a
                          href={api.getChecklistAttachmentUrl(workOrder.id, item.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline truncate"
                          title="Click to view attachment"
                        >
                          <Paperclip className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span className="truncate max-w-[130px] font-medium">
                            {item.attachment_filename}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            ({formatFileSize(item.attachment_file_size)})
                          </span>
                        </a>

                        {!isFinalized && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(item.id)}
                            disabled={isItemUploading}
                            className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded cursor-pointer"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : !isFinalized ? (
                      <div>
                        <input
                          type="file"
                          ref={(el) => {
                            fileInputRefs.current[item.id] = el;
                          }}
                          onChange={(e) => handleFileUpload(item.id, e)}
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          disabled={isItemUploading}
                          className="w-full py-1 px-2 bg-white dark:bg-[#111B2E] border border-dashed border-slate-300 dark:border-[#334155] hover:border-teal-400 dark:hover:border-teal-500 text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {isItemUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin text-teal-600 dark:text-teal-400" />
                          ) : (
                            <Upload className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          )}
                          <span>Attach Photo / Log</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No file attached</span>
                    )}
                  </div>
                </div>

                {/* Item Footer: Inspection Meta */}
                {item.inspected_at && (
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                    <span>
                      Inspected by{' '}
                      <strong className="text-slate-600 dark:text-slate-300">{item.inspected_by || 'Technician'}</strong>
                    </span>
                    <span>•</span>
                    <span>{new Date(item.inspected_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion & Final Sign-Off Card */}
      {!isFinalized ? (
        <div className="p-4 bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Final Inspection Sign-off & Certification
            </div>
            {!checklist.can_complete && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Answer all required items to sign off
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Lead Inspector / Technician
              </label>
              <input
                type="text"
                value={finalInspectorName}
                onChange={(e) => setFinalInspectorName(e.target.value)}
                placeholder="Technician name..."
                className="w-full text-xs p-1.5 px-2.5 bg-white dark:bg-[#111B2E] text-slate-900 dark:text-white border border-slate-300 dark:border-[#334155] placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Overall Inspection Summary Notes
              </label>
              <input
                type="text"
                value={finalSummaryNotes}
                onChange={(e) => setFinalSummaryNotes(e.target.value)}
                placeholder="Summary findings, compliance confirmation, recommendations..."
                className="w-full text-xs p-1.5 px-2.5 bg-white dark:bg-[#111B2E] text-slate-900 dark:text-white border border-slate-300 dark:border-[#334155] placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {finalizeError && (
            <div className="p-2.5 bg-rose-50 dark:bg-[#4C1826]/70 border border-rose-200 dark:border-rose-900/60 rounded text-rose-800 dark:text-rose-200 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{finalizeError}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleCompleteChecklist}
              disabled={!checklist.can_complete || isFinalizing}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFinalizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Finalizing Inspection...</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Finalize & Sign Off Inspection</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/70 dark:bg-[#123C32]/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">Inspection Certified & Recorded:</span>{' '}
              <span>
                Completed by <strong className="text-slate-900 dark:text-white">{checklist.completed_by || 'Inspector'}</strong> on{' '}
                {new Date(checklist.completed_at!).toLocaleString()}.
              </span>
              {checklist.summary_notes && (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic mt-0.5">
                  "{checklist.summary_notes}"
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1 bg-white dark:bg-[#172338] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 rounded text-xs font-semibold shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      )}

      {/* Printable Report Modal */}
      <PrintableInspectionSummary
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        checklist={checklist}
        workOrder={workOrder}
      />
    </div>
  );
};
