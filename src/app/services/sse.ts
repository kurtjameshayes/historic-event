const BASE_URL = import.meta.env.VITE_API_URL || '';

export interface PhaseChangePayload {
  phase: string;
  cycle: number;
  message: string;
}

export interface ThreadUpdatePayload {
  thread_id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  events_found: number;
  message: string;
}

export interface ReasoningPayload {
  agent: string;
  message: string;
  type: 'phase' | 'info' | 'success' | 'warning';
}

export interface CritiquePayload {
  overall_score: number;
  gap_count: number;
  recommendation_count: number;
}

export interface CompletePayload {
  session_id: string;
  event_count: number;
  edge_count: number;
  final_score: number;
}

export interface ErrorPayload {
  message: string;
  recoverable: boolean;
}

export interface SSECallbacks {
  onPhaseChange?: (data: PhaseChangePayload) => void;
  onThreadUpdate?: (data: ThreadUpdatePayload) => void;
  onReasoning?: (data: ReasoningPayload) => void;
  onCritique?: (data: CritiquePayload) => void;
  onComplete?: (data: CompletePayload) => void;
  onError?: (data: ErrorPayload) => void;
}

export function connectSSE(sessionId: string, callbacks: SSECallbacks): () => void {
  const url = `${BASE_URL}/api/sessions/${sessionId}/stream`;
  const source = new EventSource(url);

  source.addEventListener('phase_change', (e) => {
    callbacks.onPhaseChange?.(JSON.parse(e.data));
  });

  source.addEventListener('thread_update', (e) => {
    callbacks.onThreadUpdate?.(JSON.parse(e.data));
  });

  source.addEventListener('reasoning', (e) => {
    callbacks.onReasoning?.(JSON.parse(e.data));
  });

  source.addEventListener('critique', (e) => {
    callbacks.onCritique?.(JSON.parse(e.data));
  });

  source.addEventListener('complete', (e) => {
    callbacks.onComplete?.(JSON.parse(e.data));
    source.close();
  });

  source.addEventListener('error', (e: Event) => {
    if ('data' in e) {
      try {
        callbacks.onError?.(JSON.parse((e as MessageEvent).data));
      } catch {
        callbacks.onError?.({ message: 'SSE connection lost', recoverable: true });
      }
    }
  });

  source.onerror = () => {
    callbacks.onError?.({ message: 'SSE connection lost', recoverable: true });
  };

  return () => source.close();
}
