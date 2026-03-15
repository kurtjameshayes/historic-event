const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface CreateSessionResponse {
  session_id: string;
  query_id: string;
}

export interface SessionSummary {
  id: string;
  query_id: string;
  query: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  config: { max_depth: number; max_cycles: number; max_sources_per_thread?: number };
}

export interface SessionConfig {
  max_depth: number;
  max_cycles: number;
  max_sources_per_thread: number;
  focus_threads: string[];
  max_threads?: number;
}

export function createSession(query: string, config: SessionConfig): Promise<CreateSessionResponse> {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ query, ...config }),
  });
}

export function getSession(sessionId: string) {
  return request<any>(`/api/sessions/${sessionId}`);
}

export function getTimeline(sessionId: string) {
  return request<any>(`/api/sessions/${sessionId}/timeline`);
}

export function getNarrative(sessionId: string): Promise<{ narrative: string }> {
  return request(`/api/sessions/${sessionId}/narrative`);
}

export function deepenThread(sessionId: string, threadId: string) {
  return request<any>(`/api/sessions/${sessionId}/deepen`, {
    method: 'POST',
    body: JSON.stringify({ thread_id: threadId }),
  });
}

export function listSessions(search?: string): Promise<SessionSummary[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<SessionSummary[]>(`/api/sessions${params}`);
}

export function restartSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return request(`/api/sessions/${sessionId}/restart`, { method: 'POST' });
}
