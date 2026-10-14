import React, { useState, useEffect, useCallback } from 'react';
import {
  WorkOrder,
  Asset,
  Technician,
  MaintenanceType,
  DashboardStats,
  WorkOrderStatus,
  WorkOrderQueryParams
} from '../api/types';
import { api } from '../api/client';
import { StatCards } from '../components/dashboard/StatCards';
import { WorkOrderFilters } from '../components/work-orders/WorkOrderFilters';
import { WorkOrderTable } from '../components/work-orders/WorkOrderTable';
import { WorkOrderKanbanBoard } from '../components/work-orders/WorkOrderKanbanBoard';
import { FilterPresets, FilterPreset } from '../components/work-orders/FilterPresets';
import { BulkActionBar } from '../components/work-orders/BulkActionBar';
import { BulkAssignModal } from '../components/work-orders/BulkAssignModal';
import { DuplicateWorkOrderModal } from '../components/work-orders/DuplicateWorkOrderModal';
import { WorkOrderDetailDrawer } from '../components/work-orders/WorkOrderDetailDrawer';
import { TransitionModal } from '../components/work-orders/TransitionModal';
import { MaintenanceAnalyticsView } from '../components/analytics/MaintenanceAnalyticsView';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  Kanban as KanbanIcon,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';

interface WorkOrdersPageProps {
  assets: Asset[];
  technicians: Technician[];
  stats: DashboardStats | null;
  onSelectWorkOrder: (id: number) => void;
  onOpenCreateWO: () => void;
  onRefreshStats: () => void;
}

