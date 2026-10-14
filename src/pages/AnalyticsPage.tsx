import React from 'react';
import { MaintenanceAnalyticsView } from '../components/analytics/MaintenanceAnalyticsView';

interface AnalyticsPageProps {
  onSelectAsset?: (assetId: number) => void;
  onSelectWorkOrder?: (orderId: number) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  onSelectAsset,
  onSelectWorkOrder,
}) => {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      <MaintenanceAnalyticsView
        onSelectAsset={onSelectAsset}
        onSelectWorkOrder={onSelectWorkOrder}
      />
    </div>
  );
};
