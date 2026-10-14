import React, { useState, useEffect } from 'react';
import { AssetHealthDetail } from '../../api/types';
import { api } from '../../api/client';
import { RiskBadge } from './RiskBadge';
import {
  ShieldAlert,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Layers,
  Info,
  Calendar,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface AssetHealthCardProps {
  assetId: number;
}

export const AssetHealthCard: React.FC<AssetHealthCardProps> = ({ assetId }) => {
  const [health, setHealth] = useState<AssetHealthDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAssetHealth(assetId);
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate asset health.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [assetId]);

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-10 bg-slate-200 rounded w-full" />
        <div className="h-16 bg-slate-100 rounded w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-2">
        <div className="flex items-center gap-2 text-rose-700 font-semibold">
          <AlertOctagon className="w-4 h-4" />
          <span>Asset Risk Evaluation Unavailable</span>
        </div>
        <p className="text-slate-600">{error}</p>
        <button
          onClick={fetchHealth}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-medium hover:bg-slate-800 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!health) return null;

  const {
    risk_score,
    risk_level,
    has_sufficient_data,
    status_label,
    summary_explanation,
    contributing_factors,
    usage_metrics,
    maintenance_metrics,
    needs_maintenance_attention,
    disclaimer
  } = health;

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-4 text-xs">
      {/* Header & Risk Level */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-teal-50 border border-teal-200 text-teal-700">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Asset Health & Risk Assessment
            </h4>
            <p className="text-[11px] text-slate-500">
              Explainable rule-based maintenance risk indicator
            </p>
          </div>
        </div>

        <RiskBadge level={risk_level} score={risk_score} size="md" />
      </div>

      {/* Maintenance Attention Alert Banner */}
      {needs_maintenance_attention && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-md p-3 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-[11px] tracking-tight text-amber-800">
              Maintenance Attention Required
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This equipment has elevated risk indicators requiring maintenance team review.
              {maintenance_metrics.overdue_work_orders_count > 0 && ` Contains ${maintenance_metrics.overdue_work_orders_count} overdue work order(s).`}
              {maintenance_metrics.critical_open_count > 0 && ` Contains ${maintenance_metrics.critical_open_count} active CRITICAL ticket(s).`}
              {usage_metrics.threshold_exceeded && ` Operating usage has exceeded recommended service thresholds.`}
            </p>
          </div>
        </div>
      )}

      {/* Insufficient Data State */}
      {!has_sufficient_data ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-md p-4 text-center space-y-2">
          <HelpCircle className="w-6 h-6 text-slate-400 mx-auto" />
          <div className="font-semibold text-slate-700 text-xs">Insufficient Baseline Data</div>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
            {summary_explanation}
          </p>
          <div className="text-[10px] text-slate-400 font-mono">
            Log operating hours/cycles or record maintenance work orders to calculate a risk assessment.
          </div>
        </div>
      ) : (
        <>
          {/* Score Meter Bar */}
          {typeof risk_score === 'number' && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-md border border-slate-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">Calculated Risk Index</span>
                <span className="font-mono font-bold text-slate-900">
                  {risk_score.toFixed(1)} <span className="text-slate-400 font-normal">/ 100</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    risk_score >= 75
                      ? 'bg-rose-600'
                      : risk_score >= 50
                      ? 'bg-amber-500'
                      : risk_score >= 25
                      ? 'bg-yellow-500'
                      : 'bg-teal-600'
                  )}
                  style={{ width: `${Math.min(risk_score, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 pt-0.5 font-mono">
                <span>0 Low</span>
                <span>25 Mod</span>
                <span>50 High</span>
                <span>75 Crit</span>
                <span>100</span>
              </div>
            </div>
          )}

          {/* Summary Explanation */}
          <div className="text-[11px] text-slate-700 bg-teal-50/50 p-2.5 rounded border border-teal-100/80 leading-relaxed">
            <span className="font-semibold text-teal-900">Summary: </span>
            {summary_explanation}
          </div>

          {/* Contributing Factors */}
          {contributing_factors.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                Contributing Risk Factors
              </div>
              <div className="space-y-1.5">
                {contributing_factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 p-2 rounded bg-slate-50 border border-slate-100"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1.5">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            factor.severity === 'CRITICAL'
                              ? 'bg-rose-500'
                              : factor.severity === 'HIGH'
                              ? 'bg-amber-500'
                              : factor.severity === 'WARNING'
                              ? 'bg-yellow-500'
                              : 'bg-teal-500'
                          )}
                        />
                        <span>{factor.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 pl-3 leading-relaxed">
                        {factor.description}
                      </p>
                    </div>

                    <div className="shrink-0 text-right font-mono text-[11px] font-bold text-slate-700">
                      +{factor.impact_points.toFixed(0)} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage & Thresholds Breakdown */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
              Service Thresholds & Utilization
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* Operating Hours */}
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium">Operating Hours</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {usage_metrics.operating_hours !== null && usage_metrics.operating_hours !== undefined
                      ? `${usage_metrics.operating_hours.toLocaleString()} hrs`
                      : 'Not recorded'}
                  </span>
                </div>
                {usage_metrics.service_threshold_hours && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Limit: {usage_metrics.service_threshold_hours.toLocaleString()} hrs</span>
                      <span className="font-mono font-medium text-slate-700">
                        {usage_metrics.hours_utilization_pct?.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          (usage_metrics.hours_utilization_pct || 0) >= 100
                            ? 'bg-rose-500'
                            : (usage_metrics.hours_utilization_pct || 0) >= 85
                            ? 'bg-amber-500'
                            : 'bg-teal-500'
                        )}
                        style={{
                          width: `${Math.min(usage_metrics.hours_utilization_pct || 0, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Operating Cycles */}
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium">Operating Cycles</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {usage_metrics.operating_cycles !== null && usage_metrics.operating_cycles !== undefined
                      ? `${usage_metrics.operating_cycles.toLocaleString()} cycles`
                      : 'Not recorded'}
                  </span>
                </div>
                {usage_metrics.service_threshold_cycles && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Limit: {usage_metrics.service_threshold_cycles.toLocaleString()} cycles</span>
                      <span className="font-mono font-medium text-slate-700">
                        {usage_metrics.cycles_utilization_pct?.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          (usage_metrics.cycles_utilization_pct || 0) >= 100
                            ? 'bg-rose-500'
                            : (usage_metrics.cycles_utilization_pct || 0) >= 85
                            ? 'bg-amber-500'
                            : 'bg-teal-500'
                        )}
                        style={{
                          width: `${Math.min(usage_metrics.cycles_utilization_pct || 0, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transparent Disclaimer Box */}
      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
        <span>{disclaimer}</span>
      </div>
    </div>
  );
};
