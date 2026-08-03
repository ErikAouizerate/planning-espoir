import type { Config, Person, ParsingWarning, ScheduleMonth } from '@planning-espoir/shared';

export interface PlanningResponse {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function fetchPlanning(): Promise<PlanningResponse> {
  return request<PlanningResponse>('/api/planning');
}

export function uploadPlanning(file: File): Promise<PlanningResponse> {
  const form = new FormData();
  form.append('file', file);
  return request<PlanningResponse>('/api/planning', { method: 'POST', body: form });
}

export function fetchSchedule(month: string): Promise<ScheduleMonth> {
  return request<ScheduleMonth>(`/api/planning/schedule?month=${month}`);
}

export function fetchConfig(): Promise<Config> {
  return request<Config>('/api/planning/config');
}

export function updateConfig(update: Partial<Config>): Promise<Config> {
  return request<Config>('/api/planning/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}
