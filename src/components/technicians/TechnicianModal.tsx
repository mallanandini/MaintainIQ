import React, { useState } from 'react';
import { CreateTechnicianPayload, TechnicianStatus } from '../../api/types';
import { X, AlertTriangle } from 'lucide-react';

interface TechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTechnicianPayload) => Promise<void>;
}

export const TechnicianModal: React.FC<TechnicianModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('HVAC & Mechanical');
  const [status, setStatus] = useState<TechnicianStatus>('ACTIVE');
  const [hourlyRate, setHourlyRate] = useState('65.0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err.message || 'Failed to register technician.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-semibold text-sm">Register Maintenance Technician</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Employee ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g., TECH-106"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sarah Chen"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="s.chen@maintainiq.internal"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specialization / Discipline <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="e.g., Electrical & PLC, HVAC, Robotics"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duty Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TechnicianStatus)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Hourly Billing Rate ($/hr)
            </label>
            <input
              type="number"
              step="1"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none"
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
              {isSubmitting ? 'Registering...' : 'Register Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
