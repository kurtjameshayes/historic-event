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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  listSessions,
  getTimeline,
  restartSession,
  type SessionSummary,
} from '../services/api';
import type { DAGData } from '../types';

interface HistoryScreenProps {
  onLoadResults: (sessionId: string, data: DAGData) => void;
  onResumeSession: (sessionId: string, query: string) => void;
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

export function HistoryScreen({ onLoadResults, onResumeSession }: HistoryScreenProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
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

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSessions(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchSessions]);

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

  return (
    <div className="h-full bg-slate-50 font-sans overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Investigation History</h1>
          <p className="text-sm text-slate-500">
            Browse and revisit prior research investigations.
          </p>
        </div>

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

        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200/50 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

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
      </div>
    </div>
  );
}
