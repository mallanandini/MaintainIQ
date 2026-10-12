import React, { useState } from 'react';
import { Technician, TechnicianStatus } from '../api/types';
import { api } from '../api/client';
import { TechnicianModal } from '../components/technicians/TechnicianModal';
import { 
  Users, 
  PlusCircle, 
  Search, 
  Mail, 
  Phone, 
  Wrench, 
  CheckCircle2, 
  Clock,
  Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';

interface TechniciansPageProps {
  technicians: Technician[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectWorkOrder?: (woId: number) => void;
}

export const TechniciansPage: React.FC<TechniciansPageProps> = ({
  technicians,
  isLoading,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredTechnicians = technicians.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.employee_id.toLowerCase().includes(search.toLowerCase()) ||
      t.specialization.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateTechnician = async (payload: any) => {
    await api.createTechnician(payload);
    onRefresh();
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Maintenance Technicians & Engineering Roster
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View active field technicians, specialized trade disciplines, and dispatch availability.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer w-fit"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Register Technician
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
            placeholder="Search by name, employee ID, specialty..."
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
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Technician Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTechnicians.map((t) => (
          <div
            key={t.id}
            className="bg-white p-5 rounded-lg border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3.5 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{t.name}</h3>
                  <div className="font-mono text-[11px] text-teal-700 font-medium">
                    {t.employee_id}
                  </div>
                </div>
              </div>

              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold border',
                  t.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : t.status === 'ON_LEAVE'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {t.status}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-800">{t.specialization}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{t.email}</span>
              </div>
              {t.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.phone}</span>
                </div>
              )}
            </div>

            {t.hourly_rate && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Standard Labor Rate:</span>
                <span className="font-mono font-semibold text-slate-800">
                  ${t.hourly_rate.toFixed(2)} / hr
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Technician Modal */}
      <TechnicianModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTechnician}
      />
    </div>
  );
};
