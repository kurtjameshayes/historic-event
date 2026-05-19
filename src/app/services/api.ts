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

export interface ParsedAttachment {
  text: string;
  name: string;
  type: 'pdf' | 'docx' | 'image' | 'url';
}

export function parseAttachment(formData: FormData): Promise<ParsedAttachment> {
  return fetch(`${BASE_URL}/api/parse-attachment`, {
    method: 'POST',
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  });
}

export function parseUrl(url: string): Promise<ParsedAttachment> {
  return request('/api/parse-attachment', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
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
  attachment_context?: string;
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

export interface EventDetailResponse {
  detail: string;
  cached: boolean;
}

export function getEventDetail(sessionId: string, eventId: string): Promise<EventDetailResponse> {
  return request<EventDetailResponse>(`/api/sessions/${sessionId}/events/${eventId}/detail`);
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

// --------------- Comparisons ---------------

export interface CreateComparisonResponse {
  comparison_id: string;
  session_id_a: string;
  session_id_b: string;
}

export interface ComparisonConfig {
  max_depth: number;
  max_cycles: number;
  max_sources_per_thread: number;
  max_threads?: number;
  attachment_context_a?: string;
  attachment_context_b?: string;
}

export function createComparison(
  query_a: string,
  query_b: string,
  config: ComparisonConfig,
): Promise<CreateComparisonResponse> {
  return request('/api/comparisons', {
    method: 'POST',
    body: JSON.stringify({ query_a, query_b, ...config }),
  });
}

export function getComparison(comparisonId: string) {
  return request<any>(`/api/comparisons/${comparisonId}`);
}

export function listComparisons(): Promise<any[]> {
  return request<any[]>('/api/comparisons');
}

export function addComparisonSuggestion(comparisonId: string, text: string) {
  return request<{ status: string }>(`/api/comparisons/${comparisonId}/suggestions`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function addComparisonPromptChange(
  comparisonId: string,
  original: string,
  revised: string,
  reason: string,
) {
  return request<{ status: string }>(`/api/comparisons/${comparisonId}/prompt-changes`, {
    method: 'POST',
    body: JSON.stringify({ original, revised, reason }),
  });
}
