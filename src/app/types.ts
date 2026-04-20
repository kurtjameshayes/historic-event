export interface EventNode {
  id: string;
  date: string;
  timestamp: number;
  title: string;
  description: string;
  thread_id: string;
  sources: Source[];
  is_target?: boolean;
  subtopic_id?: string;
}

export interface CausalEdge {
  id: string;
  from_event_id: string;
  to_event_id: string;
  reasoning: string;
  confidence: number;
}

export interface Thread {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface Source {
  url: string;
  title: string;
  quality: 'primary' | 'secondary' | 'tertiary' | 'opinion';
  excerpt: string;
}

export interface Subtopic {
  id: string;
  thread_id: string;
  name: string;
  description: string;
  event_ids: string[];
  date_range: { start: string; end: string };
  order: number;
}

export interface DAGData {
  target_event: {
    name: string;
    date: string;
    description: string;
  };
  threads: Thread[];
  events: EventNode[];
  edges: CausalEdge[];
  subtopics: Subtopic[];
  narrative: string;
}

export interface ComparisonSimilarity {
  category: string;
  description: string;
  events_a: string[];
  events_b: string[];
}

export interface ComparisonDifference {
  category: string;
  description: string;
  side: 'a' | 'b' | 'both';
  detail: string;
}

export interface ComparisonAnalysis {
  similarities: ComparisonSimilarity[];
  differences: ComparisonDifference[];
  summary: string;
}

export interface ComparisonData {
  id: string;
  query_a: string;
  query_b: string;
  status: 'RESEARCHING' | 'COMPARING' | 'COMPLETE' | 'ERROR';
  session_id_a: string;
  session_id_b: string;
  analysis: ComparisonAnalysis | null;
  dag_a: DAGData | null;
  dag_b: DAGData | null;
  suggestions: { text: string; created_at: string }[];
  prompt_changes: { original: string; revised: string; reason: string; created_at: string }[];
}
