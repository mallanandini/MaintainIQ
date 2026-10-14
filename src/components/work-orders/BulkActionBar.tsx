import React from 'react';
import { Users, Download, X, CheckSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BulkActionBarProps {
  selectedIds: number[];
  onClearSelection: () => void;
  onOpenBulkAssign: () => void;
  onExportSelected: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedIds,
  onClearSelection,
  onOpenBulkAssign,
  onExportSelected,
}) => {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
        <CheckSquare className="w-4 h-4 text-teal-400" />
        <span className="text-xs font-bold text-white font-mono">
          {selectedIds.length}
        </span>
        <span className="text-xs text-slate-300">selected</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBulkAssign}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          Assign Technician
        </button>

        <button
          type="button"
          onClick={onExportSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Selected CSV
        </button>
      </div>

      <button
        type="button"
        onClick={onClearSelection}
        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ml-1"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
