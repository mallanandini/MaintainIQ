import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  currentTab: string;
  selectedWorkOrderNumber?: string;
  onNavigate: (tab: string) => void;
}

interface CrumbItem {
  label: string;
  tab?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  currentTab,
  selectedWorkOrderNumber,
  onNavigate,
}) => {
  const getCrumbs = (): CrumbItem[] => {
    switch (currentTab) {
      case 'overview':
        return [
          { label: 'Portal', tab: 'overview' },
          { label: 'Executive Overview' },
        ];
      case 'work-orders':
        return [
          { label: 'Operations', tab: 'work-orders' },
          { label: 'Work Orders' },
        ];
      case 'create-wo':
        return [
          { label: 'Operations', tab: 'work-orders' },
          { label: 'Work Orders', tab: 'work-orders' },
          { label: 'New Work Order' },
        ];
      case 'wo-detail':
        return [
          { label: 'Operations', tab: 'work-orders' },
          { label: 'Work Orders', tab: 'work-orders' },
          { label: selectedWorkOrderNumber ? selectedWorkOrderNumber : 'Order Details' },
        ];
      case 'assets':
        return [
          { label: 'Fleet', tab: 'assets' },
          { label: 'Asset Registry' },
        ];
      case 'technicians':
        return [
          { label: 'Workforce', tab: 'technicians' },
          { label: 'Technician Directory' },
        ];
      case 'inspections':
        return [
          { label: 'Compliance', tab: 'inspections' },
          { label: 'Digital Inspections' },
        ];
      case 'analytics':
        return [
          { label: 'Intelligence', tab: 'analytics' },
          { label: 'Operations Analytics' },
        ];
      case 'admin':
        return [
          { label: 'System', tab: 'admin' },
          { label: 'Administration & Governance' },
        ];
      default:
        return [
          { label: 'MaintainIQ', tab: 'overview' },
          { label: currentTab },
        ];
    }
  };

  const crumbs = getCrumbs();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 overflow-hidden">
      <button
        type="button"
        onClick={() => onNavigate('overview')}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded px-1 -ml-1 cursor-pointer"
        title="Go to Overview"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="font-semibold text-slate-700">MaintainIQ</span>
      </button>

      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;

        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" aria-hidden="true" />
            {isLast ? (
              <span
                aria-current="page"
                className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-xs"
              >
                {crumb.label}
              </span>
            ) : crumb.tab ? (
              <button
                type="button"
                onClick={() => onNavigate(crumb.tab!)}
                className="hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded px-1 cursor-pointer truncate max-w-[120px]"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-slate-500 truncate max-w-[120px]">{crumb.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
