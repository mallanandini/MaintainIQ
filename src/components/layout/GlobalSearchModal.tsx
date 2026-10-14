import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  ClipboardList, 
  Cpu, 
  Users, 
  ArrowRight, 
  CornerDownLeft, 
  AlertCircle 
} from 'lucide-react';
import { Asset, Technician, WorkOrder } from '../../api/types';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';
import { StatusBadge, PriorityBadge } from '../ui/StatusBadge';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  technicians: Technician[];
  onSelectWorkOrder: (id: number) => void;
  onSelectAsset: (id: number) => void;
  onSelectTechnician: (id: number) => void;
}

type SearchResultItem = 
  | { type: 'work-order'; id: number; number: string; title: string; status: string; priority: string }
  | { type: 'asset'; id: number; tag: string; name: string; category: string; location: string }
  | { type: 'technician'; id: number; employeeId: string; name: string; specialization: string; status: string };

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  assets,
  technicians,
  onSelectWorkOrder,
  onSelectAsset,
  onSelectTechnician,
}) => {
  const [query, setQuery] = useState('');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isSearchingWo, setIsSearchingWo] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Fetch work orders matching query (debounced)
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      // Load recent 10 work orders by default
      api.getWorkOrders()
        .then((res) => setWorkOrders(res.slice(0, 10)))
        .catch(() => setWorkOrders([]));
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingWo(true);
      api.getWorkOrders({ q: query.trim() })
        .then((res) => setWorkOrders(res.slice(0, 15)))
        .catch(() => setWorkOrders([]))
        .finally(() => setIsSearchingWo(false));
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Combined Results Filtered & Categorized
  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    // Filter work orders
    workOrders.forEach((wo) => {
      items.push({
        type: 'work-order',
        id: wo.id,
        number: wo.work_order_number,
        title: wo.title,
        status: wo.status,
        priority: wo.priority,
      });
    });

    // Filter assets
    const matchedAssets = assets
      .filter((a) => {
        if (!q) return false;
        return (
          a.asset_tag.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);

    matchedAssets.forEach((a) => {
      items.push({
        type: 'asset',
        id: a.id,
        tag: a.asset_tag,
        name: a.name,
        category: a.category,
        location: a.location,
      });
    });

    // Filter technicians
    const matchedTechs = technicians
      .filter((t) => {
        if (!q) return false;
        return (
          t.name.toLowerCase().includes(q) ||
          t.employee_id.toLowerCase().includes(q) ||
          t.specialization.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);

    matchedTechs.forEach((t) => {
      items.push({
        type: 'technician',
        id: t.id,
        employeeId: t.employee_id,
        name: t.name,
        specialization: t.specialization,
        status: t.status,
      });
    });

    return items;
  }, [query, workOrders, assets, technicians]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Handle Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectItem(results[selectedIndex]);
      }
    }
  };

  const handleSelectItem = (item: SearchResultItem) => {
    onClose();
    if (item.type === 'work-order') {
      onSelectWorkOrder(item.id);
    } else if (item.type === 'asset') {
      onSelectAsset(item.id);
    } else if (item.type === 'technician') {
      onSelectTechnician(item.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-xs transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global search palette"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#172338] rounded-lg shadow-2xl border border-slate-200 dark:border-[#334155] overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-[#334155] bg-slate-50/50 dark:bg-[#111B2E]">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work orders, assets, technicians... (or press Esc to exit)"
            className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded transition-colors mr-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-400 dark:text-white bg-slate-200/70 dark:bg-[#131F32] px-1.5 py-0.5 rounded border border-slate-300/80 dark:border-[#334155]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-[#334155]">
          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-white">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-white">No matching records found</p>
              <p className="text-[11px] text-slate-400 dark:text-white mt-0.5">
                Try searching for work order numbers (e.g. WO-), asset tags, or technician names.
              </p>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-700'
                      : 'hover:bg-slate-50 dark:hover:bg-[#1E3048]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.type === 'work-order' && (
                      <div className="p-2 rounded bg-teal-100/70 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 shrink-0">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                    )}
                    {item.type === 'asset' && (
                      <div className="p-2 rounded bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shrink-0">
                        <Cpu className="w-4 h-4" />
                      </div>
                    )}
                    {item.type === 'technician' && (
                      <div className="p-2 rounded bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.type === 'work-order' && (
                          <>
                            <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                              {item.number}
                            </span>
                            <span className="text-xs text-slate-800 dark:text-white font-medium truncate">
                              {item.title}
                            </span>
                          </>
                        )}
                        {item.type === 'asset' && (
                          <>
                            <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                              {item.tag}
                            </span>
                            <span className="text-xs text-slate-800 dark:text-white font-medium truncate">
                              {item.name}
                            </span>
                          </>
                        )}
                        {item.type === 'technician' && (
                          <>
                            <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              {item.employeeId}
                            </span>
                            <span className="text-xs text-slate-800 dark:text-white font-medium truncate">
                              {item.name}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-white">
                        {item.type === 'work-order' && (
                          <>
                            <StatusBadge status={item.status as any} />
                            <PriorityBadge priority={item.priority as any} />
                          </>
                        )}
                        {item.type === 'asset' && (
                          <>
                            <span className="bg-slate-100 dark:bg-[#131F32] dark:text-white px-1.5 py-0.2 rounded text-[10px]">
                              {item.category}
                            </span>
                            <span className="truncate">{item.location}</span>
                          </>
                        )}
                        {item.type === 'technician' && (
                          <>
                            <span className="bg-slate-100 dark:bg-[#131F32] dark:text-white px-1.5 py-0.2 rounded text-[10px]">
                              {item.specialization}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">{item.status}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-mono font-medium',
                        item.type === 'work-order' && 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
                        item.type === 'asset' && 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
                        item.type === 'technician' && 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      )}
                    >
                      {item.type.replace('-', ' ').toUpperCase()}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 hidden sm:inline" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#111B2E] border-t border-slate-200 dark:border-[#334155] text-[11px] text-slate-500 dark:text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] rounded font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] rounded font-mono text-[10px]">Enter</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] rounded font-mono text-[10px]">Esc</kbd>
              close
            </span>
          </div>
          <span className="text-teal-700 dark:text-teal-400 font-medium">MaintainIQ Enterprise Search</span>
        </div>
      </div>
    </div>
  );
};
