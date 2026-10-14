import React from 'react';
import { RiskLevel } from '../../api/types';
import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RiskBadgeProps {
  level: RiskLevel | string;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  size = 'md',
  showScore = true,
}) => {
  const normLevel = (level || 'INSUFFICIENT_DATA').toUpperCase();

  const configs: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
    CRITICAL: {
      label: 'Critical Risk',
      bg: 'bg-rose-50 dark:bg-[#4C1826]',
      text: 'text-rose-700 dark:text-[#FDA4AF]',
      border: 'border-rose-200 dark:border-rose-900/60',
      icon: AlertOctagon,
    },
    HIGH: {
      label: 'High Risk',
      bg: 'bg-amber-50 dark:bg-[#452A16]',
      text: 'text-amber-700 dark:text-[#FDBA74]',
      border: 'border-amber-200 dark:border-amber-900/60',
      icon: ShieldAlert,
    },
    MODERATE: {
      label: 'Moderate Risk',
      bg: 'bg-yellow-50/80 dark:bg-[#423819]',
      text: 'text-yellow-800 dark:text-[#FDE68A]',
      border: 'border-yellow-200 dark:border-yellow-900/60',
      icon: AlertTriangle,
    },
    LOW: {
      label: 'Low Risk',
      bg: 'bg-teal-50 dark:bg-[#123C32]',
      text: 'text-teal-700 dark:text-[#6EE7B7]',
      border: 'border-teal-200 dark:border-emerald-900/60',
      icon: CheckCircle2,
    },
    INSUFFICIENT_DATA: {
      label: 'Insufficient Data',
      bg: 'bg-slate-100 dark:bg-[#172338]',
      text: 'text-slate-600 dark:text-slate-200',
      border: 'border-slate-200 dark:border-[#334155]',
      icon: HelpCircle,
    },
  };

  const cfg = configs[normLevel] || configs.INSUFFICIENT_DATA;
  const Icon = cfg.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border transition-colors',
        cfg.bg,
        cfg.text,
        cfg.border,
        sizeClasses[size]
      )}
    >
      <Icon className={cn(iconSizes[size], 'shrink-0')} />
      <span>{cfg.label}</span>
      {showScore && score !== null && score !== undefined && (
        <span className="font-mono text-[10px] opacity-80 pl-0.5 border-l border-current/30">
          {score.toFixed(0)}/100
        </span>
      )}
    </span>
  );
};
