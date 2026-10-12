import React, { useState, useEffect } from 'react';
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
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { CreateWorkOrderPage } from './pages/CreateWorkOrderPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { AssetsPage } from './pages/AssetsPage';
import { TechniciansPage } from './pages/TechniciansPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'work-orders' | 'assets' | 'technicians' | 'create-wo' | 'wo-detail'>('work-orders');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);

  // Global reference entities
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const loadGlobalData = async () => {
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
    } catch (err) {
      console.error('Failed to load global data:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadGlobalData();
  }, []);

  const handleTriggerSeed = async () => {
    setIsSeeding(true);
    try {
      await api.seedDatabase();
      await loadGlobalData();
      setCurrentTab('work-orders');
    } catch (err) {
      console.error('Failed to seed:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSelectWorkOrder = (id: number) => {
    setSelectedWorkOrderId(id);
    setCurrentTab('wo-detail');
  };

  const handleCreateSuccess = (newOrder: WorkOrder) => {
    loadGlobalData();
    setSelectedWorkOrderId(newOrder.id);
    setCurrentTab('wo-detail');
  };

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    'work-orders': {
      title: 'Work Order Management',
      subtitle: 'Central dispatch, life-cycle monitoring and schedule enforcement.',
    },
    'create-wo': {
      title: 'New Maintenance Work Order',
      subtitle: 'Dispatch technicians and enforce equipment integrity constraints.',
    },
    'wo-detail': {
      title: 'Work Order Details & Audit Trail',
      subtitle: 'State transitions, labor execution, and technical root-cause logs.',
    },
    'assets': {
      title: 'Physical Asset Registry',
      subtitle: 'Machinery health status, operational history, and criticality tracking.',
    },
    'technicians': {
      title: 'Technician & Engineering Directory',
      subtitle: 'Trade specialties, active workloads, and hourly labor rates.',
    },
  };

  const currentMeta = pageTitles[currentTab] || pageTitles['work-orders'];

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden selection:bg-teal-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={(tab: any) => {
          setCurrentTab(tab);
        }}
        stats={stats}
        onOpenCreateWO={() => setCurrentTab('create-wo')}
        onTriggerSeed={handleTriggerSeed}
        isSeeding={isSeeding}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          onRefresh={loadGlobalData}
          isRefreshing={isRefreshing}
          onOpenCreateWO={currentTab !== 'create-wo' ? () => setCurrentTab('create-wo') : undefined}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/80">
          {currentTab === 'work-orders' && (
            <WorkOrdersPage
              assets={assets}
              technicians={technicians}
              stats={stats}
              onSelectWorkOrder={handleSelectWorkOrder}
              onOpenCreateWO={() => setCurrentTab('create-wo')}
              onRefreshStats={loadGlobalData}
            />
          )}

          {currentTab === 'create-wo' && (
            <CreateWorkOrderPage
              assets={assets}
              technicians={technicians}
              maintenanceTypes={maintenanceTypes}
              onBack={() => setCurrentTab('work-orders')}
              onSuccess={handleCreateSuccess}
            />
          )}

          {currentTab === 'wo-detail' && selectedWorkOrderId && (
            <WorkOrderDetailPage
              workOrderId={selectedWorkOrderId}
              technicians={technicians}
              onBack={() => {
                loadGlobalData();
                setCurrentTab('work-orders');
              }}
              onSelectAsset={(assetId) => {
                setCurrentTab('assets');
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
        </main>
      </div>
    </div>
  );
}
