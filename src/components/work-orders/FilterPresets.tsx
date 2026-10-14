import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WorkOrderQueryParams } from '../../api/types';

export interface FilterPreset {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  filters: Partial<WorkOrderQueryParams>;
}

const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: 'preset-all',
    name: 'All Orders',
    isBuiltIn: true,
    filters: {},
  },
  {
    id: 'preset-active',
    name: 'Active Queue',
    isBuiltIn: true,
    filters: { status: '' },
  },
  {
    id: 'preset-critical',
    name: 'Critical Emergency',
    isBuiltIn: true,
    filters: { priority: 'CRITICAL' },
  },
  {
    id: 'preset-overdue',
    name: 'Overdue Schedules',
    isBuiltIn: true,
    filters: { is_overdue: true },
  },
  {
    id: 'preset-in-progress',
    name: 'In Progress Floor',
    isBuiltIn: true,
    filters: { status: 'IN_PROGRESS' },
  },
];

const STORAGE_KEY = 'maintainiq_wo_filter_presets';

interface FilterPresetsProps {
  currentFilters: Partial<WorkOrderQueryParams>;
  onApplyPreset: (preset: FilterPreset) => void;
  activePresetId?: string | null;
}

export const FilterPresets: React.FC<FilterPresetsProps> = ({
  currentFilters,
  onApplyPreset,
  activePresetId,
}) => {
  const [customPresets, setCustomPresets] = useState<FilterPreset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCustomPresets(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: presetName.trim(),
      isBuiltIn: false,
      filters: { ...currentFilters },
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setPresetName('');
    setIsModalOpen(false);
    onApplyPreset(newPreset);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
        <Bookmark className="w-3 h-3 text-slate-400" />
        Presets:
      </span>

      {allPresets.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset)}
            className={cn(
              'group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border',
              isActive
                ? 'bg-teal-700 dark:bg-teal-600 text-white border-teal-700 dark:border-teal-500 shadow-xs'
                : 'bg-white dark:bg-[#131F32] text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E3048] hover:border-slate-300 dark:hover:border-slate-500'
            )}
          >
            <span>{preset.name}</span>
            {!preset.isBuiltIn && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => deletePreset(preset.id, e)}
                className="text-slate-400 hover:text-rose-500 rounded-full p-0.5 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                title="Delete preset"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
        title="Save active filter combination as a reusable preset"
      >
        <Plus className="w-3 h-3" />
        Save Current Filter
      </button>

      {/* Save Preset Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#172338] rounded-lg shadow-xl border border-slate-200 dark:border-[#334155] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Save Filter Preset
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveCustomPreset} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-white mb-1">
                  Preset Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. High Priority Pumps"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-[#111B2E] p-2.5 rounded border border-slate-100 dark:border-[#334155]">
                Saves current status, priority, asset, technician, and schedule filters locally in your browser.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs cursor-pointer"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