export const WorkOrdersPage: React.FC<WorkOrdersPageProps> = ({
  assets,
  technicians,
  stats,
  onSelectWorkOrder,
  onOpenCreateWO,
  onRefreshStats,
}) => {
  // View Mode: 'table' | 'kanban'
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>(() => {
    return (localStorage.getItem('maintainiq_wo_view_mode') as 'table' | 'kanban') || 'table';
  });

  const handleSetViewMode = (mode: 'table' | 'kanban') => {
    setViewMode(mode);
    try {
      localStorage.setItem('maintainiq_wo_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Data & Pagination State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);

  // Server-side Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string>('scheduled_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState('');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>('preset-all');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals & Drawer State
  const [drawerWorkOrder, setDrawerWorkOrder] = useState<WorkOrder | null>(null);
  const [duplicateTargetWO, setDuplicateTargetWO] = useState<WorkOrder | null>(null);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [transitionTargetWO, setTransitionTargetWO] = useState<WorkOrder | null>(null);
  const [initialTransitionStatus, setInitialTransitionStatus] = useState<WorkOrderStatus | undefined>(undefined);

  // User notifications banner
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  }, []);

  // Fetch Maintenance Types on mount
  useEffect(() => {
    api.getMaintenanceTypes()
      .then(setMaintenanceTypes)
      .catch(() => {
        // fallback
      });
  }, []);

  // Fetch Work Orders
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In Kanban view, fetch up to 100 items so all columns have visibility
      const effectivePageSize = viewMode === 'kanban' ? 100 : pageSize;
      const effectivePage = viewMode === 'kanban' ? 1 : currentPage;

      const paged = await api.getWorkOrdersPaged({
        q: searchQuery.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        asset_id: assetFilter ? parseInt(assetFilter, 10) : undefined,
        technician_id: technicianFilter ? parseInt(technicianFilter, 10) : undefined,
        maintenance_type_id: maintenanceTypeFilter ? parseInt(maintenanceTypeFilter, 10) : undefined,
        scheduled_start_date: startDate ? new Date(startDate).toISOString() : undefined,
        scheduled_end_date: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
        is_overdue: isOverdueOnly ? true : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: effectivePage,
        page_size: effectivePageSize,
      });

      setWorkOrders(paged.items);
      setTotalCount(paged.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch work orders.');
    } finally {
      setIsLoading(false);
    }
  }, [
    viewMode,
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    searchQuery,
    statusFilter,
    priorityFilter,
    assetFilter,
    technicianFilter,
    maintenanceTypeFilter,
    isOverdueOnly,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Handle Sort Change
  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssetFilter('');
    setTechnicianFilter('');
    setMaintenanceTypeFilter('');
    setIsOverdueOnly(false);
    setStartDate('');
    setEndDate('');
    setActivePresetId('preset-all');
    setCurrentPage(1);
  };

  // Apply Filter Preset
  const handleApplyPreset = (preset: FilterPreset) => {
    setActivePresetId(preset.id);
    const f = preset.filters;
    setStatusFilter(f.status ?? '');
    setPriorityFilter(f.priority ?? '');
    setAssetFilter(f.asset_id ? String(f.asset_id) : '');
    setTechnicianFilter(f.technician_id ? String(f.technician_id) : '');
    setMaintenanceTypeFilter(f.maintenance_type_id ? String(f.maintenance_type_id) : '');
    setIsOverdueOnly(Boolean(f.is_overdue));
    setSearchQuery(f.q ?? '');
    setCurrentPage(1);
  };

  // Multi-Selection handlers
  const handleToggleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const pageIds = workOrders.map((w) => w.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleExportSelected = () => {
    if (selectedIds.length === 0) return;
    // Export CSV filtered to these specific IDs
    const csvRows = [
      ['Work Order Number', 'Title', 'Priority', 'Status', 'Asset Tag', 'Asset Name', 'Technician', 'Scheduled Date', 'Estimated Hours'].join(','),
      ...workOrders
        .filter((w) => selectedIds.includes(w.id))
        .map((w) =>
          [
            `"${w.work_order_number}"`,
            `"${w.title.replace(/"/g, '""')}"`,
            `"${w.priority}"`,
            `"${w.status}"`,
            `"${w.asset?.asset_tag || ''}"`,
            `"${w.asset?.name?.replace(/"/g, '""') || ''}"`,
            `"${w.technician?.name || 'Unassigned'}"`,
            `"${w.scheduled_date}"`,
            `"${w.estimated_hours}"`,
          ].join(',')
        ),
    ];
    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maintainiq_selected_work_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${selectedIds.length} work orders to CSV.`, 'success');
  };

  // Status Transition Handler for Kanban / Table / Drawer
  const handleRequestTransition = (wo: WorkOrder, targetStatus: WorkOrderStatus) => {
    setTransitionTargetWO(wo);
    setInitialTransitionStatus(targetStatus);
  };

  const executeStatusTransition = async (data: {
    to_status: WorkOrderStatus;
    notes?: string;
    changed_by?: string;
    actual_hours?: number;
    resolution_summary?: string;
    cancellation_reason?: string;
  }) => {
    if (!transitionTargetWO) return;
    try {
      await api.transitionWorkOrder(transitionTargetWO.id, data);
      showToast(
        `Work Order ${transitionTargetWO.work_order_number} moved to ${data.to_status}.`,
        'success'
      );
      setTransitionTargetWO(null);
      setInitialTransitionStatus(undefined);
      fetchWorkOrders();
      onRefreshStats();
      if (drawerWorkOrder && drawerWorkOrder.id === transitionTargetWO.id) {
        // Refresh drawer
        api.getWorkOrder(transitionTargetWO.id).then(setDrawerWorkOrder);
      }
    } catch (err: any) {
      showToast(err.message || 'Status transition failed.', 'error');
      throw err;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      {/* Toast Alert Banner */}
      {toastNotification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs shadow-md animate-in fade-in slide-in-from-top-2 ${
            toastNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : toastNotification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : toastNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-teal-50 border-teal-200 text-teal-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastNotification.type === 'error' || toastNotification.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-current" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0 text-current" />
            )}
            <span className="font-medium">{toastNotification.message}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Operational Summary Cards */}
      <StatCards
        stats={stats}
        onFilterStatus={(s) => {
          setStatusFilter(s);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        onFilterPriority={(p) => {
          setPriorityFilter(p);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
      />

      {/* Operational Analytics & Charts Section Toggle */}
      <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xs overflow-hidden">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-[#1E3048] transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-white">Operational Analytics & Trends</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              · Status lifecycle, completion trend velocity, staff workload
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-medium">
            <span>{showAnalytics ? 'Hide Analytics Charts' : 'View Analytics Charts'}</span>
            {showAnalytics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAnalytics && (
          <div className="p-4 border-t border-slate-100 dark:border-[#334155] bg-slate-50/40 dark:bg-[#131F32]">
            <MaintenanceAnalyticsView onSelectWorkOrder={onSelectWorkOrder} />
          </div>
        )}
      </div>

      {/* Command Center Action Bar: Presets & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <FilterPresets
          currentFilters={{
            status: statusFilter,
            priority: priorityFilter,
            asset_id: assetFilter ? parseInt(assetFilter, 10) : undefined,
            technician_id: technicianFilter ? parseInt(technicianFilter, 10) : undefined,
            maintenance_type_id: maintenanceTypeFilter ? parseInt(maintenanceTypeFilter, 10) : undefined,
            is_overdue: isOverdueOnly ? true : undefined,
            q: searchQuery,
          }}
          onApplyPreset={handleApplyPreset}
          activePresetId={activePresetId}
        />

        {/* View Toggle & New Order Action */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#131F32] rounded-lg border border-slate-200 dark:border-[#334155]">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#172338] text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#172338] text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Kanban Board View"
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchWorkOrders}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenCreateWO}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Advanced Multi-Filters Component */}
      <WorkOrderFilters
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        statusFilter={statusFilter}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        priorityFilter={priorityFilter}
        onPriorityChange={(p) => {
          setPriorityFilter(p);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        assetFilter={assetFilter}
        onAssetChange={(a) => {
          setAssetFilter(a);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        technicianFilter={technicianFilter}
        onTechnicianChange={(t) => {
          setTechnicianFilter(t);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        maintenanceTypeFilter={maintenanceTypeFilter}
        onMaintenanceTypeChange={(mt) => {
          setMaintenanceTypeFilter(mt);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        isOverdueOnly={isOverdueOnly}
        onIsOverdueChange={(overdue) => {
          setIsOverdueOnly(overdue);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        startDate={startDate}
        onStartDateChange={(d) => {
          setStartDate(d);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        endDate={endDate}
        onEndDateChange={(d) => {
          setEndDate(d);
          setActivePresetId(null);
          setCurrentPage(1);
        }}
        exportUrl={api.getWorkOrdersExportUrl({
          q: searchQuery.trim() || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          asset_id: assetFilter ? parseInt(assetFilter, 10) : undefined,
          technician_id: technicianFilter ? parseInt(technicianFilter, 10) : undefined,
          maintenance_type_id: maintenanceTypeFilter ? parseInt(maintenanceTypeFilter, 10) : undefined,
          scheduled_start_date: startDate ? new Date(startDate).toISOString() : undefined,
          scheduled_end_date: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
          is_overdue: isOverdueOnly ? true : undefined,
        })}
        assets={assets}
        technicians={technicians}
        maintenanceTypes={maintenanceTypes}
        onResetFilters={handleResetFilters}
      />

      {/* Main Content: Table or Kanban */}
      {viewMode === 'table' ? (
        <WorkOrderTable
          workOrders={workOrders}
          isLoading={isLoading}
          error={error}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          onSortChange={handleSortChange}
          selectedIds={selectedIds}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectRow={handleToggleSelectRow}
          onSelectWorkOrder={onSelectWorkOrder}
          onOpenDrawer={setDrawerWorkOrder}
          onOpenDuplicate={setDuplicateTargetWO}
          onOpenCreateWO={onOpenCreateWO}
          onResetFilters={handleResetFilters}
        />
      ) : (
        <WorkOrderKanbanBoard
          workOrders={workOrders}
          isLoading={isLoading}
          onSelectWorkOrder={onSelectWorkOrder}
          onOpenDrawer={setDrawerWorkOrder}
          onOpenDuplicate={setDuplicateTargetWO}
          onRequestTransition={handleRequestTransition}
          onNotification={showToast}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={handleClearSelection}
        onOpenBulkAssign={() => setIsBulkAssignOpen(true)}
        onExportSelected={handleExportSelected}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        selectedIds={selectedIds}
        technicians={technicians}
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        onSuccess={() => {
          fetchWorkOrders();
          onRefreshStats();
          handleClearSelection();
        }}
      />

      {/* Work Order Duplication Modal */}
      {duplicateTargetWO && (
        <DuplicateWorkOrderModal
          workOrder={duplicateTargetWO}
          technicians={technicians}
          isOpen={Boolean(duplicateTargetWO)}
          onClose={() => setDuplicateTargetWO(null)}
          onSuccess={(newWo) => {
            showToast(`Duplicated into new order ${newWo.work_order_number} successfully!`, 'success');
            fetchWorkOrders();
            onRefreshStats();
          }}
        />
      )}

      {/* Quick-View Detail Slide-Over Drawer */}
      <WorkOrderDetailDrawer
        workOrder={drawerWorkOrder}
        isOpen={Boolean(drawerWorkOrder)}
        onClose={() => setDrawerWorkOrder(null)}
        onViewFullDetails={(id) => {
          setDrawerWorkOrder(null);
          onSelectWorkOrder(id);
        }}
        onOpenDuplicate={(wo) => {
          setDrawerWorkOrder(null);
          setDuplicateTargetWO(wo);
        }}
        onOpenTransition={(wo) => {
          setDrawerWorkOrder(null);
          setTransitionTargetWO(wo);
        }}
      />

      {/* Transition Modal (used for Kanban drops or drawer triggers) */}
      {transitionTargetWO && (
        <TransitionModal
          workOrder={transitionTargetWO}
          technicians={technicians}
          isOpen={Boolean(transitionTargetWO)}
          initialTargetStatus={initialTransitionStatus}
          onClose={() => {
            setTransitionTargetWO(null);
            setInitialTransitionStatus(undefined);
          }}
          onTransition={executeStatusTransition}
        />
      )}
    </div>
  );
};
