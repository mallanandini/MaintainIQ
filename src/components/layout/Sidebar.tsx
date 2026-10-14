import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutDashboard,
  ClipboardList, 
  Cpu, 
  Users, 
  PlusCircle, 
  BarChart3, 
  Layers,
  X,
  CheckSquare,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DashboardStats } from '../../api/types';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  stats?: DashboardStats | null;
  onOpenCreateWO: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
  shortcut?: string;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  stats,
  onOpenCreateWO,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  width = 280,
  onWidthChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  // Keyboard navigation & resizing support on separator
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onWidthChange || isCollapsed) return;

    let newWidth = width;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newWidth = Math.max(220, width - 10);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      newWidth = Math.min(420, width + 10);
    } else if (e.key === 'Home') {
      e.preventDefault();
      newWidth = 220;
    } else if (e.key === 'End') {
      e.preventDefault();
      newWidth = 420;
    }

    if (newWidth !== width) {
      onWidthChange(newWidth);
      try {
        localStorage.setItem('maintainiq_sidebar_width', String(newWidth));
      } catch {
        // ignore
      }
    }
  };

  // Dragging handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCollapsed || e.button !== 0) return; // Only left-click
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const targetWidth = Math.min(420, Math.max(220, startWidthRef.current + deltaX));
      onWidthChange?.(targetWidth);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      setIsDragging(false);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const deltaX = upEvent.clientX - startXRef.current;
      const finalWidth = Math.min(420, Math.max(220, startWidthRef.current + deltaX));
      onWidthChange?.(finalWidth);
      try {
        localStorage.setItem('maintainiq_sidebar_width', String(finalWidth));
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const navSections: NavSection[] = [
    {
      group: 'Core',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          icon: LayoutDashboard,
          shortcut: 'O',
        },
      ],
    },
    {
      group: 'Operations',
      items: [
        {
          id: 'work-orders',
          label: 'Work Orders',
          icon: ClipboardList,
          badge: stats ? stats.work_orders.active : undefined,
          badgeColor: 'teal',
          shortcut: 'W',
        },
        {
          id: 'assets',
          label: 'Asset Registry',
          icon: Cpu,
          badge: stats ? stats.assets.total : undefined,
          badgeColor: 'indigo',
          shortcut: 'A',
        },
        {
          id: 'technicians',
          label: 'Technicians',
          icon: Users,
          badge: stats ? stats.technicians.active : undefined,
          badgeColor: 'emerald',
          shortcut: 'T',
        },
      ],
    },
    {
      group: 'Compliance & Intelligence',
      items: [
        {
          id: 'inspections',
          label: 'Inspections',
          icon: CheckSquare,
          shortcut: 'I',
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          shortcut: 'Y',
        },
      ],
    },
    {
      group: 'Governance',
      items: [
        {
          id: 'admin',
          label: 'Administration',
          icon: ShieldCheck,
          shortcut: 'M',
        },
      ],
    },
  ];

  // Dynamic width styling for desktop
  const desktopWidth = isCollapsed ? 72 : width;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          width: undefined, // handled via responsive styles or style prop for desktop
        }}
        className={cn(
          'bg-[#080F1E] text-white flex flex-col shrink-0 h-full border-r border-slate-800 transition-width duration-200 ease-out z-40 select-none relative',
          'fixed inset-y-0 left-0 md:static md:translate-x-0',
          isOpenMobile ? 'translate-x-0 shadow-2xl w-64' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Desktop inline width wrapper to support seamless dragging */}
        <div
          style={{ width: isOpenMobile ? undefined : `${desktopWidth}px` }}
          className="flex flex-col h-full overflow-hidden transition-all duration-150"
        >
          {/* Brand Header */}
          <div
            className={cn(
              'h-16 flex items-center border-b border-slate-800/80 px-4 justify-between shrink-0',
              isCollapsed && 'md:justify-center md:px-2'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 font-bold shrink-0 shadow-inner">
                <Layers className="w-4 h-4 text-teal-400" />
              </div>
              {(!isCollapsed || isOpenMobile) && (
                <div className="min-w-0 animate-in fade-in duration-150">
                  <div className="text-white font-semibold text-sm tracking-tight flex items-center gap-1.5">
                    <span className="truncate">MaintainIQ</span>
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded border border-teal-500/30 font-mono font-bold shrink-0">
                      v3.0
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate font-medium">Enterprise Portal</div>
                </div>
              )}
            </div>

            {/* Close button on mobile */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close navigation sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Primary Action Button (New Work Order) */}
          <div className="p-3 border-b border-slate-800/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpenCreateWO();
                onCloseMobile?.();
              }}
              title={isCollapsed && !isOpenMobile ? 'Create Work Order' : undefined}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                isCollapsed && !isOpenMobile ? 'w-full px-0 justify-center' : 'w-full'
              )}
            >
              <PlusCircle className="w-4 h-4 shrink-0 text-white" />
              {(!isCollapsed || isOpenMobile) && <span className="truncate">Create Work Order</span>}
            </button>
          </div>

          {/* Navigation Section Links */}
          <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
            {navSections.map((sec) => (
              <div key={sec.group} className="space-y-1">
                {(!isCollapsed || isOpenMobile) && (
                  <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {sec.group}
                  </div>
                )}
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <div key={item.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          onCloseMobile?.();
                        }}
                        className={cn(
                          'w-full flex items-center rounded text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                          isCollapsed && !isOpenMobile
                            ? 'justify-center p-2.5'
                            : 'justify-between px-3 py-2',
                          isActive
                            ? 'bg-slate-800 text-white font-semibold border-l-2 border-teal-400 pl-2.5'
                            : 'text-slate-200 hover:text-white hover:bg-slate-800/60'
                        )}
                        aria-label={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              'w-4 h-4 shrink-0',
                              isActive ? 'text-teal-400' : 'text-slate-300 group-hover:text-white'
                            )}
                          />
                          {(!isCollapsed || isOpenMobile) && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </div>

                        {(!isCollapsed || isOpenMobile) && item.badge !== undefined && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 font-bold',
                              isActive
                                ? 'bg-slate-700 text-teal-300'
                                : 'bg-slate-800 text-slate-300'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>

                      {/* Tooltip when sidebar is collapsed (Desktop only) */}
                      {isCollapsed && !isOpenMobile && (
                        <div
                          role="tooltip"
                          className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-950 text-white text-xs font-medium rounded-md shadow-2xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 flex items-center gap-2"
                        >
                          <span>{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-900 text-teal-300 font-mono font-bold">
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd className="px-1 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                              {item.shortcut}
                            </kbd>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Critical Watch KPI Summary (Shown when expanded) */}
          {(!isCollapsed || isOpenMobile) && stats && (
            <div className="p-3 mx-2.5 mb-2 rounded bg-slate-800/50 border border-slate-800 text-xs space-y-2 shrink-0">
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Critical Watch</span>
                {stats.work_orders.critical_active > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                  <div className="text-slate-300 text-[10px]">Critical WOs</div>
                  <div
                    className={cn(
                      'text-sm font-bold',
                      stats.work_orders.critical_active > 0 ? 'text-rose-400' : 'text-slate-200'
                    )}
                  >
                    {stats.work_orders.critical_active}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                  <div className="text-slate-300 text-[10px]">Overdue</div>
                  <div
                    className={cn(
                      'text-sm font-bold',
                      stats.work_orders.overdue > 0 ? 'text-amber-400' : 'text-slate-200'
                    )}
                  >
                    {stats.work_orders.overdue}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <div className="hidden md:flex p-2 border-t border-slate-800/80 justify-center shrink-0">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer w-full flex items-center justify-center gap-1.5 text-[11px] font-medium"
                title={isCollapsed ? 'Expand sidebar (Ctrl+\\)' : 'Collapse sidebar (Ctrl+\\)'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4 text-slate-300" />
                    <span>Collapse sidebar</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Clean System Status Footer */}
          <div
            className={cn(
              'p-3 border-t border-slate-800/80 bg-slate-900/90 text-[11px] text-slate-300 flex items-center shrink-0',
              isCollapsed && !isOpenMobile ? 'justify-center' : 'justify-between'
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-xs shadow-emerald-400/50" />
              {(!isCollapsed || isOpenMobile) && (
                <span className="text-white font-medium">Enterprise Online</span>
              )}
            </div>
            {(!isCollapsed || isOpenMobile) && (
              <span className="font-mono text-[10px] text-slate-400 font-semibold">v3.0</span>
            )}
          </div>
        </div>

        {/* Draggable Resize Handle (along right edge, desktop only, non-collapsed) */}
        {!isCollapsed && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={220}
            aria-valuemax={420}
            aria-label="Resize sidebar horizontally"
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className="hidden md:flex absolute top-0 -right-1.5 w-3 h-full cursor-col-resize items-center justify-center group z-30 select-none touch-none focus-visible:outline-none"
            title="Drag horizontally to resize sidebar (or use left/right arrow keys)"
          >
            <div
              className={cn(
                'w-1 h-full rounded-full transition-colors',
                isDragging
                  ? 'bg-teal-400 shadow-md shadow-teal-500/50'
                  : 'bg-transparent group-hover:bg-teal-500/60 group-focus-visible:bg-teal-400'
              )}
            />
          </div>
        )}
      </aside>
    </>
  );
};
