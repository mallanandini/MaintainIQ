import React, { useState, useEffect } from 'react';
import { Asset, AssetStatus, CreateAssetPayload, UpdateAssetPayload } from '../../api/types';
import { X, AlertTriangle } from 'lucide-react';

interface AssetModalProps {
  asset?: Asset | null; // If provided, edit mode; else create mode
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const AssetModal: React.FC<AssetModalProps> = ({
  asset,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const isEdit = Boolean(asset);

  const [assetTag, setAssetTag] = useState(asset?.asset_tag || '');
  const [name, setName] = useState(asset?.name || '');
  const [category, setCategory] = useState(asset?.category || 'Machinery');
  const [location, setLocation] = useState(asset?.location || '');
  const [status, setStatus] = useState<AssetStatus>(asset?.status || 'OPERATIONAL');
  const [criticality, setCriticality] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    asset?.criticality || 'MEDIUM'
  );
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number || '');
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer || '');
  const [modelNumber, setModelNumber] = useState(asset?.model_number || '');
  const [notes, setNotes] = useState(asset?.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isEdit) {
        const payload: UpdateAssetPayload = {
          name: name.trim(),
          category: category.trim(),
          location: location.trim(),
          status,
          criticality,
          serial_number: serialNumber.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          model_number: modelNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        };
        await onSubmit(payload);
      } else {
        const payload: CreateAssetPayload = {
          asset_tag: assetTag.trim().toUpperCase(),
          name: name.trim(),
          category: category.trim(),
          location: location.trim(),
          status,
          criticality,
          serial_number: serialNumber.trim() || undefined,
          manufacturer: manufacturer.trim() || undefined,
          model_number: modelNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        };
        await onSubmit(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {isEdit ? `Edit Asset: ${asset?.asset_tag}` : 'Register New Asset'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Asset Tag <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEdit}
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g., AST-0107"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded disabled:bg-slate-100 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Asset Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Thermal Oxidizer Unit 2"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., HVAC, Thermal, CNC, Robotics"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plant Location <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Bay 4, Utility Deck B"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssetStatus)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none cursor-pointer"
              >
                <option value="OPERATIONAL">OPERATIONAL</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                <option value="DECOMMISSIONED">DECOMMISSIONED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Criticality
              </label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Siemens"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Model Number</label>
              <input
                type="text"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                placeholder="e.g., S7-1500"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g., SN-998822"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Engineering Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational constraints, special tooling required, lubrication specifications..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving Asset...' : isEdit ? 'Save Changes' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
