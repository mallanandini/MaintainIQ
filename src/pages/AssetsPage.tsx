import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, AssetStatus, AssetHealthOverviewResponse, AssetHealthDetail } from '../api/types';
import { api } from '../api/client';
import { AssetStatusBadge } from '../components/ui/StatusBadge';
import { AssetModal } from '../components/assets/AssetModal';
import { AssetDetailDrawer } from '../components/assets/AssetDetailDrawer';
import { AssetHealthOverview } from '../components/assets/AssetHealthOverview';
import { RiskBadge } from '../components/assets/RiskBadge';
import { 
  PlusCircle, 
  Search, 
  Cpu, 
  MapPin, 
  ExternalLink, 
  Edit2, 
  Filter,
  Layers,
  AlertTriangle,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface AssetsPageProps {
  assets: Asset[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectWorkOrder: (woId: number) => void;
}

export const AssetsPage: React.FC<AssetsPageProps> = ({
  assets,
  isLoading,
  onRefresh,
  onSelectWorkOrder,
}) => {
  const { success } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Health Data State
  const [healthData, setHealthData] = useState<AssetHealthOverviewResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  
  // Drawer & Modal States
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modalAsset, setModalAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchHealth = useCallback(async () => {
    setIsHealthLoading(true);
    try {
      const res = await api.getFleetAssetHealth();
      setHealthData(res);
    } catch (err) {
      console.error('Failed to load asset health overview:', err);
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const healthMap = useMemo(() => {
    const map = new Map<number, AssetHealthDetail>();
    if (healthData?.items) {
      for (const h of healthData.items) {
        map.set(h.asset_id, h);
      }
    }
    return map;
  }, [healthData]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    assets.forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats).sort();
  }, [assets]);

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || a.status === statusFilter;
    const matchesCategory = !categoryFilter || a.category === categoryFilter;

    const health = healthMap.get(a.id);
    const matchesRisk =
      !riskFilter ||
      (riskFilter === 'INSUFFICIENT_DATA'
        ? health?.risk_level === 'INSUFFICIENT_DATA' || !health
        : health?.risk_level === riskFilter);

    const matchesAttention = !showAttentionOnly || Boolean(health?.needs_maintenance_attention);

    return matchesSearch && matchesStatus && matchesCategory && matchesRisk && matchesAttention;
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, riskFilter, showAttentionOnly, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredAssets.length);
  const displayedAssets = filteredAssets.slice(startIndex, endIndex);

  const handleOpenCreate = () => {
    setModalAsset(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setModalAsset(asset);
    setIsModalOpen(true);
  };

  const handleViewDetails = (assetId: number) => {
    setSelectedAssetId(assetId);
    setIsDrawerOpen(true);
  };

  const handleRefreshAll = () => {
    onRefresh();
    fetchHealth();
  };

  const handleSaveAsset = async (payload: any) => {
    if (modalAsset) {
      await api.updateAsset(modalAsset.id, payload);
      success(`Updated asset ${payload.asset_tag || modalAsset.asset_tag} successfully.`, 'Asset Updated');
    } else {
      await api.createAsset(payload);
      success(`Registered asset ${payload.asset_tag} (${payload.name}) successfully.`, 'Asset Created');
    }
    handleRefreshAll();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setRiskFilter('');
    setShowAttentionOnly(false);
  };

  const hasActiveFilters = Boolean(
    search || statusFilter || categoryFilter || riskFilter || showAttentionOnly
  );

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Asset Registry & Machinery Profiles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage physical plant machinery, assess deterministic maintenance risk, and inspect service histories.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer w-fit"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Register Asset
        </button>
      </div>

      {/* Asset Health & Risk Monitoring Fleet Banner */}
      <AssetHealthOverview
        summary={healthData?.summary || null}
        selectedRiskFilter={riskFilter}
        onSelectRiskFilter={(risk) => setRiskFilter((prev) => (prev === risk ? '' : risk))}
        showAttentionOnly={showAttentionOnly}
        onToggleAttentionOnly={() => setShowAttentionOnly((prev) => !prev)}
        formulaDoc={healthData?.formula_documentation}
        isLoading={isHealthLoading}
      />

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-[#172338] p-3.5 rounded border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag, name, location..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-[#334155] dark:bg-[#131F32] dark:text-white rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white cursor-pointer font-medium"
          >
            <option value="">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MODERATE">Moderate Risk</option>
            <option value="LOW">Low Risk</option>
            <option value="INSUFFICIENT_DATA">Insufficient Data</option>
          </select>

          {/* Attention Only Toggle Button */}
          <button
            onClick={() => setShowAttentionOnly(!showAttentionOnly)}
            className={cn(
              'px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer flex items-center gap-1.5',
              showAttentionOnly
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-slate-50 dark:bg-[#131F32] text-slate-600 dark:text-slate-200 border-slate-300 dark:border-[#334155] hover:bg-slate-100 dark:hover:bg-[#1E3048]'
            )}
            title="Filter to assets with overdue maintenance or critical work orders"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Attention</span>
          </button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded border border-transparent transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Asset Grid / Table */}
      <div className="bg-white dark:bg-[#131F32] rounded border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Asset Tag</th>
                <th className="py-3 px-4 min-w-[200px]">Asset Name & Spec</th>
                <th className="py-3 px-3 w-28">Category</th>
                <th className="py-3 px-4 min-w-[140px]">Location</th>
                <th className="py-3 px-3 w-32">Status</th>
                <th className="py-3 px-3 w-36">Risk Level</th>
                <th className="py-3 px-3 w-24">Criticality</th>
                <th className="py-3 px-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-xs text-slate-700 dark:text-slate-200">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-white text-sm">No matching assets found</p>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                      Try adjusting your search criteria, category, status, or risk level filters.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded hover:bg-teal-100 dark:hover:bg-teal-900/60 transition cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayedAssets.map((asset) => {
                  const health = healthMap.get(asset.id);
                  const needsAttention = Boolean(health?.needs_maintenance_attention);

                  return (
                    <tr
                      key={asset.id}
                      className={cn(
                        "transition-colors group bg-white dark:bg-[#131F32] hover:bg-slate-50/70 dark:hover:bg-[#1E3048]",
                        needsAttention
                          ? "bg-rose-50/30 dark:bg-[#131F32] border-l-2 border-l-rose-500"
                          : "border-l-2 border-l-transparent"
                      )}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-teal-700 dark:text-teal-400">
                        <div className="flex items-center gap-1.5">
                          {needsAttention && (
                            <span
                              className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"
                              title="Needs Maintenance Attention: Overdue orders or critical work orders"
                            />
                          )}
                          <span>{asset.asset_tag}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                          {asset.name}
                        </div>
                        {asset.model_number && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {asset.manufacturer ? `${asset.manufacturer} · ` : ''}
                            Model: {asset.model_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-[#172338] border border-transparent dark:border-[#334155] px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-200">
                          {asset.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{asset.location}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <AssetStatusBadge status={asset.status} />
                      </td>
                      <td className="py-3.5 px-3">
                        {health ? (
                          <div className="flex items-center gap-1.5">
                            <RiskBadge
                              level={health.risk_level}
                              score={health.risk_score}
                              size="sm"
                              showScore={health.risk_level !== 'INSUFFICIENT_DATA'}
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Evaluating...</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[11px] text-slate-700 dark:text-slate-200">
                        {asset.criticality}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewDetails(asset.id)}
                            className="px-2 py-1 text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                            title="View Health & Maintenance Details"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleOpenEdit(asset)}
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded transition-colors cursor-pointer"
                            title="Edit Asset"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Assets Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-[#111B2E] border-t border-slate-200/80 dark:border-[#334155] text-[11px] text-slate-500 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              Showing <span className="font-medium text-slate-800 dark:text-white">{filteredAssets.length > 0 ? startIndex + 1 : 0}</span> to{' '}
              <span className="font-medium text-slate-800 dark:text-white">{endIndex}</span> of{' '}
              <span className="font-medium text-slate-800 dark:text-white">{filteredAssets.length}</span> assets
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-[#334155]">
              <span className="text-slate-400 dark:text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                aria-label="Assets per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Navigators */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="First Page"
              aria-label="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-white">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1 rounded border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#131F32] text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Last Page"
              aria-label="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Asset Detail & Maintenance History Drawer */}
      <AssetDetailDrawer
        assetId={selectedAssetId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEditAsset={(a) => {
          setIsDrawerOpen(false);
          handleOpenEdit(a);
        }}
        onSelectWorkOrder={onSelectWorkOrder}
      />

      {/* Asset Create / Edit Modal */}
      <AssetModal
        asset={modalAsset}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveAsset}
      />
    </div>
  );
};

