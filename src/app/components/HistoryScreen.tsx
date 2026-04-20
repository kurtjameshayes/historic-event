import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Inbox,
  RotateCcw,
  PauseCircle,
  GitCompareArrows,
  Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  listSessions,
  getTimeline,
  restartSession,
  listComparisons,
  getComparison,
  type SessionSummary,
} from '../services/api';
import type { DAGData, ComparisonData } from '../types';

type HistoryTab = 'investigations' | 'comparisons';

interface ComparisonSummary {
  id: string;
  query_a: string;
  query_b: string;
  status: string;
  session_id_a: string;
  session_id_b: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

interface HistoryScreenProps {
  onLoadResults: (sessionId: string, data: DAGData) => void;
  onResumeSession: (sessionId: string, query: string) => void;
  onLoadComparison?: (data: ComparisonData) => void;
}

const MAX_QUERY_DISPLAY = 400;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function truncateQuery(query: string): string {
  if (query.length <= MAX_QUERY_DISPLAY) return query;
  return query.slice(0, MAX_QUERY_DISPLAY) + '...';
}

function isTerminal(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'COMPLETE' || s === 'ERROR';
}

function isStale(session: SessionSummary): boolean {
  if (isTerminal(session.status)) return false;
  const ref = session.updated_at || session.created_at;
  if (!ref) return true;
  return Date.now() - new Date(ref).getTime() > STALE_THRESHOLD_MS;
}

function StatusBadge({ status, stale }: { status: string; stale: boolean }) {
  const upper = status.toUpperCase();
  if (upper === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Complete
      </span>
    );
  }
  if (upper === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle className="w-3 h-3" />
        Error
      </span>
    );
  }
  if (stale) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">
        <PauseCircle className="w-3 h-3" />
        Stalled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Loader2 className="w-3 h-3 animate-spin" />
      {status}
    </span>
  );
}

export function HistoryScreen({ onLoadResults, onResumeSession, onLoadComparison }: HistoryScreenProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('investigations');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions(search || undefined);
      setSessions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComparisons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listComparisons();
      setComparisons(data as ComparisonSummary[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load comparisons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'investigations') {
      fetchSessions();
    } else {
      fetchComparisons();
    }
  }, [activeTab, fetchSessions, fetchComparisons]);

  useEffect(() => {
    if (activeTab !== 'investigations') return;
    const timer = setTimeout(() => {
      fetchSessions(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, fetchSessions]);

  const handleClick = async (session: SessionSummary) => {
    const stale = isStale(session);
    const terminal = isTerminal(session.status);

    if (stale) return;

    if (!terminal) {
      onResumeSession(session.id, session.query);
      return;
    }

    setLoadingId(session.id);
    try {
      const data = await getTimeline(session.id);
      onLoadResults(session.id, data as DAGData);
    } catch (err: any) {
      setError(`Failed to load results: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleComparisonClick = async (comp: ComparisonSummary) => {
    if (!onLoadComparison) return;
    const upper = comp.status.toUpperCase();
    if (upper !== 'COMPLETE') return;

    setLoadingId(comp.id);
    try {
      const data = await getComparison(comp.id);
      onLoadComparison(data as ComparisonData);
    } catch (err: any) {
      setError(`Failed to load comparison: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRestart = async (e: React.MouseEvent, session: SessionSummary) => {
    e.stopPropagation();
    setRestartingId(session.id);
    setError(null);
    try {
      await restartSession(session.id);
      onResumeSession(session.id, session.query);
    } catch (err: any) {
      setError(`Failed to restart: ${err.message}`);
      setRestartingId(null);
    }
  };

  const tabClass = (tab: HistoryTab) =>
    activeTab === tab
      ? 'bg-white text-indigo-700 shadow-sm border-indigo-200'
      : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border-transparent';

  return (
    <div className="h-full bg-slate-50 font-sans overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Results History</h1>
          <p className="text-sm text-slate-500">
            Browse and revisit prior research investigations and comparisons.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex bg-slate-100 rounded-lg p-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('investigations')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md border transition-colors ${tabClass('investigations')}`}
            >
              <Layers className="w-3.5 h-3.5" />
              Investigations
            </button>
            <button
              onClick={() => setActiveTab('comparisons')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md border transition-colors ${tabClass('comparisons')}`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              Comparisons
            </button>
          </div>
        </div>

        {activeTab === 'investigations' && (
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search investigations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200/50 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Investigations Tab */}
        {activeTab === 'investigations' && (
          <>
            {loading && sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading investigations...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Inbox className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium">No investigations found</p>
                <p className="text-xs mt-1">Start a new query to begin researching.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const stale = isStale(session);
                  const terminal = isTerminal(session.status);
                  const showRestart = stale || session.status.toUpperCase() === 'ERROR';

                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          onClick={() => handleClick(session)}
                          disabled={loadingId === session.id || stale}
                          className="flex-1 min-w-0 text-left disabled:cursor-default"
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <StatusBadge status={session.status} stale={stale} />
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 leading-relaxed">
                            {truncateQuery(session.query)}
                          </p>
                          {session.config && (
                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                              <span>Depth: {session.config.max_depth}</span>
                              <span>Cycles: {session.config.max_cycles}</span>
                              {session.config.max_sources_per_thread && <span>Sources: {session.config.max_sources_per_thread}</span>}
                            </div>
                          )}
                        </button>
                        <div className="flex-shrink-0 mt-1 flex items-center gap-2">
                          {showRestart && (
                            <button
                              onClick={(e) => handleRestart(e, session)}
                              disabled={restartingId === session.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                              title="Restart this investigation"
                            >
                              {restartingId === session.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              Restart
                            </button>
                          )}
                          {terminal && !showRestart && (
                            loadingId === session.id ? (
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Comparisons Tab */}
        {activeTab === 'comparisons' && (
          <>
            {loading && comparisons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading comparisons...</p>
              </div>
            ) : comparisons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <GitCompareArrows className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium">No comparisons found</p>
                <p className="text-xs mt-1">Use the Compare feature to compare two historical timelines.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comparisons.map((comp) => {
                  const upper = comp.status.toUpperCase();
                  const isComplete = upper === 'COMPLETE';
                  const isError = upper === 'ERROR';

                  return (
                    <motion.div
                      key={comp.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                    >
                      <button
                        onClick={() => handleComparisonClick(comp)}
                        disabled={loadingId === comp.id || !isComplete}
                        className="w-full text-left disabled:cursor-default"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-3">
                              <ComparisonStatusBadge status={comp.status} />
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(comp.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="bg-indigo-50/60 rounded-lg p-3 border border-indigo-100">
                                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Timeline A</div>
                                <p className="text-sm font-medium text-slate-800 line-clamp-2">{comp.query_a}</p>
                              </div>
                              <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-100">
                                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Timeline B</div>
                                <p className="text-sm font-medium text-slate-800 line-clamp-2">{comp.query_b}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 mt-1">
                            {loadingId === comp.id ? (
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            ) : isComplete ? (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ComparisonStatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  if (upper === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Complete
      </span>
    );
  }
  if (upper === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle className="w-3 h-3" />
        Error
      </span>
    );
  }
  if (upper === 'COMPARING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
        <GitCompareArrows className="w-3 h-3 animate-pulse" />
        Comparing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Loader2 className="w-3 h-3 animate-spin" />
      Researching
    </span>
  );
}
