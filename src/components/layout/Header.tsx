// MaintainIQ Enterprise v3.0 - Stable HMR verified
import React, { useState, useRef, useEffect } from 'react';
import { 
  PlusCircle, 
  Search, 
  RefreshCw, 
  Menu, 
  PanelLeftClose, 
  PanelLeft, 
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { cn } from '../../lib/utils';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  currentTab: string;
  selectedWorkOrderNumber?: string;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenCreateWO?: () => void;
  onOpenSearch?: () => void;
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  currentTab,
  selectedWorkOrderNumber,
  onNavigate,
  onRefresh,
  isRefreshing,
  onOpenCreateWO,
  onOpenSearch,
  onToggleMobileMenu,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
}) => {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsThemeMenuOpen(false);
    };

    if (isThemeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeMenuOpen]);

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ElementType }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <header className="h-16 bg-white dark:bg-[#111B2E] border-b border-slate-200/90 dark:border-[#334155] px-4 sm:px-6 flex items-center justify-between shrink-0 z-10 gap-3">
      {/* Left Section: Sidebar Toggles & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu hamburger toggle */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Desktop sidebar collapse toggle */}
        {onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            className="hidden md:flex p-1.5 text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Breadcrumb Hierarchy */}
        <div className="hidden sm:block min-w-0">
          <Breadcrumbs
            currentTab={currentTab}
            selectedWorkOrderNumber={selectedWorkOrderNumber}
            onNavigate={onNavigate}
          />
        </div>

        {/* Compact Title for Mobile view */}
        <div className="sm:hidden min-w-0">
          <h1 className="text-sm font-bold text-black dark:text-white truncate">{title}</h1>
        </div>
      </div>

      {/* Right Section: Global Search, Theme Switcher, System Status, Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Search Bar Trigger */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-black dark:text-white hover:text-black dark:hover:text-white bg-slate-50 dark:bg-[#172338] hover:bg-slate-100 dark:hover:bg-[#1E3048] border border-slate-300 dark:border-[#334155] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            title="Search work orders, assets, technicians (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
            <span className="hidden lg:inline text-black dark:text-white font-semibold">
              Search portal...
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-black dark:text-slate-300 font-semibold bg-white dark:bg-[#131F32] border border-slate-300 dark:border-[#334155] rounded shadow-2xs">
              <span className="text-[9px]">Ctrl</span> K
            </kbd>
          </button>
        )}

        {/* Theme Switcher Dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="p-2 text-slate-800 dark:text-white hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded-md transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-[#334155] dark:bg-[#172338]"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (Click to switch)`}
            aria-label="Theme switcher"
            aria-expanded={isThemeMenuOpen}
          >
            {effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-teal-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold hidden md:inline text-black dark:text-white">
              {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          {isThemeMenuOpen && (
            <div
              className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#172338] border border-slate-200 dark:border-[#334155] rounded-lg shadow-xl py-1 text-xs text-slate-800 dark:text-white z-50 animate-in fade-in slide-in-from-top-1"
              role="menu"
            >
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.mode;

                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      setTheme(opt.mode);
                      setIsThemeMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-[#1E3048] transition-colors cursor-pointer',
                      isSelected ? 'font-bold text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/40' : 'text-black dark:text-white'
                    )}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* System Online Indicator Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-[#172338] border border-slate-300 dark:border-[#334155] text-[11px] text-black dark:text-white font-semibold font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>MySQL Online</span>
        </div>

        {/* Dataset Refresh Button */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E3048] rounded transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            title="Refresh current database entities"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={cn('w-4 h-4', isRefreshing && 'animate-spin text-teal-600 dark:text-teal-400')}
            />
          </button>
        )}

        {/* Contextual Action Button */}
        {onOpenCreateWO && currentTab !== 'create-wo' && (
          <button
            type="button"
            onClick={onOpenCreateWO}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <PlusCircle className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">New Work Order</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>
    </header>
  );
};
