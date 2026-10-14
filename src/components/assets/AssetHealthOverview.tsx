import React, { useState } from 'react';
import { AssetHealthOverviewSummary } from '../../api/types';
import {
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface AssetHealthOverviewProps {
  summary: AssetHealthOverviewSummary | null;
  selectedRiskFilter: string;
  onSelectRiskFilter: (risk: string) => void;
  showAttentionOnly: boolean;
  onToggleAttentionOnly: () => void;
  formulaDoc?: string;
  isLoading?: boolean;
}

export const AssetHealthOverview: React.FC<AssetHealthOverviewProps> = ({
  summary,
  selectedRiskFilter,
  onSelectRiskFilter,
  showAttentionOnly,
  onToggleAttentionOnly,
  isLoading = false,
}) => {
  const [showFormula, setShowFormula] = useState(false);

  if (isLoading || !summary) {
    return (
      <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200 dark:border-[#334155] p-4 shadow-sm animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-[#131F32] rounded" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      level: 'CRITICAL',
      label: 'Critical Risk',
      count: summary.critical_risk_count,
      color: 'text-rose-700',
      bg: 'bg-rose-50/70',
      border: 'border-rose-200',
      cardClass: 'asset-risk-card-critical dark:bg-[#4C1826] dark:text-[#FDA4AF] dark:border-[#881337]',
      icon: AlertOctagon,
    },
    {
      level: 'HIGH',
      label: 'High Risk',
      count: summary.high_risk_count,
      color: 'text-amber-700',
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
      cardClass: 'asset-risk-card-high dark:bg-[#452A16] dark:text-[#FDBA74] dark:border-[#7C2D12]',
      icon: ShieldAlert,
    },
    {
      level: 'MODERATE',
      label: 'Moderate Risk',
      count: summary.moderate_risk_count,
      color: 'text-yellow-800',
      bg: 'bg-yellow-50/70',
      border: 'border-yellow-200',
      cardClass: 'asset-risk-card-moderate dark:bg-[#423819] dark:text-[#FDE68A] dark:border-[#713F12]',
      icon: AlertTriangle,
    },
    {
      level: 'LOW',
      label: 'Low Risk',
      count: summary.low_risk_count,
      color: 'text-teal-700',
      bg: 'bg-teal-50/70',
      border: 'border-teal-200',
      cardClass: 'asset-risk-card-low dark:bg-[#123C32] dark:text-[#6EE7B7] dark:border-[#064E3B]',
      icon: CheckCircle2,
    },
    {
      level: 'INSUFFICIENT_DATA',
      label: 'Insufficient Data',
      count: summary.insufficient_data_count,
      color: 'text-slate-600',
      bg: 'bg-slate-100/70',
      border: 'border-slate-200',
      cardClass: 'asset-risk-card-insufficient dark:bg-[#172338] dark:text-white dark:border-[#334155]',
      icon: HelpCircle,
    },
  ];

  return (
    <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-sm p-4 space-y-3">
      {/* Overview Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-[#334155]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">
              Fleet Asset Health & Risk Monitoring
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-300">
              Rule-based indicators evaluated across overdue orders, active emergencies, and operating thresholds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary.attention_required_count > 0 && (
            <button
              onClick={onToggleAttentionOnly}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer',
                showAttentionOnly
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 dark:bg-[#4C1826] hover:bg-rose-100 dark:hover:bg-[#5C1E2F] text-rose-700 dark:text-[#FDA4AF] border-rose-200 dark:border-rose-900/60'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{summary.attention_required_count} Needing Attention</span>
            </button>
          )}

          <button
            onClick={() => setShowFormula(!showFormula)}
            className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition cursor-pointer px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E3048]"
          >
            <Info className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>Formula</span>
            {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Formula Transparency Card */}
      {showFormula && (
        <div className="bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-[#334155] rounded p-3 text-[11px] text-slate-600 dark:text-slate-200 space-y-1.5 animate-in fade-in duration-200">
          <div className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Transparent Rule-Based Risk Scoring Logic</span>
          </div>
          <p className="leading-relaxed">
            Risk scores range from 0 to 100 based strictly on verified data:
            <strong className="text-slate-900 dark:text-white"> Critical Open Work Orders</strong> (up to 35 pts),
            <strong className="text-slate-900 dark:text-white"> Overdue Maintenance Backlog</strong> (up to 30 pts),
            <strong className="text-slate-900 dark:text-white"> Recent Corrective Repairs in past 90 days</strong> (up to 20 pts), and
            <strong className="text-slate-900 dark:text-white"> Operating Hours/Cycles vs Configurable Service Thresholds</strong> (up to 25 pts).
            Equipment marked <em className="text-slate-900 dark:text-white">OUT_OF_SERVICE</em> enforces a minimum floor of 75 (Critical).
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-[#334155]">
            Notice: This rule-based score is an operational maintenance risk indicator. It does not predict mechanical equipment failure.
          </p>
        </div>
      )}

      {/* 5 Risk Category Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedRiskFilter === card.level;

          return (
            <button
              key={card.level}
              onClick={() => onSelectRiskFilter(isSelected ? '' : card.level)}
              className={cn(
                'p-2.5 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden',
                card.bg,
                card.border,
                card.cardClass,
                isSelected ? 'ring-2 ring-teal-500 shadow-xs' : 'hover:opacity-90'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-600 dark:text-inherit flex items-center gap-1.5">
                  <Icon className={cn('w-3.5 h-3.5', card.color, 'dark:text-inherit')} />
                  <span className="truncate">{card.label}</span>
                </span>
                {isSelected && (
                  <span className="text-[9px] uppercase tracking-wider font-bold bg-teal-600 text-white px-1 rounded">
                    Active
                  </span>
                )}
              </div>
              <div className={cn('text-lg font-bold font-mono mt-1', card.color, 'dark:text-inherit')}>
                {card.count}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
