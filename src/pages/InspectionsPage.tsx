import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Filter, 
  CheckSquare, 
  AlertCircle, 
  Layers, 
  Eye, 
  X, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { ChecklistTemplate, MaintenanceType, WorkOrder } from '../api/types';
import { api } from '../api/client';
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';

interface InspectionsPageProps {
  maintenanceTypes: MaintenanceType[];
  onSelectWorkOrder: (id: number) => void;
  onOpenCreateWO: () => void;
}

export const InspectionsPage: React.FC<InspectionsPageProps> = ({
  maintenanceTypes,
  onSelectWorkOrder,
  onOpenCreateWO,
}) => {
  const { success, error } = useToast();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Selected Template for preview modal
  const [previewTemplate, setPreviewTemplate] = useState<ChecklistTemplate | null>(null);

  // Create Template Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTypeId, setNewTypeId] = useState<string>('');
  const [newItems, setNewItems] = useState<Array<{ item_text: string; description: string; is_required: boolean }>>([
    { item_text: '', description: '', is_required: true },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active work orders with checklists
  const [activeOrders, setActiveOrders] = useState<WorkOrder[]>([]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await api.getChecklistTemplates({
        asset_category: categoryFilter || undefined,
        maintenance_type_id: typeFilter ? Number(typeFilter) : undefined,
      });
      setTemplates(data);

      // Also fetch open work orders to show actionable inspection orders
      const orders = await api.getWorkOrders({ status: 'IN_PROGRESS' });
      setActiveOrders(orders.slice(0, 5));
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load checklist templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [categoryFilter, typeFilter]);

  // Filter templates locally by search query
  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.asset_category && t.asset_category.toLowerCase().includes(q))
    );
  });

  const categories = Array.from(
    new Set(templates.map((t) => t.asset_category).filter(Boolean))
  ) as string[];

  const handleAddItemRow = () => {
    setNewItems([...newItems, { item_text: '', description: '', is_required: true }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      error('Template title is required');
      return;
    }
    const validItems = newItems.filter((item) => item.item_text.trim());
    if (validItems.length === 0) {
      error('Please add at least one valid inspection item');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createChecklistTemplate({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        asset_category: newCategory.trim() || undefined,
        maintenance_type_id: newTypeId ? Number(newTypeId) : undefined,
        items: validItems.map((item, idx) => ({
          order_index: idx + 1,
          item_text: item.item_text.trim(),
          description: item.description.trim() || undefined,
          is_required: item.is_required,
        })),
      });

      success('Inspection checklist template created successfully.');
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewCategory('');
      setNewTypeId('');
      setNewItems([{ item_text: '', description: '', is_required: true }]);
      loadTemplates();
    } catch (err: any) {
      error(err.message || 'Failed to create checklist template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Digital Inspection Checklists
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Standardized quality verification templates, field audit protocols, and compliance enforcement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Checklist Template
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{templates.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Active Standard Templates</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{categories.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Asset Categories Covered</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">100% PASS/FAIL</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Objective Execution Protocol</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title, category..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-700 dark:text-white focus:outline-none focus:border-teal-500"
        >
          <option value="">All Asset Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-700 dark:text-white focus:outline-none focus:border-teal-500"
        >
          <option value="">All Maintenance Types</option>
          {maintenanceTypes.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>

        {(searchQuery || categoryFilter || typeFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('');
              setTypeFilter('');
            }}
            className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Templates List */}
      {fetchError && (
        <ErrorState message={fetchError} onRetry={loadTemplates} />
      )}

      {isLoading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No inspection templates found"
          description="Create standard inspection checklists to attach to work orders during execution."
          actionLabel="Create Template"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const requiredCount = template.items?.filter((i) => i.is_required).length || 0;
            const totalCount = template.items?.length || 0;

            return (
              <div
                key={template.id}
                className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-teal-500/50 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 font-bold">
                      {template.asset_category || 'GENERAL'}
                    </span>
                    {template.maintenance_type_id && (
                      <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-300 border border-transparent dark:border-[#334155]">
                        {maintenanceTypes.find((t) => t.id === template.maintenance_type_id)?.name || `Type #${template.maintenance_type_id}`}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mt-2.5">
                    {template.title}
                  </h3>
                  {template.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-xs">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-white">{totalCount}</span> items (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{requiredCount} required</span>)
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(template)}
                    className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Work Orders with Live Inspections */}
      {activeOrders.length > 0 && (
        <div className="bg-slate-900 dark:bg-[#111B2E] rounded p-5 text-slate-300 border border-slate-800 dark:border-[#334155] mt-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 dark:border-[#334155]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Work Orders in Progress (Inspection Verification Ready)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Open a work order to execute its digital checklist
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {activeOrders.map((wo) => (
              <div
                key={wo.id}
                onClick={() => onSelectWorkOrder(wo.id)}
                className="p-3 bg-slate-800/80 dark:bg-[#172338] rounded border border-slate-700/80 dark:border-[#334155] hover:border-teal-500/50 hover:bg-slate-800 dark:hover:bg-[#1E3048] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-xs font-mono font-bold text-teal-300">
                  <span>{wo.work_order_number}</span>
                  <span className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/50">
                    IN_PROGRESS
                  </span>
                </div>
                <div className="text-xs text-white font-medium truncate mt-1">{wo.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Asset #{wo.asset_id}</span>
                  <span className="text-teal-400 flex items-center gap-0.5 font-sans font-medium text-[10px]">
                    Open Checklist <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setPreviewTemplate(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-[#172338] rounded-lg shadow-2xl border border-slate-200 dark:border-[#334155] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50 dark:bg-[#111B2E]">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                  {previewTemplate.asset_category || 'GENERAL'}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mt-1">
                  {previewTemplate.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {previewTemplate.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-[#111B2E] p-2.5 rounded border border-slate-100 dark:border-[#334155]">
                  {previewTemplate.description}
                </p>
              )}

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                  Standard Inspection Checklist Items ({previewTemplate.items?.length || 0})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-[#334155] border border-slate-200 dark:border-[#334155] rounded">
                  {previewTemplate.items?.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 text-xs flex items-start gap-2.5">
                      <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">#{item.order_index}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                          {item.item_text}
                          {item.is_required && (
                            <span className="text-[9px] bg-rose-50 dark:bg-[#4C1826] text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900/60 font-bold uppercase">
                              Required
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#111B2E] border-t border-slate-200 dark:border-[#334155] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#131F32] dark:border dark:border-[#334155] dark:hover:bg-[#1E3048] text-slate-800 dark:text-white text-xs font-semibold rounded cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setIsCreateOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-[#172338] rounded-lg shadow-2xl border border-slate-200 dark:border-[#334155] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateTemplate}>
              <div className="p-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50 dark:bg-[#111B2E]">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Author New Digital Inspection Template
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Template Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Centrifugal Pump Pre-Start Quality Inspection"
                    className="w-full p-2 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Asset Category Target
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. PUMPS, HVAC, MOTORS"
                      className="w-full p-2 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Maintenance Type Association
                    </label>
                    <select
                      value={newTypeId}
                      onChange={(e) => setNewTypeId(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-700 dark:text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="">Any Maintenance Type</option>
                      {maintenanceTypes.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description & Safety Standard Reference
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Operational guidance, PPE requirements, or regulatory standard code."
                    className="w-full p-2 bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Checklist Items & Criteria <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item Row
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-[#131F32] rounded border border-slate-200 dark:border-[#334155] flex items-start gap-2">
                        <span className="font-mono text-slate-400 dark:text-slate-500 mt-2 text-xs">#{idx + 1}</span>
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            required
                            value={item.item_text}
                            onChange={(e) => {
                              const updated = [...newItems];
                              updated[idx].item_text = e.target.value;
                              setNewItems(updated);
                            }}
                            placeholder="Inspection requirement (e.g. Verify mechanical seal for leakage)"
                            className="w-full p-1.5 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...newItems];
                              updated[idx].description = e.target.value;
                              setNewItems(updated);
                            }}
                            placeholder="Optional acceptance criteria / tolerance threshold"
                            className="w-full p-1.5 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded text-[11px] focus:outline-none focus:border-teal-500 text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={item.is_required}
                              onChange={(e) => {
                                const updated = [...newItems];
                                updated[idx].is_required = e.target.checked;
                                setNewItems(updated);
                              }}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            Mandatory item (Must be evaluated PASS / NOT_APPLICABLE to complete work order)
                          </label>
                        </div>
                        {newItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#111B2E] border-t border-slate-200 dark:border-[#334155] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-[#1E3048] text-xs font-semibold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
