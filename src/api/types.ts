export type WorkOrderStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssetStatus = 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'DECOMMISSIONED';
export type TechnicianStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';

export interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  category: string;
  location: string;
  status: AssetStatus;
  serial_number?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  work_orders_count?: number;
  active_work_orders_count?: number;
}

export interface Technician {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  phone?: string | null;
  specialization: string;
  status: TechnicianStatus;
  hourly_rate?: number | null;
  created_at: string;
  updated_at: string;
  assigned_work_orders_count?: number;
  active_work_orders_count?: number;
}

export interface MaintenanceType {
  id: number;
  code: 'PREVENTATIVE' | 'CORRECTIVE' | 'EMERGENCY' | 'INSPECTION' | 'CALIBRATION';
  name: string;
  description?: string | null;
  is_emergency: boolean;
}

export interface WorkOrderStatusHistory {
  id: number;
  work_order_id: number;
  from_status?: WorkOrderStatus | null;
  to_status: WorkOrderStatus;
  changed_by: string;
  notes?: string | null;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  work_order_number: string;
  title: string;
  description: string;
  asset_id: number;
  maintenance_type_id: number;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_technician_id?: number | null;
  scheduled_date: string;
  estimated_hours: number;
  actual_hours?: number | null;
  resolution_summary?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  asset?: Asset;
  technician?: Technician | null;
  maintenance_type?: MaintenanceType;
  status_history?: WorkOrderStatusHistory[];
}

export interface CreateWorkOrderPayload {
  title: string;
  description: string;
  asset_id: number;
  maintenance_type_id: number;
  priority: WorkOrderPriority;
  assigned_technician_id?: number | null;
  scheduled_date: string;
  estimated_hours: number;
}

export interface UpdateWorkOrderPayload {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  assigned_technician_id?: number | null;
  scheduled_date?: string;
  estimated_hours?: number;
  actual_hours?: number | null;
  resolution_summary?: string | null;
}

export interface TransitionWorkOrderPayload {
  to_status: WorkOrderStatus;
  changed_by?: string;
  notes?: string;
  actual_hours?: number | null;
  resolution_summary?: string | null;
  cancellation_reason?: string | null;
}

export interface CreateAssetPayload {
  asset_tag: string;
  name: string;
  category: string;
  location: string;
  status?: AssetStatus;
  serial_number?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes?: string | null;
}

export interface UpdateAssetPayload {
  name?: string;
  category?: string;
  location?: string;
  status?: AssetStatus;
  serial_number?: string | null;
  manufacturer?: string | null;
  model_number?: string | null;
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes?: string | null;
}

export interface CreateTechnicianPayload {
  employee_id: string;
  name: string;
  email: string;
  phone?: string | null;
  specialization: string;
  status?: TechnicianStatus;
  hourly_rate?: number | null;
}

export interface DashboardStats {
  work_orders: {
    total: number;
    open: number;
    assigned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    active: number;
    critical_active: number;
    high_active: number;
    overdue: number;
  };
  assets: {
    total: number;
    operational: number;
    under_maintenance: number;
    out_of_service: number;
  };
  technicians: {
    total: number;
    active: number;
  };
}
