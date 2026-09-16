import type { Config, Person, ParsingWarning, ScheduleMonth } from '@planning-espoir/shared';
import { authConfig } from '../auth/config';
import { keycloak } from '../auth/keycloak';

export interface PlanningResponse {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

export function getAuthToken(): string | null {
  return keycloak.getToken();
}

// Absolute API origin when the API is served on its own domain (e.g. local dev
// behind the Caddy proxy). `||` (not `??`) so an empty string falls back to the
// relative, same-origin `/api` used in production behind nginx.
const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';

function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

let redirecting = false;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && keycloak.isEnabled() && !redirecting) {
    redirecting = true;
    keycloak.login();
  }
  if (res.status === 403 && keycloak.isEnabled() && !redirecting) {
    redirecting = true;
    window.location.assign(authConfig.gatewayUrl);
  }
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

export function fetchAuthMe(): Promise<{ username: string }> {
  return request<{ username: string }>(apiUrl('/auth/me'));
}

export function fetchPlanning(): Promise<PlanningResponse> {
  return request<PlanningResponse>(apiUrl('/planning'));
}

export function uploadPlanning(file: File): Promise<PlanningResponse> {
  const form = new FormData();
  form.append('file', file);
  return request<PlanningResponse>(apiUrl('/planning'), { method: 'POST', body: form });
}

export function fetchSchedule(month: string): Promise<ScheduleMonth> {
  return request<ScheduleMonth>(apiUrl(`/planning/schedule?month=${month}`));
}

export function fetchConfig(): Promise<Config> {
  return request<Config>(apiUrl('/planning/config'));
}

export function updateConfig(update: Partial<Config>): Promise<Config> {
  return request<Config>(apiUrl('/planning/config'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}
