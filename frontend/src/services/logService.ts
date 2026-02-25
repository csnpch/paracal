import { apiClient } from './api';

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLEAR' | 'LOGIN' | 'CHANGE_PIN';
export type LogEntity = 'event' | 'employee' | 'company_holiday' | 'cronjob' | 'admin';

export interface ActivityLog {
  id: number;
  action: LogAction;
  entity: LogEntity;
  entityId: number | null;
  entityName: string | null;
  detail: string | null;
  createdAt: string;
}

export interface LogsResponse {
  total: number;
  logs: ActivityLog[];
}

export const getLogs = async (params?: {
  entity?: LogEntity;
  action?: LogAction;
  limit?: number;
  offset?: number;
}): Promise<LogsResponse> => {
  const query = new URLSearchParams();
  if (params?.entity) query.append('entity', params.entity);
  if (params?.action) query.append('action', params.action);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));
  const qs = query.toString();
  return apiClient.get<LogsResponse>(`/logs${qs ? `?${qs}` : ''}`);
};

export const clearAllLogs = async (password: string): Promise<{ deletedCount: number }> => {
  return apiClient.delete<{ deletedCount: number }>('/logs/clear', { password });
};

export const deleteOldLogs = async (password: string, days: number = 10): Promise<{ deletedCount: number }> => {
  return apiClient.delete<{ deletedCount: number }>('/logs/old', { password, days });
};
