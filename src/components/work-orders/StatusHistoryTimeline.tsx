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

  return (
    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {history.map((event, index) => (
        <div key={event.id || index} className="relative group">
          {/* Node Dot */}
          <div className="absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-teal-600 ring-2 ring-white" />

          <div className="bg-slate-50 border border-slate-200/80 rounded p-3 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Transition Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {event.from_status ? (
                  <>
                    <StatusBadge status={event.from_status} showIcon={false} />
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">NEW ·</span>
                )}
                <StatusBadge status={event.to_status} showIcon={false} />
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatDate(event.created_at)}</span>
              </div>
            </div>

            {/* Changed By */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <User className="w-3 h-3 text-slate-400" />
              <span>{event.changed_by}</span>
            </div>

            {/* Notes / Comment */}
            {event.notes && (
              <div className="text-slate-600 text-xs bg-white p-2 rounded border border-slate-200/60 mt-1 flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{event.notes}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
