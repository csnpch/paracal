import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      data?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await axios({
      url,
      method: options.method || "GET",
      data: options.data,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    return response.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      data,
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      data,
    });
  }

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      data,
    });
  }
}

export const apiClient = new ApiClient();

export interface DashboardSummary {
  monthlyStats: {
    totalEvents: number;
    totalEmployees: number;
    totalBusinessDays: number;
    mostCommonType: string;
  };
  employeeRanking: Array<{
    name: string;
    totalEvents: number;
    totalBusinessDays: number;
    eventTypes: { [key: string]: number };
  }>;
}

export const getDashboardSummary = async (params?: {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  includeFutureEvents?: boolean;
}): Promise<DashboardSummary> => {
  const queryParams = new URLSearchParams();

  if (params?.startDate) queryParams.append("startDate", params.startDate);
  if (params?.endDate) queryParams.append("endDate", params.endDate);
  if (params?.eventType) queryParams.append("eventType", params.eventType);
  if (params?.includeFutureEvents !== undefined) {
    queryParams.append(
      "includeFutureEvents",
      String(params.includeFutureEvents)
    );
  }

  const query = queryParams.toString();
  const endpoint = `/events/dashboard/summary${query ? `?${query}` : ""}`;

  return apiClient.get<DashboardSummary>(endpoint);
};

export interface EmployeeEvent {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  date: string;
  startDate: string;
  endDate: string;
  description?: string;
  businessDays?: number;
  createdAt: string;
  updatedAt: string;
}

export const getEventsByEmployee = async (params: {
  employeeName: string;
  startDate?: string;
  endDate?: string;
}): Promise<EmployeeEvent[]> => {
  const queryParams = new URLSearchParams();

  queryParams.append("employeeName", params.employeeName);
  if (params.startDate) queryParams.append("startDate", params.startDate);
  if (params.endDate) queryParams.append("endDate", params.endDate);

  const query = queryParams.toString();
  const endpoint = `/events/employee?${query}`;

  return apiClient.get<EmployeeEvent[]>(endpoint);
};

export interface CronjobConfig {
  id: number;
  name: string;
  enabled: boolean;
  schedule_time: string;
  webhook_url: string;
  notification_days: number;
  notification_type?: "daily" | "weekly";
  weekly_days?: number[];
  weekly_scope?: "current" | "next";
  created_at: string;
  updated_at: string;
}

export interface CronjobStatus {
  id: number;
  name: string;
  enabled: boolean;
  schedule_time: string;
  running: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const getCronjobConfigs = async (): Promise<
  ApiResponse<CronjobConfig[]>
> => {
  return apiClient.get<ApiResponse<CronjobConfig[]>>("/cronjobs");
};

export const getCronjobStatus = async (): Promise<
  ApiResponse<CronjobStatus[]>
> => {
  return apiClient.get<ApiResponse<CronjobStatus[]>>("/cronjobs/status");
};

export const getCronjobConfig = async (
  id: number
): Promise<ApiResponse<CronjobConfig>> => {
  return apiClient.get<ApiResponse<CronjobConfig>>(`/cronjobs/${id}`);
};

export const createCronjobConfig = async (
  config: Omit<CronjobConfig, "id" | "created_at" | "updated_at">
): Promise<ApiResponse<CronjobConfig>> => {
  return apiClient.post<ApiResponse<CronjobConfig>>("/cronjobs", config);
};

export const updateCronjobConfig = async (
  id: number,
  config: Partial<Omit<CronjobConfig, "id" | "created_at" | "updated_at">>
): Promise<ApiResponse<CronjobConfig>> => {
  return apiClient.put<ApiResponse<CronjobConfig>>(`/cronjobs/${id}`, config);
};

export const deleteCronjobConfig = async (
  id: number
): Promise<ApiResponse<null>> => {
  return apiClient.delete<ApiResponse<null>>(`/cronjobs/${id}`);
};

export const testCronjobNotification = async (
  id: number,
  customMessage?: string
): Promise<ApiResponse<null>> => {
  return apiClient.post<ApiResponse<null>>(`/cronjobs/${id}/test`, { customMessage });
};
