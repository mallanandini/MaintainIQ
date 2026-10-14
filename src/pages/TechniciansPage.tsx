import React, { useState } from 'react';
import { Technician, TechnicianStatus, CreateTechnicianPayload } from '../api/types';
import { api } from '../api/client';
import { TechnicianModal } from '../components/technicians/TechnicianModal';
import { 
  PlusCircle, 
  Search, 
  Mail, 
  Phone, 
  Briefcase,
  MoreVertical,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  DollarSign,
  CheckCircle2,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

interface TechniciansPageProps {
  technicians: Technician[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectWorkOrder?: (woId: number) => void;
}

export const TechniciansPage: React.FC<TechniciansPageProps> = ({
  technicians,
  onRefresh,
}) => {
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [detailTechnician, setDetailTechnician] = useState<Technician | null>(null);
  const [deactivatingTechnician, setDeactivatingTechnician] = useState<Technician | null>(null);
  const [reactivatingTechnician, setReactivatingTechnician] = useState<Technician | null>(null);
  const [deletingTechnician, setDeletingTechnician] = useState<Technician | null>(null);

  // Active dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleCreateTechnician = async (payload: CreateTechnicianPayload) => {
    try {
      await api.createTechnician(payload);
      success(`Registered technician ${payload.name} (${payload.employee_id}).`, 'Technician Registered');
      setIsCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to register technician.', 'Registration Error');
      throw err;
    }
  };

  const handleEditTechnician = async (payload: CreateTechnicianPayload) => {
    if (!editingTechnician) return;
    try {
      await api.updateTechnician(editingTechnician.id, payload);
      success(`Updated technician ${payload.name} (${editingTechnician.employee_id}).`, 'Technician Updated');
      setEditingTechnician(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to update technician.', 'Update Error');
      throw err;
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingTechnician) return;
    setActionLoading(true);
    try {
      await api.updateTechnician(deactivatingTechnician.id, { status: 'INACTIVE' });
      success(`Technician ${deactivatingTechnician.name} is now INACTIVE.`, 'Technician Deactivated');
      setDeactivatingTechnician(null);
      if (detailTechnician?.id === deactivatingTechnician.id) {
        setDetailTechnician(null);
      }
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to deactivate technician.', 'Deactivation Blocked');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReactivate = async () => {
    if (!reactivatingTechnician) return;
    setActionLoading(true);
    try {
      await api.updateTechnician(reactivatingTechnician.id, { status: 'ACTIVE' });
      success(`Technician ${reactivatingTechnician.name} is now ACTIVE and available for dispatch.`, 'Technician Reactivated');
      setReactivatingTechnician(null);
      if (detailTechnician?.id === reactivatingTechnician.id) {
        setDetailTechnician(null);
      }
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to reactivate technician.', 'Reactivation Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTechnician) return;
    setActionLoading(true);
    try {
      const res = await api.deleteTechnician(deletingTechnician.id);
      success(res.message || `Deleted technician ${deletingTechnician.name}.`, 'Technician Deleted');
      setDeletingTechnician(null);
      if (detailTechnician?.id === deletingTechnician.id) {
        setDetailTechnician(null);
      }
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to delete technician record.', 'Deletion Blocked');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5" onClick={() => setActiveMenuId(null)}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Maintenance Technicians & Engineering Roster
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage field engineers, trade specialties, dispatch availability, and operational lifecycle status.
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer w-fit"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Register Technician
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-[#172338] p-3.5 rounded border border-slate-200/90 dark:border-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, specialty..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 border border-slate-300 dark:border-[#334155] rounded bg-white dark:bg-[#131F32] text-slate-700 dark:text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">All Statuses ({technicians.length})</option>
            <option value="ACTIVE">Active ({technicians.filter((t) => t.status === 'ACTIVE').length})</option>
            <option value="ON_LEAVE">On Leave ({technicians.filter((t) => t.status === 'ON_LEAVE').length})</option>
            <option value="INACTIVE">Inactive ({technicians.filter((t) => t.status === 'INACTIVE').length})</option>
          </select>
        </div>
      </div>

      {/* Technician Cards Grid */}
      {filteredTechnicians.length === 0 ? (
        <div className="bg-white dark:bg-[#172338] border border-slate-200 dark:border-[#334155] rounded-lg p-12 text-center">
          <UserX className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No technicians found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Try adjusting your search query or status filter to see other engineering personnel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechnicians.map((t) => (
            <div
              key={t.id}
              className={cn(
                'bg-white dark:bg-[#172338] p-5 rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3.5 transition-colors relative',
                t.status === 'INACTIVE'
                  ? 'border-slate-200/80 dark:border-[#334155]/60 opacity-80'
                  : 'border-slate-200/90 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500'
              )}
            >
              {/* Header row with avatar, name, and actions menu */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm',
                      t.status === 'ACTIVE'
                        ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                        : t.status === 'ON_LEAVE'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    )}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      {t.name}
                    </h3>
                    <div className="font-mono text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                      {t.employee_id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-semibold border',
                      t.status === 'ACTIVE'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : t.status === 'ON_LEAVE'
                        ? 'bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-[#FDBA74] border-amber-200 dark:border-amber-900/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {t.status === 'INACTIVE' ? 'INACTIVE' : t.status}
                  </span>

                  {/* Actions Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === t.id ? null : t.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Technician Actions"
                      aria-label="Technician Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenuId === t.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#131F32] rounded-md shadow-lg border border-slate-200 dark:border-[#334155] py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs"
                      >
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setDetailTechnician(t);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setEditingTechnician(t);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                          Edit Details
                        </button>

                        <div className="my-1 border-t border-slate-100 dark:border-[#334155]" />

                        {t.status === 'ACTIVE' ? (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setDeactivatingTechnician(t);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Deactivate Technician
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setReactivatingTechnician(t);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Reactivate Technician
                          </button>
                        )}

                        <div className="my-1 border-t border-slate-100 dark:border-[#334155]" />

                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            setDeletingTechnician(t);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Technician
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Specialization & Contact */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#334155] space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-white truncate">{t.specialization}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{t.email}</span>
                </div>
                {t.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t.phone}</span>
                  </div>
                )}
              </div>

              {/* Workload and Rate Stats */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      (t.active_work_orders_count || 0) > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                    )} />
                    {t.active_work_orders_count || 0} active
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span>{t.assigned_work_orders_count || 0} total</span>
                </div>

                {t.hourly_rate != null && (
                  <span className="font-mono font-semibold text-slate-800 dark:text-white">
                    ${t.hourly_rate.toFixed(2)}/hr
                  </span>
                )}
              </div>

              {/* Quick Card Footer Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setDetailTechnician(t)}
                  className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  View Details
                </button>
                {t.status === 'ACTIVE' ? (
                  <button
                    onClick={() => setDeactivatingTechnician(t)}
                    className="px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors cursor-pointer"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => setReactivatingTechnician(t)}
                    className="px-2 py-1 text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded transition-colors cursor-pointer"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Register Technician Modal */}
      <TechnicianModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTechnician}
      />

      {/* 2. Edit Technician Modal */}
      {editingTechnician && (
        <TechnicianModal
          isOpen={true}
          technician={editingTechnician}
          onClose={() => setEditingTechnician(null)}
          onSubmit={handleEditTechnician}
        />
      )}

      {/* 3. Detailed View Modal */}
      {detailTechnician && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailTechnician(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 dark:bg-[#111B2E] text-white flex items-center justify-between border-b border-slate-800 dark:border-[#334155]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center font-bold text-teal-300 text-sm">
                  {detailTechnician.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{detailTechnician.name}</h3>
                  <div className="font-mono text-[11px] text-teal-400">{detailTechnician.employee_id}</div>
                </div>
              </div>
              <button
                onClick={() => setDetailTechnician(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Status and Rate Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-[#131F32] rounded border border-slate-200 dark:border-[#334155]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">
                    Operational Status
                  </span>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded text-[11px] font-bold border',
                      detailTechnician.status === 'ACTIVE'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : detailTechnician.status === 'ON_LEAVE'
                        ? 'bg-amber-50 dark:bg-[#452A16] text-amber-700 dark:text-[#FDBA74] border-amber-200 dark:border-amber-900/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    )}
                  >
                    {detailTechnician.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#131F32] rounded border border-slate-200 dark:border-[#334155]">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">
                    Labor Rate
                  </span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    ${detailTechnician.hourly_rate?.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-400">/ hr</span>
                  </div>
                </div>
              </div>

              {/* Workload Summary */}
              <div className="p-3 bg-slate-50 dark:bg-[#131F32] rounded border border-slate-200 dark:border-[#334155] flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                    Active Assignments
                  </span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {detailTechnician.active_work_orders_count || 0}
                  </span>
                </div>
                <div className="h-8 border-r border-slate-200 dark:border-[#334155]" />
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                    Lifetime Work Orders
                  </span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {detailTechnician.assigned_work_orders_count || 0}
                  </span>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2 border-t border-slate-100 dark:border-[#334155] pt-3 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#334155]/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Trade Specialization:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{detailTechnician.specialization}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#334155]/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Email Address:</span>
                  <span className="font-mono">{detailTechnician.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#334155]/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Phone Number:</span>
                  <span>{detailTechnician.phone || 'None provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#334155]/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Member Since:</span>
                  <span>{new Date(detailTechnician.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Dispatch Availability Guidance */}
              <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 rounded text-teal-800 dark:text-teal-200">
                <div className="font-semibold mb-0.5">Dispatch & Scheduling Policy</div>
                <p className="text-[11px] leading-relaxed">
                  {detailTechnician.status === 'ACTIVE'
                    ? 'Technician is active and qualified for direct assignment and deterministic smart recommendations based on trade discipline and current workload.'
                    : detailTechnician.status === 'ON_LEAVE'
                    ? 'Technician is currently on leave. Preventative and corrective work orders should be assigned to alternative personnel.'
                    : 'Technician is inactive. Work order assignment is strictly prevented by database validation. Historical records remain fully preserved.'}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const t = detailTechnician;
                    setDetailTechnician(null);
                    setDeletingTechnician(t);
                  }}
                  className="px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const t = detailTechnician;
                      setDetailTechnician(null);
                      setEditingTechnician(t);
                    }}
                    className="px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer font-medium"
                  >
                    Edit
                  </button>
                  {detailTechnician.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const t = detailTechnician;
                        setDetailTechnician(null);
                        setDeactivatingTechnician(t);
                      }}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-sm transition-colors cursor-pointer"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const t = detailTechnician;
                        setDetailTechnician(null);
                        setReactivatingTechnician(t);
                      }}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium shadow-sm transition-colors cursor-pointer"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Deactivate Confirmation Dialog */}
      {deactivatingTechnician && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setDeactivatingTechnician(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Deactivate Technician</h3>
              </div>
              <button
                onClick={() => !actionLoading && setDeactivatingTechnician(null)}
                className="text-amber-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                You are requesting to deactivate{' '}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {deactivatingTechnician.name}
                </strong>{' '}
                ({deactivatingTechnician.employee_id}).
              </p>

              {/* Active Assignment Guardrail Check */}
              {(deactivatingTechnician.active_work_orders_count || 0) > 0 ? (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Active Assignment Guardrail (Blocked)</span>
                  </div>
                  <p className="text-rose-700 dark:text-rose-200 leading-relaxed text-[11px]">
                    This technician currently has{' '}
                    <strong>{deactivatingTechnician.active_work_orders_count}</strong> active work order(s) in{' '}
                    <span className="font-mono font-semibold">ASSIGNED</span> or{' '}
                    <span className="font-mono font-semibold">IN_PROGRESS</span> status.
                  </p>
                  <p className="text-rose-700 dark:text-rose-200 text-[11px] leading-relaxed">
                    To safeguard plant operations, deactivation is strictly prohibited until these active orders are reassigned or completed.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded space-y-1.5 text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Operational Impact</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    • Marked as <span className="font-mono font-semibold">INACTIVE</span> in the engineering roster.<br />
                    • Excluded from smart dispatch recommendations.<br />
                    • All historical work orders and audit logs remain permanently preserved.<br />
                    • Can be reactivated at any time.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDeactivatingTechnician(null)}
                  className="px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || (deactivatingTechnician.active_work_orders_count || 0) > 0}
                  onClick={handleConfirmDeactivate}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reactivate Confirmation Dialog */}
      {reactivatingTechnician && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setReactivatingTechnician(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Reactivate Technician</h3>
              </div>
              <button
                onClick={() => !actionLoading && setReactivatingTechnician(null)}
                className="text-teal-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                Are you sure you want to reactivate{' '}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {reactivatingTechnician.name}
                </strong>{' '}
                ({reactivatingTechnician.employee_id})?
              </p>

              <div className="p-3.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 rounded space-y-1.5 text-teal-800 dark:text-teal-200">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Immediate Availability</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  The technician will be marked <span className="font-mono font-semibold">ACTIVE</span> and will immediately become eligible for work order dispatch and recommendation algorithms.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setReactivatingTechnician(null)}
                  className="px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmReactivate}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Reactivating...' : 'Confirm Reactivation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Permanent Delete Confirmation Dialog */}
      {deletingTechnician && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setDeletingTechnician(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-[#172338] rounded-lg border border-rose-300 dark:border-rose-900/80 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Permanent Record Deletion</h3>
              </div>
              <button
                onClick={() => !actionLoading && setDeletingTechnician(null)}
                className="text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                You are requesting to permanently delete{' '}
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {deletingTechnician.name}
                </strong>{' '}
                ({deletingTechnician.employee_id}).
              </p>

              {/* Foreign-Key and Audit Trail Integrity Check */}
              {(deletingTechnician.assigned_work_orders_count || 0) > 0 ? (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Audit Trail Protection (Deletion Blocked)</span>
                  </div>
                  <p className="text-rose-700 dark:text-rose-200 leading-relaxed text-[11px]">
                    This technician is linked to{' '}
                    <strong>{deletingTechnician.assigned_work_orders_count}</strong> work order record(s) (past or present).
                  </p>
                  <p className="text-rose-700 dark:text-rose-200 text-[11px] leading-relaxed">
                    Under enterprise compliance and safety standards, permanent deletion is strictly blocked to protect maintenance audit trails and equipment history. Please use <strong>Deactivate</strong> instead.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded space-y-2 text-rose-800 dark:text-rose-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Destructive Action Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This technician has zero associated work orders. Permanently deleting this record will purge it entirely from the database. This action cannot be reversed.
                  </p>
                </div>
              )}

              {/* RBAC Local Limitation Note */}
              <div className="p-2.5 bg-slate-50 dark:bg-[#131F32] rounded border border-slate-200 dark:border-[#334155] text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">
                <strong>Access Note:</strong> MaintainIQ is operating in local development mode without multi-tenant role-based access control (RBAC). All actions are executed directly with database guardrail validations.
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDeletingTechnician(null)}
                  className="px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || (deletingTechnician.assigned_work_orders_count || 0) > 0}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
