import {
  Asset,
  Technician,
  MaintenanceType,
  WorkOrder,
  CreateWorkOrderPayload,
  UpdateWorkOrderPayload,
  TransitionWorkOrderPayload,
  CreateAssetPayload,
  UpdateAssetPayload,
  CreateTechnicianPayload,
  DashboardStats
} from './types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
  getWorkOrders: (params?: {
    q?: string;
    status?: string;
    priority?: string;
    asset_id?: number;
    technician_id?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.asset_id) searchParams.set('asset_id', String(params.asset_id));
    if (params?.technician_id) searchParams.set('technician_id', String(params.technician_id));
    const qs = searchParams.toString();
    return request<WorkOrder[]>(`/work-orders${qs ? `?${qs}` : ''}`);
  },

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

  transitionWorkOrder: (id: number, payload: TransitionWorkOrderPayload) =>
    request<WorkOrder>(`/work-orders/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

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

  // Maintenance Types
  getMaintenanceTypes: () => request<MaintenanceType[]>('/maintenance-types'),

  // Dashboard stats
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Demo Seeder
  seedDatabase: () =>
    request<{ message: string }>('/seed', {
      method: 'POST',
    }),
};
