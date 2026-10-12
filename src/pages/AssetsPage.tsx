import React, { useState } from 'react';
import { Asset, AssetStatus } from '../api/types';
import { api } from '../api/client';
import { AssetStatusBadge } from '../components/ui/StatusBadge';
import { AssetModal } from '../components/assets/AssetModal';
import { AssetDetailDrawer } from '../components/assets/AssetDetailDrawer';
import { 
  PlusCircle, 
  Search, 
  Cpu, 
  MapPin, 
  ExternalLink, 
  Edit2, 
  Filter,
  Layers
} from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Drawer & Modal States
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modalAsset, setModalAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || a.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  const handleSaveAsset = async (payload: any) => {
    if (modalAsset) {
      await api.updateAsset(modalAsset.id, payload);
    } else {
      await api.createAsset(payload);
    }
    onRefresh();
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Asset Registry & Machinery Profiles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage plant physical machinery, track operational statuses, and view cumulative maintenance histories.
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

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag, name, location, category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 border border-slate-300 rounded bg-white text-slate-700 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
            <option value="DECOMMISSIONED">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Asset Grid / Table */}
      <div className="bg-white rounded border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Asset Tag</th>
                <th className="py-3 px-4 min-w-[200px]">Asset Name & Spec</th>
                <th className="py-3 px-3 w-32">Category</th>
                <th className="py-3 px-4 min-w-[160px]">Location</th>
                <th className="py-3 px-3 w-32">Status</th>
                <th className="py-3 px-3 w-24">Criticality</th>
                <th className="py-3 px-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-teal-700">
                    {asset.asset_tag}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {asset.name}
                    </div>
                    {asset.model_number && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {asset.manufacturer ? `${asset.manufacturer} · ` : ''}
                        Model: {asset.model_number}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {asset.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{asset.location}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <AssetStatusBadge status={asset.status} />
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-[11px] text-slate-700">
                    {asset.criticality}
                  </td>
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleViewDetails(asset.id)}
                        className="px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50 rounded border border-teal-200 transition-colors cursor-pointer"
                        title="View Maintenance History"
                      >
                        History
                      </button>
                      <button
                        onClick={() => handleOpenEdit(asset)}
                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title="Edit Asset"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
