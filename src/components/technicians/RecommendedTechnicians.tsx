import React, { useState } from 'react';
import { TechnicianRecommendation } from '../../api/types';
import { 
  Sparkles, 
  Check, 
  UserCheck, 
  Clock, 
  Award, 
  Briefcase, 
  AlertTriangle,
  ShieldAlert,
  X,
  Info,
  CheckCircle2
} from 'lucide-react';

interface RecommendedTechniciansProps {
  recommendations: TechnicianRecommendation[];
  isLoading?: boolean;
  selectedTechnicianId?: number | string | null;
  onSelectTechnician: (techId: number, technician?: TechnicianRecommendation) => void;
  assetCategory?: string;
  isCritical?: boolean;
  title?: string;
  actionLabel?: string;
}

export const RecommendedTechnicians: React.FC<RecommendedTechniciansProps> = ({
  recommendations,
  isLoading = false,
  selectedTechnicianId,
  onSelectTechnician,
  assetCategory,
  isCritical = false,
  title = 'Recommended Technicians',
  actionLabel = 'Select Technician',
}) => {
  const currentSelectedId = selectedTechnicianId ? Number(selectedTechnicianId) : null;
  const [pendingTech, setPendingTech] = useState<TechnicianRecommendation | null>(null);

  const handleOpenConfirm = (rec: TechnicianRecommendation) => {
    setPendingTech(rec);
  };

  const handleConfirmSelection = () => {
    if (pendingTech) {
      onSelectTechnician(pendingTech.technician_id, pendingTech);
      setPendingTech(null);
    }
  };

  return (
    <div className="bg-slate-50/70 dark:bg-[#131F32] border border-slate-200/90 dark:border-[#334155] rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-[#334155] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-white">
              Deterministic ranking based on skill compatibility, live workload, and active tasks.
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800 px-2 py-0.5 rounded">
          Top {Math.min(3, recommendations.length || 3)} Eligible
        </span>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-2.5 animate-pulse pt-1">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-white dark:bg-[#172338] border border-slate-200 dark:border-[#334155] rounded p-3">
              <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      )}

      {/* Warning: Zero Eligible Technicians Available */}
      {!isLoading && recommendations.length === 0 && (
        <div className="bg-amber-50/80 dark:bg-[#452A16]/50 border border-amber-200 dark:border-amber-900/60 rounded-lg p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-[#FDBA74]">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No Suitable Active Technicians Available</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
            All registered technicians in MaintainIQ are currently inactive, on leave, or unassigned.
            You may still manually assign an active technician if one becomes available in the dropdown.
          </p>
          {isCritical && (
            <div className="bg-white/80 dark:bg-[#172338] border border-amber-300 dark:border-amber-700 rounded p-2 text-[11px] font-medium text-rose-700 dark:text-[#FDA4AF] flex items-center gap-1.5 mt-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                Mandatory Rule 2 Notice: This work order has CRITICAL priority and cannot be dispatched without an assigned technician.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Recommendation Cards */}
      {!isLoading && recommendations.length > 0 && (
        <div className="space-y-2 pt-1">
          {recommendations.slice(0, 3).map((rec, index) => {
            const isSelected = currentSelectedId === rec.technician_id;

            return (
              <div
                key={rec.technician_id}
                className={`bg-white dark:bg-[#172338] border rounded-lg p-3 text-xs transition-all ${
                  isSelected
                    ? 'border-teal-500 ring-1 ring-teal-500/40 shadow-xs'
                    : 'border-slate-200/90 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Tech Details & Badges */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Rank Tag */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          index === 0
                            ? 'bg-teal-600 text-white'
                            : index === 1
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-200 dark:bg-[#111B2E] text-slate-700 dark:text-white'
                        }`}
                      >
                        #{index + 1}
                      </span>

                      {/* Name & ID */}
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {rec.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-white">
                        ({rec.employee_id})
                      </span>

                      {/* Match Level Badge */}
                      {rec.skill_match_level === 'DIRECT' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 px-1.5 py-0.5 rounded">
                          <Award className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          Direct Specialist
                        </span>
                      )}
                      {rec.skill_match_level === 'COMPATIBLE' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 px-1.5 py-0.5 rounded">
                          Compatible Skill
                        </span>
                      )}
                      {rec.skill_match_level === 'GENERAL' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-white bg-slate-100 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] px-1.5 py-0.5 rounded">
                          General Capacity
                        </span>
                      )}

                      {/* Score Pill */}
                      <span 
                        className="text-[10px] font-mono font-medium text-slate-500 dark:text-white bg-slate-100 dark:bg-[#111B2E] px-1.5 py-0.5 rounded"
                        title="Deterministic ranking points: Skill match (max 50) + Availability (max 40) + Priority alignment (max 10)"
                      >
                        Rank: {rec.composite_score} pts
                      </span>
                    </div>

                    {/* Subline: Specialization + Workload */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-white">
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400 dark:text-white" />
                        <span>Specialization: <strong className="text-slate-800 dark:text-white font-medium">{rec.specialization}</strong></span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-white" />
                        <span>
                          {rec.active_work_orders_count === 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">0 Active Tasks (Full Availability)</span>
                          ) : (
                            <span>{rec.active_work_orders_count} active task(s) · {rec.active_estimated_hours}h</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Deterministic Explanation */}
                    <p className="text-[11px] text-slate-500 dark:text-white italic leading-snug">
                      "{rec.explanation}"
                    </p>
                  </div>

                  {/* Right Column: Select Action */}
                  <div className="shrink-0 sm:self-center">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800 rounded font-medium text-xs">
                        <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        Assigned
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenConfirm(rec)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded font-medium text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{actionLabel}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explicit User Confirmation Modal */}
      {pendingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 dark:bg-[#111B2E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-400" />
                <h4 className="font-semibold text-xs tracking-tight">Confirm Technician Assignment</h4>
              </div>
              <button
                type="button"
                onClick={() => setPendingTech(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 dark:text-white">
                Please confirm dispatching{' '}
                <strong className="text-slate-900 dark:text-white font-semibold">{pendingTech.name}</strong>{' '}
                ({pendingTech.employee_id}) to this work order:
              </p>

              <div className="bg-slate-50 dark:bg-[#131F32] border border-slate-200 dark:border-[#334155] rounded p-3 space-y-2 text-[11px] text-slate-700 dark:text-white">
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/80 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-white">Documented Specialization:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{pendingTech.specialization}</span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/80 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-white">Skill Match Level:</span>
                  <span className="font-semibold text-teal-700 dark:text-teal-400">
                    {pendingTech.skill_match_level === 'DIRECT'
                      ? 'Direct Specialist Match'
                      : pendingTech.skill_match_level === 'COMPATIBLE'
                      ? 'Compatible Domain'
                      : 'General Technical Capacity'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-slate-200/80 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-white">Live Workload:</span>
                  <span className="font-mono text-slate-800 dark:text-white">
                    {pendingTech.active_work_orders_count === 0
                      ? '0 active tasks (Available)'
                      : `${pendingTech.active_work_orders_count} active orders (${pendingTech.active_estimated_hours}h estimated)`}
                  </span>
                </div>
                <div className="pt-1 text-slate-600 dark:text-white leading-snug italic">
                  "{pendingTech.explanation}"
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-white flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Selection will not take effect without your explicit confirmation.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => setPendingTech(null)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-[#131F32] hover:bg-slate-200 dark:hover:bg-[#1E3048] border dark:border-[#334155] text-slate-700 dark:text-white rounded font-medium text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelection}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
