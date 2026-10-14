import React, { useState, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Technician, 
  MaintenanceType, 
  DashboardStats, 
  WorkOrder 
} from './api/types';
import { api } from './api/client';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { OverviewPage } from './pages/OverviewPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { CreateWorkOrderPage } from './pages/CreateWorkOrderPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { AssetsPage } from './pages/AssetsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdministrationPage } from './pages/AdministrationPage';

export type PortalTab = 
  | 'overview'
  | 'work-orders' 
  | 'assets' 
  | 'technicians' 
  | 'inspections'
  | 'analytics' 
  | 'admin'
  | 'create-wo' 
  | 'wo-detail';

function AppContent() {
  const { success, info } = useToast();
  const getInitialTab = (): PortalTab => {
    try {
      const hash = window.location.hash.replace(/^#\/?/, '') as PortalTab;
      const validTabs: PortalTab[] = [
        'overview', 'work-orders', 'assets', 'technicians', 
        'inspections', 'analytics', 'admin', 'create-wo', 'wo-detail'
      ];
      return validTabs.includes(hash) ? hash : 'overview';
    } catch {
      return 'overview';
    }
  };

  const [currentTab, setCurrentTab] = useState<PortalTab>(getInitialTab);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);
  const [selectedWorkOrderNumber, setSelectedWorkOrderNumber] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as PortalTab;
      const validTabs: PortalTab[] = [
        'overview', 'work-orders', 'assets', 'technicians', 
        'inspections', 'analytics', 'admin', 'create-wo', 'wo-detail'
      ];
      if (validTabs.includes(hash)) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = useCallback((tab: PortalTab) => {
    try {
      window.location.hash = tab;
    } catch {
      // ignore
    }
    setCurrentTab(tab);
  }, []);

  // Global reference entities
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Shell State with localStorage persistence
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maintainiq_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('maintainiq_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 220 && parsed <= 420) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return 280;
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync sidebar collapsed toggle to localStorage
  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('maintainiq_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleSidebarWidthChange = useCallback((newWidth: number) => {
    setSidebarWidth(newWidth);
    try {
      localStorage.setItem('maintainiq_sidebar_width', String(newWidth));
    } catch {
      // ignore
    }
  }, []);

  const loadGlobalData = useCallback(async (notify = false) => {
    setIsRefreshing(true);
    try {
      const [assetsData, techsData, typesData, statsData] = await Promise.all([
        api.getAssets(),
        api.getTechnicians(),
        api.getMaintenanceTypes(),
        api.getDashboardStats(),
      ]);
      setAssets(assetsData);
      setTechnicians(techsData);
      setMaintenanceTypes(typesData);
      setStats(statsData);
      if (notify) {
        info('Database entities synchronized successfully.', 'Data Synchronized');
      }
    } catch (err) {
      console.error('Failed to load global data:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoadingInitial(false);
    }
  }, [info]);

  useEffect(() => {
    loadGlobalData();
  }, [loadGlobalData]);

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+\, /, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // Ctrl+\ or Cmd+\ for sidebar collapse toggle
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        handleToggleSidebarCollapse();
        return;
      }

      // "/" key when not typing in form field
      const activeTag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) &&
        !isEditable
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Escape key to close mobile menu or search
      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        if (isMobileNavOpen) setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isMobileNavOpen, handleToggleSidebarCollapse]);

  // Fetch work order number when selectedWorkOrderId changes for breadcrumbs
  useEffect(() => {
    if (selectedWorkOrderId) {
      api.getWorkOrder(selectedWorkOrderId)
        .then((order) => setSelectedWorkOrderNumber(order.work_order_number))
        .catch(() => setSelectedWorkOrderNumber(`WO #${selectedWorkOrderId}`));
    } else {
      setSelectedWorkOrderNumber(undefined);
    }
  }, [selectedWorkOrderId]);

  const handleSelectWorkOrder = (id: number) => {
    setSelectedWorkOrderId(id);
    navigateTo('wo-detail');
  };

  const handleCreateSuccess = (newOrder: WorkOrder) => {
    success(`Dispatched ${newOrder.work_order_number} (${newOrder.title}) successfully.`, 'Work Order Dispatched');
    loadGlobalData();
    setSelectedWorkOrderId(newOrder.id);
    setSelectedWorkOrderNumber(newOrder.work_order_number);
    navigateTo('wo-detail');
  };

  const pageTitles: Record<PortalTab, { title: string; subtitle: string }> = {
    'overview': {
      title: 'Operations Command Center',
      subtitle: 'Real-time dispatch status, asset health indicators, and SLA compliance monitoring.',
    },
    'work-orders': {
      title: 'Work Order Management',
      subtitle: 'Central dispatch, life-cycle monitoring, and schedule enforcement.',
    },
    'create-wo': {
      title: 'New Maintenance Work Order',
      subtitle: 'Dispatch technicians and enforce equipment integrity constraints.',
    },
    'wo-detail': {
      title: 'Work Order Details & Audit Trail',
      subtitle: 'State transitions, labor execution, and digital inspection logs.',
    },
    'assets': {
      title: 'Physical Asset Registry',
      subtitle: 'Machinery health status, operational history, and criticality tracking.',
    },
    'technicians': {
      title: 'Technician & Engineering Directory',
      subtitle: 'Trade specialties, active workloads, and skill-matched assignments.',
    },
    'inspections': {
      title: 'Digital Inspection Checklists',
      subtitle: 'Standardized quality assurance templates, compliance audits, and field protocols.',
    },
    'analytics': {
      title: 'Maintenance Operations Analytics',
      subtitle: 'Verified operational metrics, SLA compliance, and equipment maintenance trends.',
    },
    'admin': {
      title: 'Administration & System Governance',
      subtitle: 'Operational health diagnostics, maintenance taxonomy, and business rule guardrails.',
    },
  };

  const currentMeta = pageTitles[currentTab] || pageTitles['overview'];

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#0B1220] font-sans text-black dark:text-white antialiased overflow-hidden selection:bg-teal-500 selection:text-white transition-colors duration-200">
      {/* Enterprise Resizable & Collapsible Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={(tab) => {
          navigateTo(tab as PortalTab);
        }}
        stats={stats}
        onOpenCreateWO={() => navigateTo('create-wo')}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header with Breadcrumbs, Theme Switcher & Global Search */}
        <Header
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          currentTab={currentTab}
          selectedWorkOrderNumber={selectedWorkOrderNumber}
          onNavigate={(tab) => navigateTo(tab as PortalTab)}
          onRefresh={() => loadGlobalData(true)}
          isRefreshing={isRefreshing}
          onOpenCreateWO={currentTab !== 'create-wo' ? () => navigateTo('create-wo') : undefined}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileMenu={() => setIsMobileNavOpen(!isMobileNavOpen)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50/80 dark:bg-[#0B1220] focus-visible:outline-none transition-colors duration-200" tabIndex={-1}>
          {currentTab === 'overview' && (
            <OverviewPage
              stats={stats}
              assets={assets}
              technicians={technicians}
              onSelectWorkOrder={handleSelectWorkOrder}
              onNavigate={(tab) => navigateTo(tab as PortalTab)}
              onOpenCreateWO={() => navigateTo('create-wo')}
              onRefresh={loadGlobalData}
            />
          )}

          {currentTab === 'work-orders' && (
            <WorkOrdersPage
              assets={assets}
              technicians={technicians}
              stats={stats}
              onSelectWorkOrder={handleSelectWorkOrder}
              onOpenCreateWO={() => navigateTo('create-wo')}
              onRefreshStats={loadGlobalData}
            />
          )}

          {currentTab === 'create-wo' && (
            <CreateWorkOrderPage
              assets={assets}
              technicians={technicians}
              maintenanceTypes={maintenanceTypes}
              onBack={() => navigateTo('work-orders')}
              onSuccess={handleCreateSuccess}
            />
          )}

          {currentTab === 'wo-detail' && selectedWorkOrderId && (
            <WorkOrderDetailPage
              workOrderId={selectedWorkOrderId}
              technicians={technicians}
              onBack={() => {
                loadGlobalData();
                navigateTo('work-orders');
              }}
              onSelectAsset={() => {
                navigateTo('assets');
              }}
            />
          )}

          {currentTab === 'assets' && (
            <AssetsPage
              assets={assets}
              isLoading={isLoadingInitial}
              onRefresh={loadGlobalData}
              onSelectWorkOrder={handleSelectWorkOrder}
            />
          )}

          {currentTab === 'technicians' && (
            <TechniciansPage
              technicians={technicians}
              isLoading={isLoadingInitial}
              onRefresh={loadGlobalData}
              onSelectWorkOrder={handleSelectWorkOrder}
            />
          )}

          {currentTab === 'inspections' && (
            <InspectionsPage
              maintenanceTypes={maintenanceTypes}
              onSelectWorkOrder={handleSelectWorkOrder}
              onOpenCreateWO={() => navigateTo('create-wo')}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage
              onSelectWorkOrder={handleSelectWorkOrder}
            />
          )}

          {currentTab === 'admin' && (
            <AdministrationPage
              maintenanceTypes={maintenanceTypes}
              onRefreshGlobal={loadGlobalData}
            />
          )}
        </main>
      </div>

      {/* Global Quick-Search Command Palette */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        assets={assets}
        technicians={technicians}
        onSelectWorkOrder={handleSelectWorkOrder}
        onSelectAsset={() => {
          navigateTo('assets');
        }}
        onSelectTechnician={() => {
          navigateTo('technicians');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
