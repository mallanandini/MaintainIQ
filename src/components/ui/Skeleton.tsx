import React from 'react';
import { cn } from '../../lib/utils';
import { AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn('animate-pulse bg-slate-200/80 dark:bg-slate-700/80 rounded', className)}
      aria-hidden="true"
    />
  );
};

export const CardSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 4,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
}) => {
  return (
    <div className={className} aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/80 dark:border-[#334155] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="w-full bg-white dark:bg-[#131F32] rounded border border-slate-200/80 dark:border-[#334155] shadow-xs overflow-hidden" aria-busy="true" aria-label="Loading table records">
      <div className="p-4 border-b border-slate-200/70 dark:border-[#334155] bg-slate-50/50 dark:bg-[#111B2E] flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48 rounded" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-[#334155]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-3.5 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={cn('flex-1', cIdx === 0 ? 'w-24 shrink-0' : '')}
              >
                <Skeleton className={cn('h-3.5', cIdx === 0 ? 'w-20' : cIdx === 1 ? 'w-3/4' : 'w-1/2')} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 text-center bg-white dark:bg-[#172338] rounded border border-slate-200/80 dark:border-[#334155] shadow-xs flex flex-col items-center justify-center my-4',
        className
      )}
      role="status"
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#131F32] flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-white mt-1 max-w-sm text-center leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({
  title = 'Data Loading Error',
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'p-6 bg-rose-50/70 dark:bg-[#4C1826]/40 border border-rose-200/80 dark:border-rose-900/60 rounded text-rose-900 dark:text-[#FDA4AF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 my-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{message}</div>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
};
