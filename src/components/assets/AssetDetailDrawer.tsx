import React, { useState, useEffect } from 'react';
import { Asset, WorkOrder } from '../../api/types';
import { api } from '../../api/client';
import { AssetStatusBadge, StatusBadge, PriorityBadge } from '../ui/StatusBadge';
import { formatDate, formatShortDate } from '../../lib/utils';
import {
  X,
  Cpu,
  MapPin,
  Calendar,
  Wrench,
  Clock,
  Edit2,
  FileText,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface AssetDetailDrawerProps {
  assetId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEditAsset: (asset: Asset) => void;
  onSelectWorkOrder: (woId: number) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  assetId,
  isOpen,
  onClose,
  onEditAsset,
  onSelectWorkOrder,
}) => {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId || !isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [assetData, allWos] = await Promise.all([
          api.getAsset(assetId),
          api.getWorkOrders({ asset_id: assetId }),
        ]);
        setAsset(assetData);
        setWorkOrders(allWos);
      } catch (err: any) {
        setError(err.message || 'Failed to load asset details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [assetId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Asset Details & Maintenance Record</h3>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                {asset?.asset_tag || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2" />
              <div className="h-24 bg-slate-100 rounded" />
              <div className="h-48 bg-slate-100 rounded" />
            </div>
          ) : error || !asset ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error || 'Asset not found'}</span>
            </div>
          ) : (
            <>
              {/* Asset Title & Quick Actions */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{asset.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <AssetStatusBadge status={asset.status} />
                    <span className="text-xs text-slate-500 font-mono">
                      Category: {asset.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onEditAsset(asset)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Asset
                </button>
              </div>

              {/* Technical Specifications */}
              <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2 text-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Technical Specifications
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400">Location:</span> {asset.location}
                  </div>
                  <div>
                    <span className="text-slate-400">Criticality:</span> {asset.criticality}
                  </div>
                  <div>
                    <span className="text-slate-400">Manufacturer:</span> {asset.manufacturer || '—'}
                  </div>
                  <div>
                    <span className="text-slate-400">Model:</span> {asset.model_number || '—'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Serial Number:</span>{' '}
                    <span className="font-mono">{asset.serial_number || '—'}</span>
                  </div>
                </div>

                {asset.notes && (
                  <div className="pt-2 border-t border-slate-200/60 mt-2 text-slate-600">
                    <span className="text-slate-400 font-medium">Notes:</span> {asset.notes}
                  </div>
                )}
              </div>

              {/* Maintenance History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-teal-600" />
                    <span>Asset Maintenance History</span>
                  </h4>
                  <span className="text-xs font-medium text-slate-500 font-mono">
                    {workOrders.length} records
                  </span>
                </div>

                {workOrders.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-400 italic">
                    No work orders recorded for this asset yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {workOrders.map((wo) => (
                      <div
                        key={wo.id}
                        onClick={() => {
                          onClose();
                          onSelectWorkOrder(wo.id);
                        }}
                        className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors cursor-pointer group space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-xs text-teal-700 group-hover:underline">
                            {wo.work_order_number}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <PriorityBadge priority={wo.priority} />
                            <StatusBadge status={wo.status} showIcon={false} />
                          </div>
                        </div>

                        <div className="text-xs font-medium text-slate-900 group-hover:text-teal-700 transition-colors">
                          {wo.title}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatShortDate(wo.scheduled_date)}</span>
                          </div>
                          <div>
                            {wo.technician ? (
                              <span>Tech: {wo.technician.name}</span>
                            ) : (
                              <span className="italic">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
