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
  operating_hours?: number | null;
  operating_cycles?: number | null;
  service_threshold_hours?: number | null;
  service_threshold_cycles?: number | null;
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
  previous_status?: WorkOrderStatus | null;
  new_status?: WorkOrderStatus;
  changed_by?: string | null;
  actor_id?: string | null;
  notes?: string | null;
  created_at: string;
  changed_at?: string;
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

export interface AssetMaintenanceRecord {
  id: number;
  work_order_number: string;
  title: string;
  description: string;
  maintenance_type_id: number;
  maintenance_type?: MaintenanceType | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_technician_id?: number | null;
  technician?: Technician | null;
  scheduled_date: string;
  created_date: string;
  created_at: string;
  completed_date?: string | null;
  actual_hours?: number | null;
  estimated_hours?: number | null;
  resolution_summary?: string | null;
  cancellation_reason?: string | null;
  has_checklist?: boolean;
  checklist_status?: string | null;
  checklist_summary?: string | null;
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

export interface BulkAssignTechnicianPayload {
  work_order_ids: number[];
  technician_id: number;
}

export interface BulkOperationResultItem {
  work_order_id: number;
  work_order_number?: string | null;
  success: boolean;
  error?: string | null;
}

export interface BulkAssignTechnicianResponse {
  total_requested: number;
  success_count: number;
  failure_count: number;
  results: BulkOperationResultItem[];
}

export interface DuplicateWorkOrderPayload {
  title?: string;
  description?: string;
  scheduled_date?: string;
  priority?: WorkOrderPriority;
  assigned_technician_id?: number | null;
  estimated_hours?: number;
}

export interface WorkOrderQueryParams {
  q?: string;
  status?: string;
  priority?: string;
  asset_id?: number;
  technician_id?: number;
  maintenance_type_id?: number;
  start_date?: string;
  end_date?: string;
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  is_overdue?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface PagedWorkOrdersResponse {
  items: WorkOrder[];
  totalCount: number;
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

export interface TechnicianRecommendation {
  technician_id: number;
  name: string;
  employee_id: string;
  specialization: string;
  status: string;
  hourly_rate?: number | null;
  active_work_orders_count: number;
  active_estimated_hours: number;
  skill_score: number;
  availability_score: number;
  priority_score: number;
  composite_score: number;
  skill_match_level: 'DIRECT' | 'COMPATIBLE' | 'GENERAL' | 'NONE';
  explanation: string;
}

export interface StatusDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface PriorityDistributionItem {
  priority: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface MonthlyCompletionItem {
  month_key: string;
  label: string;
  year: number;
  month: number;
  completed_count: number;
}

export interface TechnicianWorkloadItem {
  technician_id: number;
  name: string;
  employee_id: string;
  specialization: string;
  status: string;
  active_work_orders_count: number;
  completed_work_orders_count: number;
  total_assigned_count: number;
  active_estimated_hours: number;
}

export interface FrequentlyMaintainedAssetItem {
  asset_id: number;
  asset_tag: string;
  name: string;
  category: string;
  criticality: string;
  total_work_orders: number;
  completed_work_orders: number;
  active_work_orders: number;
}

export interface OverdueMetrics {
  overdue_count: number;
  critical_overdue_count: number;
  high_overdue_count: number;
  rule_description: string;
}

export interface CancellationReasonBreakdown {
  reason: string;
  count: number;
}

export interface AnalyticsSummary {
  total_work_orders: number;
  active_work_orders: number;
  completed_work_orders: number;
  cancelled_work_orders: number;
  overdue_work_orders: number;
  completion_rate_percentage: number;
  cancellation_rate_percentage?: number;
  avg_completion_time_hours?: number | null;
  cancellation_reasons_breakdown?: CancellationReasonBreakdown[];
  total_assets: number;
  total_technicians: number;
  active_technicians: number;
  date_range_start?: string | null;
  date_range_end?: string | null;
}

export interface OverdueWorkOrderReportItem {
  id: number;
  work_order_number: string;
  title: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  asset_id: number;
  asset_tag?: string | null;
  asset_name?: string | null;
  location?: string | null;
  assigned_technician_id?: number | null;
  technician_name?: string | null;
  scheduled_date: string;
  days_overdue: number;
  estimated_hours: number;
}

export interface TechnicianWorkloadReportItem {
  technician_id: number;
  employee_id: string;
  name: string;
  specialization: string;
  status: string;
  active_work_orders_count: number;
  active_estimated_hours: number;
  completed_work_orders_count: number;
  total_assigned_count: number;
  utilization_status: 'AVAILABLE' | 'OPTIMAL' | 'HEAVY' | 'OVERLOADED';
  active_work_orders?: Array<{
    id: number;
    work_order_number: string;
    title: string;
    priority: string;
    status: string;
    scheduled_date: string;
    estimated_hours: number;
  }>;
}

export interface MaintenanceAnalytics {
  summary: AnalyticsSummary;
  status_distribution: StatusDistributionItem[];
  priority_distribution: PriorityDistributionItem[];
  monthly_completion_trend: MonthlyCompletionItem[];
  technician_workloads: TechnicianWorkloadItem[];
  frequently_maintained_assets: FrequentlyMaintainedAssetItem[];
  overdue_metrics: OverdueMetrics;
}

// Asset Health & Risk Assessment
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'INSUFFICIENT_DATA';

export interface RiskFactorDetail {
  category: string;
  title: string;
  impact_points: number;
  max_points: number;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface AssetUsageHealthMetrics {
  operating_hours?: number | null;
  service_threshold_hours?: number | null;
  hours_utilization_pct?: number | null;
  operating_cycles?: number | null;
  service_threshold_cycles?: number | null;
  cycles_utilization_pct?: number | null;
  threshold_exceeded: boolean;
}

export interface AssetMaintenanceHealthMetrics {
  open_work_orders_count: number;
  critical_open_count: number;
  high_open_count: number;
  overdue_work_orders_count: number;
  recent_corrective_count: number;
  total_maintenance_records: number;
  last_maintenance_date?: string | null;
}

export interface AssetHealthDetail {
  asset_id: number;
  asset_tag: string;
  name: string;
  category: string;
  location: string;
  status: string;
  criticality: string;
  risk_score?: number | null;
  risk_level: RiskLevel;
  has_sufficient_data: boolean;
  status_label: string;
  summary_explanation: string;
  contributing_factors: RiskFactorDetail[];
  usage_metrics: AssetUsageHealthMetrics;
  maintenance_metrics: AssetMaintenanceHealthMetrics;
  needs_maintenance_attention: boolean;
  disclaimer: string;
}

export interface AssetHealthOverviewSummary {
  total_assets: number;
  total_assessed: number;
  insufficient_data_count: number;
  critical_risk_count: number;
  high_risk_count: number;
  moderate_risk_count: number;
  low_risk_count: number;
  attention_required_count: number;
}

export interface AssetHealthOverviewResponse {
  summary: AssetHealthOverviewSummary;
  formula_documentation: string;
  disclaimer: string;
  items: AssetHealthDetail[];
}

export type ChecklistItemStatus = 'PENDING' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export interface ChecklistTemplateItem {
  id: number;
  template_id: number;
  order_index: number;
  item_text: string;
  description?: string | null;
  is_required: boolean;
}

export interface ChecklistTemplate {
  id: number;
  title: string;
  description?: string | null;
  asset_category?: string | null;
  maintenance_type_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items: ChecklistTemplateItem[];
}

export interface WorkOrderChecklistItem {
  id: number;
  checklist_id: number;
  order_index: number;
  item_text: string;
  description?: string | null;
  is_required: boolean;
  status: ChecklistItemStatus;
  notes?: string | null;
  inspected_at?: string | null;
  inspected_by?: string | null;
  attachment_filename?: string | null;
  attachment_content_type?: string | null;
  attachment_file_size?: number | null;
  has_attachment: boolean;
}

export interface WorkOrderChecklist {
  id: number;
  work_order_id: number;
  template_id?: number | null;
  title: string;
  summary_notes?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
  updated_at: string;
  total_items: number;
  passed_items: number;
  failed_items: number;
  na_items: number;
  pending_items: number;
  completion_percentage: number;
  has_failed_items: boolean;
  can_complete: boolean;
  incomplete_required_count: number;
  items: WorkOrderChecklistItem[];
}

