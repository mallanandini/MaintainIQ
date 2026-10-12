import React, { useState, useEffect } from 'react';
import { 
  WorkOrder, 
  Asset, 
  Technician, 
  DashboardStats 
} from '../api/types';
import { api } from '../api/client';
import { StatCards } from '../components/dashboard/StatCards';
import { WorkOrderFilters } from '../components/work-orders/WorkOrderFilters';
import { WorkOrderTable } from '../components/work-orders/WorkOrderTable';

interface WorkOrdersPageProps {
  assets: Asset[];
  technicians: Technician[];
  stats: DashboardStats | null;
  onSelectWorkOrder: (id: number) => void;
  onOpenCreateWO: () => void;
  onRefreshStats: () => void;
}

export const WorkOrdersPage: React.FC<WorkOrdersPageProps> = ({
  assets,
  technicians,
  stats,
  onSelectWorkOrder,
  onOpenCreateWO,
  onRefreshStats,
}) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');

  const fetchWorkOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWorkOrders({
        q: searchQuery.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        asset_id: assetFilter ? parseInt(assetFilter, 10) : undefined,
        technician_id: technicianFilter ? parseInt(technicianFilter, 10) : undefined,
      });
      setWorkOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch work orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [searchQuery, statusFilter, priorityFilter, assetFilter, technicianFilter]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssetFilter('');
    setTechnicianFilter('');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      {/* Small Operational Summary Cards */}
      <StatCards
        stats={stats}
        onFilterStatus={(s) => setStatusFilter(s)}
        onFilterPriority={(p) => setPriorityFilter(p)}
      />

      {/* Combined Search & Multi-Filters */}
      <WorkOrderFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        assetFilter={assetFilter}
        onAssetChange={setAssetFilter}
        technicianFilter={technicianFilter}
        onTechnicianChange={setTechnicianFilter}
        assets={assets}
        technicians={technicians}
        onResetFilters={handleResetFilters}
      />

      {/* Work Orders Responsive Table */}
      <WorkOrderTable
        workOrders={workOrders}
        isLoading={isLoading}
        error={error}
        onSelectWorkOrder={onSelectWorkOrder}
        onOpenCreateWO={onOpenCreateWO}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
