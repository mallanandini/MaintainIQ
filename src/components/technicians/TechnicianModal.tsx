import React, { useState, useEffect } from 'react';
import { CreateTechnicianPayload, Technician, TechnicianStatus } from '../../api/types';
import { X, AlertTriangle } from 'lucide-react';

interface TechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTechnicianPayload) => Promise<void>;
  technician?: Technician | null;
}

export const TechnicianModal: React.FC<TechnicianModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  technician,
}) => {
  if (!isOpen) return null;

  const isEditing = !!technician;

  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('HVAC & Mechanical');
  const [status, setStatus] = useState<TechnicianStatus>('ACTIVE');
  const [hourlyRate, setHourlyRate] = useState('65.0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (technician) {
      setEmployeeId(technician.employee_id);
      setName(technician.name);
      setEmail(technician.email);
      setPhone(technician.phone || '');
      setSpecialization(technician.specialization);
      setStatus(technician.status);
      setHourlyRate(technician.hourly_rate != null ? String(technician.hourly_rate) : '');
    } else {
      setEmployeeId('');
      setName('');
      setEmail('');
      setPhone('');
      setSpecialization('HVAC & Mechanical');
      setStatus('ACTIVE');
      setHourlyRate('65.0');
    }
    setError(null);
  }, [technician, isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        employee_id: employeeId.trim().toUpperCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        specialization: specialization.trim(),
        status,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save technician details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 dark:bg-[#111B2E] border-b border-slate-800 dark:border-[#334155] text-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">
              {isEditing ? `Edit Technician: ${technician.name}` : 'Register Maintenance Technician'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEditing
                ? 'Update trade discipline, contact coordinates, or billing rate.'
                : 'Add a certified engineer or maintenance contractor to the roster.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Employee ID {!isEditing && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g., TECH-106"
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded font-mono bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {isEditing && (
                <span className="text-[10px] text-slate-400">Employee ID is an immutable key.</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sarah Chen"
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="s.chen@maintainiq.internal"
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Specialization / Discipline <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g., Electrical & PLC, HVAC, Robotics"
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Duty Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TechnicianStatus)}
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
              Hourly Billing Rate ($/hr)
            </label>
            <input
              type="number"
              step="1"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g. 65.0"
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
            >
              {isSubmitting
                ? isEditing ? 'Saving Changes...' : 'Registering...'
                : isEditing ? 'Save Changes' : 'Register Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
