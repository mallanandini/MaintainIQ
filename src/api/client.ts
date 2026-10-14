import {
  Asset,
  Technician,
  MaintenanceType,
  WorkOrder,
  WorkOrderStatusHistory,
  CreateWorkOrderPayload,
  UpdateWorkOrderPayload,
  TransitionWorkOrderPayload,
  CreateAssetPayload,
  UpdateAssetPayload,
  AssetMaintenanceRecord,
  CreateTechnicianPayload,
  TechnicianRecommendation,
  DashboardStats,
  MaintenanceAnalytics,
  AssetHealthOverviewResponse,
  AssetHealthDetail,
  ChecklistTemplate,
  WorkOrderChecklist,
  WorkOrderChecklistItem,
  ChecklistItemStatus,
  OverdueWorkOrderReportItem,
  TechnicianWorkloadReportItem,
  BulkAssignTechnicianPayload,
  BulkAssignTechnicianResponse,
  DuplicateWorkOrderPayload,
  WorkOrderQueryParams,
  PagedWorkOrdersResponse
} from './types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const defaultHeaders: Record<string, string> = {};
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        if (typeof data.detail === 'string') {
          errorDetail = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorDetail = data.detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join(', ');
        }
      }
    } catch {
      // response was not JSON
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Work Orders
  getWorkOrders: (params?: WorkOrderQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.asset_id) searchParams.set('asset_id', String(params.asset_id));
    if (params?.technician_id) searchParams.set('technician_id', String(params.technician_id));
    if (params?.maintenance_type_id) searchParams.set('maintenance_type_id', String(params.maintenance_type_id));
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.scheduled_start_date) searchParams.set('scheduled_start_date', params.scheduled_start_date);
    if (params?.scheduled_end_date) searchParams.set('scheduled_end_date', params.scheduled_end_date);
    if (params?.is_overdue) searchParams.set('is_overdue', 'true');
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return request<WorkOrder[]>(`/work-orders${qs ? `?${qs}` : ''}`);
  },

  getWorkOrdersPaged: async (params?: WorkOrderQueryParams): Promise<PagedWorkOrdersResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.asset_id) searchParams.set('asset_id', String(params.asset_id));
    if (params?.technician_id) searchParams.set('technician_id', String(params.technician_id));
    if (params?.maintenance_type_id) searchParams.set('maintenance_type_id', String(params.maintenance_type_id));
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.scheduled_start_date) searchParams.set('scheduled_start_date', params.scheduled_start_date);
    if (params?.scheduled_end_date) searchParams.set('scheduled_end_date', params.scheduled_end_date);
    if (params?.is_overdue) searchParams.set('is_overdue', 'true');
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    const url = `${BASE_URL}/work-orders${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    const countHeader = response.headers.get('X-Total-Count');
    const items: WorkOrder[] = await response.json();
    const totalCount = countHeader ? parseInt(countHeader, 10) : items.length;
    return { items, totalCount };
  },

  getWorkOrdersExportUrl: (params?: WorkOrderQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.asset_id) searchParams.set('asset_id', String(params.asset_id));
    if (params?.technician_id) searchParams.set('technician_id', String(params.technician_id));
    if (params?.maintenance_type_id) searchParams.set('maintenance_type_id', String(params.maintenance_type_id));
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.scheduled_start_date) searchParams.set('scheduled_start_date', params.scheduled_start_date);
    if (params?.scheduled_end_date) searchParams.set('scheduled_end_date', params.scheduled_end_date);
    if (params?.is_overdue) searchParams.set('is_overdue', 'true');
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    const qs = searchParams.toString();
    return `${BASE_URL}/work-orders/export${qs ? `?${qs}` : ''}`;
  },

  bulkAssignTechnician: (payload: BulkAssignTechnicianPayload) =>
    request<BulkAssignTechnicianResponse>('/work-orders/bulk-assign-technician', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  duplicateWorkOrder: (id: number, payload?: DuplicateWorkOrderPayload) =>
    request<WorkOrder>(`/work-orders/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  getWorkOrder: (id: number) => request<WorkOrder>(`/work-orders/${id}`),

  createWorkOrder: (payload: CreateWorkOrderPayload) =>
    request<WorkOrder>('/work-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateWorkOrder: (id: number, payload: UpdateWorkOrderPayload) =>
    request<WorkOrder>(`/work-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  putWorkOrder: (id: number, payload: UpdateWorkOrderPayload) =>
    request<WorkOrder>(`/work-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  transitionWorkOrder: (id: number, payload: TransitionWorkOrderPayload) =>
    request<WorkOrder>(`/work-orders/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWorkOrderHistory: (id: number, params?: { order?: 'asc' | 'desc' }) => {
    const searchParams = new URLSearchParams();
    if (params?.order) searchParams.set('order', params.order);
    const qs = searchParams.toString();
    return request<WorkOrderStatusHistory[]>(`/work-orders/${id}/history${qs ? `?${qs}` : ''}`);
  },

  getWorkOrderTechnicianRecommendations: (id: number, limit = 3) =>
    request<TechnicianRecommendation[]>(`/work-orders/${id}/technician-recommendations?limit=${limit}`),

  // Assets
  getAssets: (params?: { q?: string; status?: string; category?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.category) searchParams.set('category', params.category);
    const qs = searchParams.toString();
    return request<Asset[]>(`/assets${qs ? `?${qs}` : ''}`);
  },

  getAsset: (id: number) => request<Asset>(`/assets/${id}`),

  getAssetMaintenanceHistory: (
    assetId: number,
    params?: {
      page?: number;
      page_size?: number;
      status?: string;
      priority?: string;
      start_date?: string;
      end_date?: string;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.page_size) searchParams.set('page_size', String(params.page_size));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const qs = searchParams.toString();
    return request<AssetMaintenanceRecord[]>(`/assets/${assetId}/maintenance-history${qs ? `?${qs}` : ''}`);
  },

  getAssetMaintenanceHistoryExportUrl: (
    assetId: number,
    params?: {
      status?: string;
      priority?: string;
      start_date?: string;
      end_date?: string;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const qs = searchParams.toString();
    return `${BASE_URL}/assets/${assetId}/maintenance-history/export${qs ? `?${qs}` : ''}`;
  },

  createAsset: (payload: CreateAssetPayload) =>
    request<Asset>('/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAsset: (id: number, payload: UpdateAssetPayload) =>
    request<Asset>(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getFleetAssetHealth: (params?: {
    category?: string;
    status?: string;
    risk_level?: string;
    needs_attention?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
    if (params?.needs_attention) searchParams.set('needs_attention', 'true');
    const qs = searchParams.toString();
    return request<AssetHealthOverviewResponse>(`/assets/health${qs ? `?${qs}` : ''}`);
  },

  getAssetHealth: (assetId: number) =>
    request<AssetHealthDetail>(`/assets/${assetId}/health`),

  // Technicians
  getTechnicians: (params?: { q?: string; status?: string; specialization?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.specialization) searchParams.set('specialization', params.specialization);
    const qs = searchParams.toString();
    return request<Technician[]>(`/technicians${qs ? `?${qs}` : ''}`);
  },

  getTechnician: (id: number) => request<Technician>(`/technicians/${id}`),

  createTechnician: (payload: CreateTechnicianPayload) =>
    request<Technician>('/technicians', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTechnician: (id: number, payload: Partial<Technician>) =>
    request<Technician>(`/technicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteTechnician: (id: number) =>
    request<{ success: boolean; message: string }>(`/technicians/${id}`, {
      method: 'DELETE',
    }),

  getTechnicianRecommendations: (params?: {
    asset_id?: number;
    priority?: string;
    maintenance_type_id?: number;
    title?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.asset_id) searchParams.set('asset_id', String(params.asset_id));
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.maintenance_type_id) searchParams.set('maintenance_type_id', String(params.maintenance_type_id));
    if (params?.title) searchParams.set('title', params.title);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return request<TechnicianRecommendation[]>(`/technicians/recommendations${qs ? `?${qs}` : ''}`);
  },

  // Maintenance Types
  getMaintenanceTypes: () => request<MaintenanceType[]>('/maintenance-types'),

  // Dashboard stats & analytics
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),
  getMaintenanceAnalytics: (params?: {
    top_assets_limit?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.top_assets_limit) searchParams.set('top_assets_limit', String(params.top_assets_limit));
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const qs = searchParams.toString();
    return request<MaintenanceAnalytics>(`/dashboard/analytics${qs ? `?${qs}` : ''}`);
  },

  // Overdue and Technician Workload Reports
  getOverdueWorkOrdersReport: () =>
    request<OverdueWorkOrderReportItem[]>('/dashboard/reports/overdue'),
  getOverdueReportExportUrl: () => `${BASE_URL}/dashboard/reports/overdue/export`,

  getTechnicianWorkloadReport: () =>
    request<TechnicianWorkloadReportItem[]>('/dashboard/reports/technician-workload'),
  getTechnicianWorkloadReportExportUrl: () => `${BASE_URL}/dashboard/reports/technician-workload/export`,

  // System Seeder (Restricted in production)
  seedDatabase: (adminKey?: string) =>
    request<{ message: string }>('/seed', {
      method: 'POST',
      headers: adminKey ? { 'X-Admin-Key': adminKey } : undefined,
    }),

  // Digital Inspection Checklists
  getChecklistTemplates: (params?: { asset_category?: string; maintenance_type_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.asset_category) searchParams.append('asset_category', params.asset_category);
    if (params?.maintenance_type_id) searchParams.append('maintenance_type_id', String(params.maintenance_type_id));
    const qs = searchParams.toString();
    return request<ChecklistTemplate[]>(`/checklists/templates${qs ? `?${qs}` : ''}`);
  },
  getChecklistTemplate: (id: number) => request<ChecklistTemplate>(`/checklists/templates/${id}`),
  createChecklistTemplate: (payload: {
    title: string;
    description?: string;
    asset_category?: string;
    maintenance_type_id?: number;
    items: Array<{ order_index?: number; item_text: string; description?: string; is_required?: boolean }>;
  }) =>
    request<ChecklistTemplate>('/checklists/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWorkOrderChecklist: (woId: number) =>
    request<WorkOrderChecklist | null>(`/work-orders/${woId}/checklist`),
  initializeWorkOrderChecklist: (woId: number, payload?: { template_id?: number; title?: string }) =>
    request<WorkOrderChecklist>(`/work-orders/${woId}/checklist`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  updateChecklistItem: (
    woId: number,
    itemId: number,
    payload: { status?: ChecklistItemStatus; notes?: string; inspected_by?: string }
  ) =>
    request<WorkOrderChecklistItem>(`/work-orders/${woId}/checklist/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  uploadChecklistAttachment: (woId: number, itemId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<WorkOrderChecklistItem>(`/work-orders/${woId}/checklist/items/${itemId}/attachment`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteChecklistAttachment: (woId: number, itemId: number) =>
    request<WorkOrderChecklistItem>(`/work-orders/${woId}/checklist/items/${itemId}/attachment`, {
      method: 'DELETE',
    }),
  getChecklistAttachmentUrl: (woId: number, itemId: number) =>
    `${BASE_URL}/work-orders/${woId}/checklist/items/${itemId}/attachment`,
  completeWorkOrderChecklist: (woId: number, payload?: { summary_notes?: string; completed_by?: string }) =>
    request<WorkOrderChecklist>(`/work-orders/${woId}/checklist/complete`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
};
