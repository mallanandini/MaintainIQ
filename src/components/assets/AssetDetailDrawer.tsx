import React, { useState, useEffect } from 'react';
import { Asset, AssetMaintenanceRecord } from '../../api/types';
import { api } from '../../api/client';
import { AssetStatusBadge, StatusBadge, PriorityBadge } from '../ui/StatusBadge';
import { AssetHealthCard } from './AssetHealthCard';
import { formatDate, formatShortDate } from '../../lib/utils';
import {
  X,
  Cpu,
  Calendar,
  Wrench,
  Clock,
  Edit2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  User,
  List,
  GitCommit,
  RefreshCw,
  AlertTriangle,
  Info,
  ClipboardCheck,
  Download,
  Filter,
  RotateCcw
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
  const [historyRecords, setHistoryRecords] = useState<AssetMaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyPriorityFilter, setHistoryPriorityFilter] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const loadData = async () => {
    if (!assetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [assetData, historyData] = await Promise.all([
        api.getAsset(assetId),
        api.getAssetMaintenanceHistory(assetId, {
          status: historyStatusFilter || undefined,
          priority: historyPriorityFilter || undefined,
          start_date: historyStartDate ? new Date(historyStartDate).toISOString() : undefined,
          end_date: historyEndDate ? new Date(historyEndDate + 'T23:59:59.999Z').toISOString() : undefined,
        }),
      ]);
      setAsset(assetData);
      setHistoryRecords(historyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load asset details and maintenance history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!assetId || !isOpen) return;
    loadData();
  }, [assetId, isOpen, historyStatusFilter, historyPriorityFilter, historyStartDate, historyEndDate]);

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

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Asset Details & Maintenance History</h3>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                {asset?.asset_tag || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-slate-800"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2" />
              <div className="h-28 bg-slate-100 rounded" />
              <div className="h-60 bg-slate-100 rounded" />
            </div>
          ) : error || !asset ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">Failed to load data</span>
              </div>
              <p>{error || 'Asset not found.'}</p>
              <button
                onClick={loadData}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-medium rounded text-xs w-fit transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
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

              {/* Asset Health & Risk Assessment Breakdown */}
              <AssetHealthCard assetId={asset.id} />

              {/* Maintenance History Section */}
              <div className="space-y-3.5 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-teal-50 border border-teal-200 text-teal-700">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Asset Maintenance History
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {historyRecords.length} chronological maintenance record{historyRecords.length === 1 ? '' : 's'} (newest first)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Export History CSV */}
                    <a
                      href={api.getAssetMaintenanceHistoryExportUrl(asset.id, {
                        status: historyStatusFilter || undefined,
                        priority: historyPriorityFilter || undefined,
                        start_date: historyStartDate ? new Date(historyStartDate).toISOString() : undefined,
                        end_date: historyEndDate ? new Date(historyEndDate + 'T23:59:59.999Z').toISOString() : undefined,
                      })}
                      download={`asset_${asset.asset_tag}_maintenance_history.csv`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors cursor-pointer"
                      title="Export complete maintenance history to CSV"
                    >
                      <Download className="w-3 h-3 text-teal-600" />
                      <span>Export CSV</span>
                    </a>

                    {/* View Mode Toggle */}
                    {historyRecords.length > 0 && (
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                        <button
                          onClick={() => setViewMode('timeline')}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                            viewMode === 'timeline'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <GitCommit className="w-3.5 h-3.5 rotate-90" />
                          Timeline
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                            viewMode === 'table'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                          Table
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* History Filter Controls */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-1 text-slate-500 font-medium">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span>Filter:</span>
                  </div>

                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="py-1 px-2 text-xs border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>

                  <select
                    value={historyPriorityFilter}
                    onChange={(e) => setHistoryPriorityFilter(e.target.value)}
                    className="py-1 px-2 text-xs border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">All Priorities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">From</span>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="py-0.5 px-1.5 text-xs border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">To</span>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="py-0.5 px-1.5 text-xs border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  {(historyStatusFilter || historyPriorityFilter || historyStartDate || historyEndDate) && (
                    <button
                      onClick={() => {
                        setHistoryStatusFilter('');
                        setHistoryPriorityFilter('');
                        setHistoryStartDate('');
                        setHistoryEndDate('');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-200/60 hover:bg-slate-200 rounded transition-colors cursor-pointer ml-auto"
                      title="Reset history filters"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Empty State */}
                {historyRecords.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      No Maintenance Records Found
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      There are no historical or active work orders logged for this physical asset.
                    </p>
                  </div>
                ) : viewMode === 'timeline' ? (
                  /* Chronological Timeline View */
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {historyRecords.map((item) => {
                      const isCompleted = item.status === 'COMPLETED';
                      const isCancelled = item.status === 'CANCELLED';
                      const isEmergency = item.maintenance_type?.is_emergency;

                      return (
                        <div key={item.id} className="relative group">
                          {/* Timeline Node Bullet */}
                          <div
                            className={`absolute -left-6 top-3 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center transition-transform group-hover:scale-110 ${
                              isCompleted
                                ? 'border-teal-500 text-teal-600'
                                : isCancelled
                                ? 'border-slate-400 text-slate-400'
                                : item.priority === 'CRITICAL'
                                ? 'border-rose-500 text-rose-600'
                                : 'border-blue-500 text-blue-600'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCompleted
                                  ? 'bg-teal-500'
                                  : isCancelled
                                  ? 'bg-slate-400'
                                  : item.priority === 'CRITICAL'
                                  ? 'bg-rose-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                          </div>

                          {/* Record Card */}
                          <div
                            onClick={() => {
                              onClose();
                              onSelectWorkOrder(item.id);
                            }}
                            className="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-teal-300 rounded-lg shadow-xs transition-all cursor-pointer space-y-2.5"
                          >
                            {/* Card Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-teal-700 group-hover:underline flex items-center gap-1">
                                  {item.work_order_number}
                                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-teal-600" />
                                </span>
                                {item.maintenance_type && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                      isEmergency
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {item.maintenance_type.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.has_checklist && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      item.checklist_status === 'FAILED_ITEMS'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : item.checklist_status === 'COMPLETED'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                    title={item.checklist_summary || undefined}
                                  >
                                    <ClipboardCheck className="w-3 h-3" />
                                    <span>
                                      {item.checklist_status === 'FAILED_ITEMS'
                                        ? 'Checklist Failed'
                                        : item.checklist_status === 'COMPLETED'
                                        ? 'Checklist Passed'
                                        : 'Checklist In Progress'}
                                    </span>
                                  </span>
                                )}
                                <PriorityBadge priority={item.priority} />
                                <StatusBadge status={item.status} showIcon={false} />
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div>
                              <div className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                                {item.title}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                            </div>

                            {/* Key Lifecycle Timestamps & Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>
                                  Created: <strong className="text-slate-700 font-medium">{formatShortDate(item.created_date)}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>
                                  Scheduled: <strong className="text-slate-700 font-medium">{formatShortDate(item.scheduled_date)}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>
                                  Tech: <strong className="text-slate-700 font-medium">{item.technician ? item.technician.name : 'Unassigned'}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Completed Status Date Banner */}
                            {isCompleted && item.completed_date && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded text-[11px] text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  Completed on <strong>{formatDate(item.completed_date)}</strong>
                                  {item.actual_hours && ` (${item.actual_hours}h actual labor)`}
                                </span>
                              </div>
                            )}

                            {/* Resolution Summary Snippet */}
                            {item.resolution_summary && (
                              <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
                                <span className="font-semibold text-slate-900">Resolution:</span> {item.resolution_summary}
                              </div>
                            )}

                            {/* Cancellation Snippet */}
                            {isCancelled && item.cancellation_reason && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800">
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>
                                  Cancelled: <strong>{item.cancellation_reason}</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Compact Table View */
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="py-2 px-3">WO #</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Title & Priority</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Technician</th>
                          <th className="py-2 px-3">Scheduled</th>
                          <th className="py-2 px-3">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyRecords.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => {
                              onClose();
                              onSelectWorkOrder(item.id);
                            }}
                            className="hover:bg-teal-50/50 cursor-pointer transition-colors group"
                          >
                            <td className="py-2.5 px-3 font-mono font-semibold text-teal-700 group-hover:underline whitespace-nowrap">
                              {item.work_order_number}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="text-[11px] text-slate-600">
                                {item.maintenance_type?.name || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="font-medium text-slate-900 truncate">
                                {item.title}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <PriorityBadge priority={item.priority} className="scale-85 origin-left" />
                                {item.has_checklist && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold border ${
                                      item.checklist_status === 'FAILED_ITEMS'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : item.checklist_status === 'COMPLETED'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                    title={item.checklist_summary || undefined}
                                  >
                                    <ClipboardCheck className="w-2.5 h-2.5" />
                                    <span>
                                      {item.checklist_status === 'FAILED_ITEMS'
                                        ? 'Failed'
                                        : item.checklist_status === 'COMPLETED'
                                        ? 'Passed'
                                        : 'Checklist'}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <StatusBadge status={item.status} showIcon={false} className="scale-90 origin-left" />
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                              {item.technician?.name || <span className="italic text-slate-400">Unassigned</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap font-mono">
                              {formatShortDate(item.scheduled_date)}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] whitespace-nowrap font-mono">
                              {item.status === 'COMPLETED' && item.completed_date ? (
                                <span className="text-emerald-700 font-semibold">
                                  {formatShortDate(item.completed_date)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
