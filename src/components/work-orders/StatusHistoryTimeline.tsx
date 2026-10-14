import React from 'react';
import { WorkOrderStatusHistory } from '../../api/types';
import { StatusBadge } from '../ui/StatusBadge';
import { formatDate } from '../../lib/utils';
import { ArrowRight, Clock, User, MessageSquare } from 'lucide-react';

interface StatusHistoryTimelineProps {
  history?: WorkOrderStatusHistory[];
}

export const StatusHistoryTimeline: React.FC<StatusHistoryTimelineProps> = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic py-4 text-center">
        No status history recorded yet.
      </div>
    );
  }

  // Ensure chronological display order (oldest to newest)
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = new Date(a.changed_at || a.created_at).getTime();
    const timeB = new Date(b.changed_at || b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
  });

  return (
    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-[#334155]">
      {sortedHistory.map((event, index) => {
        const fromStatus = event.previous_status ?? event.from_status;
        const toStatus = event.new_status ?? event.to_status;
        const timestamp = event.changed_at ?? event.created_at;
        const actor = event.actor_id || event.changed_by;

        return (
          <div key={event.id || index} className="relative group">
            {/* Node Dot */}
            <div className="absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-[#111B2E] border-2 border-teal-600 dark:border-teal-400 ring-2 ring-white dark:ring-[#172338]" />

            <div className="bg-slate-50 dark:bg-[#131F32] border border-slate-200/80 dark:border-[#334155] rounded p-3 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Transition Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fromStatus ? (
                    <>
                      <StatusBadge status={fromStatus as any} showIcon={false} />
                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-white" />
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-white font-mono">INITIAL ·</span>
                  )}
                  <StatusBadge status={toStatus as any} showIcon={false} />
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-white font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(timestamp)}</span>
                </div>
              </div>

              {/* Actor Information - Only rendered when genuinely available */}
              {actor && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white font-medium">
                  <User className="w-3 h-3 text-slate-400 dark:text-white" />
                  <span>{actor}</span>
                </div>
              )}

              {/* Notes / Comment */}
              {event.notes && (
                <div className="text-slate-600 dark:text-white text-xs bg-white dark:bg-[#172338] p-2 rounded border border-slate-200/60 dark:border-[#334155] mt-1 flex items-start gap-1.5">
                  <MessageSquare className="w-3 h-3 text-slate-400 dark:text-white mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{event.notes}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
