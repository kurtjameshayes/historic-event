import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, FileText, Search, Activity, CheckCircle, Clock, ServerCog, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { connectSSE } from '../services/sse';
import { getTimeline } from '../services/api';
import type { DAGData } from '../types';
import type { ThreadUpdatePayload, ReasoningPayload } from '../services/sse';

interface StatusScreenProps {
  query: string;
  sessionId: string;
  onComplete: (data: DAGData) => void;
}

interface TraceEntry {
  agent: string;
  type: string;
  msg: string;
}

interface ThreadInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  events_found: number;
}

const PHASES = ['Planning', 'Researching', 'Evaluating', 'Adapting', 'Finalizing'];

function phaseToIndex(phase: string): number {
  const map: Record<string, number> = {
    PLAN: 0, Planning: 0,
    RESEARCH: 1, Researching: 1,
    EVALUATE: 2, Evaluating: 2,
    ADAPT: 3, Adapting: 3,
    RENDER: 4, Finalizing: 4,
  };
  return map[phase] ?? 0;
}

export function StatusScreen({ query, sessionId, onComplete }: StatusScreenProps) {
  const [log, setLog] = useState<TraceEntry[]>([]);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  const handleComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    try {
      const data = await getTimeline(sessionId);
      onComplete(data as DAGData);
    } catch {
      onComplete({
        target_event: { name: 'Unknown', date: '', description: '' },
        threads: [],
        events: [],
        edges: [],
        subtopics: [],
        narrative: 'Failed to load results.',
      });
    }
  }, [sessionId, onComplete]);

  useEffect(() => {
    const localTimeouts: ReturnType<typeof setTimeout>[] = [];

    const disconnect = connectSSE(sessionId, {
      onPhaseChange(data) {
        setCurrentPhaseIdx(phaseToIndex(data.phase));
        setCycle(data.cycle);
      },
      onThreadUpdate(data: ThreadUpdatePayload) {
        setThreads(prev => {
          const existing = prev.find(t => t.id === data.thread_id);
          if (existing) {
            return prev.map(t => t.id === data.thread_id ? { ...t, ...data, id: data.thread_id } : t);
          }
          return [...prev, { id: data.thread_id, name: data.name, description: data.description, color: data.color, status: data.status, events_found: data.events_found }];
        });
        if (data.events_found > 0) {
          setSourcesCount(prev => prev + data.events_found);
        }
      },
      onReasoning(data: ReasoningPayload) {
        setLog(prev => [...prev, { agent: data.agent, type: data.type, msg: data.message }]);

        if (data.message.match(/Found \d+ relevant/)) {
          const match = data.message.match(/Found (\d+)/);
          if (match) setSourcesCount(prev => prev + parseInt(match[1], 10));
        }
      },
      onCritique() {},
      onComplete() {
        const t = setTimeout(handleComplete, 500);
        localTimeouts.push(t);
        timeoutRefs.current.push(t);
      },
      onError(data) {
        setLog(prev => [...prev, { agent: 'System', type: 'warning', msg: data.message }]);
        if (!data.recoverable) {
          const t = setTimeout(handleComplete, 1500);
          localTimeouts.push(t);
          timeoutRefs.current.push(t);
        }
      },
    });

    return () => {
      disconnect();
      localTimeouts.forEach(clearTimeout);
    };
  }, [sessionId, handleComplete]);

  const getAgentColor = (agent: string) => {
    if (agent === 'Planner') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (agent === 'Research') return 'text-green-600 bg-green-50 border-green-200';
    if (agent === 'Critic') return 'text-amber-600 bg-amber-50 border-amber-200';
    if (agent === 'Renderer') return 'text-purple-600 bg-purple-50 border-purple-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  const getThreadBorderColor = (color: string) => {
    if (color.includes('blue')) return 'border-blue-200 bg-blue-50/50';
    if (color.includes('green')) return 'border-green-200 bg-green-50/50';
    if (color.includes('amber')) return 'border-amber-200 bg-amber-50/50';
    if (color.includes('purple')) return 'border-purple-200 bg-purple-50/50';
    if (color.includes('rose')) return 'border-rose-200 bg-rose-50/50';
    if (color.includes('cyan')) return 'border-cyan-200 bg-cyan-50/50';
    return 'border-slate-200 bg-slate-50/50';
  };

  const getThreadTextColor = (color: string) => {
    if (color.includes('blue')) return { title: 'text-blue-900', body: 'text-blue-700', icon: 'text-blue-600' };
    if (color.includes('green')) return { title: 'text-green-900', body: 'text-green-700', icon: 'text-green-600' };
    if (color.includes('amber')) return { title: 'text-amber-900', body: 'text-amber-700', icon: 'text-amber-600' };
    if (color.includes('purple')) return { title: 'text-purple-900', body: 'text-purple-700', icon: 'text-purple-600' };
    if (color.includes('rose')) return { title: 'text-rose-900', body: 'text-rose-700', icon: 'text-rose-600' };
    if (color.includes('cyan')) return { title: 'text-cyan-900', body: 'text-cyan-700', icon: 'text-cyan-600' };
    return { title: 'text-slate-900', body: 'text-slate-700', icon: 'text-slate-600' };
  };

  return (
    <div className="h-full bg-slate-100 p-6 flex flex-col font-sans overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {/* Header Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Agent Session Active</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">"{query}"</h1>
          </div>

          <div className="flex items-center gap-8 shrink-0">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
                <Activity className="w-6 h-6 text-indigo-500" />
                {cycle}
              </div>
              <div className="text-xs text-slate-500 uppercase font-medium mt-1">Research Cycle</div>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
                <FileText className="w-6 h-6 text-indigo-500" />
                {sourcesCount}
              </div>
              <div className="text-xs text-slate-500 uppercase font-medium mt-1">Sources Found</div>
            </div>
          </div>
        </div>

        {/* Pipeline / Phases */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-6">Orchestrator Pipeline</h3>
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(currentPhaseIdx / (PHASES.length - 1)) * 100}%` }}
            />
            {PHASES.map((phase, idx) => {
              const active = idx === currentPhaseIdx;
              const past = idx < currentPhaseIdx;
              return (
                <div key={phase} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white",
                    active ? "border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.3)] scale-110" :
                    past ? "border-indigo-600 bg-indigo-50" : "border-slate-200 text-slate-400"
                  )}>
                    {past ? <CheckCircle className="w-5 h-5 text-indigo-600" /> :
                     active ? <ServerCog className="w-5 h-5 text-indigo-600 animate-spin-slow" /> :
                     <Clock className="w-5 h-5" />}
                  </div>
                  <span className={clsx(
                    "text-xs font-medium uppercase tracking-wider transition-colors",
                    active ? "text-indigo-700 font-bold" : past ? "text-indigo-600" : "text-slate-400"
                  )}>{phase}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-[400px]">
          {/* Active Threads Side */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4 flex items-center justify-between">
                <span>Active Threads</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">{threads.length} Detected</span>
              </h3>

              <div className="space-y-3">
                <AnimatePresence>
                  {threads.map((thread) => {
                    const colors = getThreadTextColor(thread.color);
                    return (
                      <motion.div
                        key={thread.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={clsx("p-3 border rounded-xl", getThreadBorderColor(thread.color))}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={clsx("text-sm font-bold", colors.title)}>{thread.name}</span>
                          {thread.status === 'complete' ? (
                            <CheckCircle className={clsx("w-4 h-4", colors.icon)} />
                          ) : (
                            <Activity className={clsx("w-4 h-4 animate-pulse", colors.icon)} />
                          )}
                        </div>
                        <p className={clsx("text-xs line-clamp-2", colors.body)}>{thread.description}</p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Reasoning Trace Log */}
          <div className="w-2/3 flex flex-col bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden relative">
            <div className="bg-slate-950 px-5 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" /> Agent Reasoning Trace (SSE)
              </h3>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 font-mono text-sm scroll-smooth">
              <AnimatePresence initial={false}>
                {log.map((entry, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 items-start group"
                  >
                    <div className="text-slate-500 shrink-0 text-xs mt-1 tabular-nums">
                      {new Date().toISOString().substring(11, 23)}
                    </div>
                    <div className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 w-24 text-center border",
                      getAgentColor(entry.agent)
                    )}>
                      {entry.agent}
                    </div>
                    <div className={clsx(
                      "flex-1 break-words leading-relaxed",
                      entry.type === 'phase' ? "text-indigo-300 font-bold" :
                      entry.type === 'warning' ? "text-amber-400" :
                      entry.type === 'success' ? "text-emerald-400" : "text-slate-300"
                    )}>
                      {entry.msg}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {currentPhaseIdx < 4 && (
                <div className="flex gap-4 items-center opacity-50 pl-[150px]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
