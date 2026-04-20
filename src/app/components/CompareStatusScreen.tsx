import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, FileText, Activity, CheckCircle, Clock, ServerCog, AlertTriangle, GitCompareArrows } from 'lucide-react';
import clsx from 'clsx';
import { connectSSE } from '../services/sse';
import { getComparison } from '../services/api';
import type { ComparisonData, DAGData } from '../types';
import type { ReasoningPayload } from '../services/sse';

const BASE_URL = import.meta.env.VITE_API_URL || '';

interface CompareStatusScreenProps {
  comparisonId: string;
  sessionIdA: string;
  sessionIdB: string;
  queryA: string;
  queryB: string;
  onComplete: (data: ComparisonData) => void;
}

type SessionStatus = 'active' | 'complete' | 'error';

const PHASES = ['Researching A', 'Researching B', 'Comparing'];

export function CompareStatusScreen({
  comparisonId,
  sessionIdA,
  sessionIdB,
  queryA,
  queryB,
  onComplete,
}: CompareStatusScreenProps) {
  const [logA, setLogA] = useState<{ agent: string; type: string; msg: string }[]>([]);
  const [logB, setLogB] = useState<{ agent: string; type: string; msg: string }[]>([]);
  const [statusA, setStatusA] = useState<SessionStatus>('active');
  const [statusB, setStatusB] = useState<SessionStatus>('active');
  const [comparingPhase, setComparingPhase] = useState(false);
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scrollRefA.current) scrollRefA.current.scrollTop = scrollRefA.current.scrollHeight;
  }, [logA]);

  useEffect(() => {
    if (scrollRefB.current) scrollRefB.current.scrollTop = scrollRefB.current.scrollHeight;
  }, [logB]);

  const handleFinalComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      const data = await getComparison(comparisonId);
      onComplete(data as ComparisonData);
    } catch {
      onComplete({
        id: comparisonId,
        query_a: queryA,
        query_b: queryB,
        status: 'ERROR',
        session_id_a: sessionIdA,
        session_id_b: sessionIdB,
        analysis: null,
        dag_a: null,
        dag_b: null,
        suggestions: [],
        prompt_changes: [],
      });
    }
  }, [comparisonId, queryA, queryB, sessionIdA, sessionIdB, onComplete]);

  useEffect(() => {
    const disconnectA = connectSSE(sessionIdA, {
      onReasoning(data: ReasoningPayload) {
        setLogA(prev => [...prev.slice(-200), { agent: data.agent, type: data.type, msg: data.message }]);
      },
      onComplete() {
        setStatusA('complete');
      },
      onError(data) {
        setLogA(prev => [...prev, { agent: 'System', type: 'warning', msg: data.message }]);
        if (!data.recoverable) setStatusA('error');
      },
    });

    const disconnectB = connectSSE(sessionIdB, {
      onReasoning(data: ReasoningPayload) {
        setLogB(prev => [...prev.slice(-200), { agent: data.agent, type: data.type, msg: data.message }]);
      },
      onComplete() {
        setStatusB('complete');
      },
      onError(data) {
        setLogB(prev => [...prev, { agent: 'System', type: 'warning', msg: data.message }]);
        if (!data.recoverable) setStatusB('error');
      },
    });

    return () => {
      disconnectA();
      disconnectB();
    };
  }, [sessionIdA, sessionIdB]);

  useEffect(() => {
    if (statusA !== 'active' && statusB !== 'active' && !comparingPhase) {
      setComparingPhase(true);
    }
  }, [statusA, statusB, comparingPhase]);

  useEffect(() => {
    if (!comparingPhase) return;

    pollingRef.current = setInterval(async () => {
      try {
        const data = await getComparison(comparisonId);
        if (data.status === 'COMPLETE' || data.status === 'ERROR') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          handleFinalComplete();
        }
      } catch { /* keep polling */ }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [comparingPhase, comparisonId, handleFinalComplete]);

  const currentPhase = !comparingPhase
    ? (statusA === 'active' ? 0 : 1)
    : 2;

  const getAgentColor = (agent: string) => {
    if (agent === 'Planner') return 'text-blue-400';
    if (agent === 'Research') return 'text-green-400';
    if (agent === 'Critic') return 'text-amber-400';
    if (agent === 'Renderer') return 'text-purple-400';
    return 'text-slate-400';
  };

  const renderLog = (
    log: { agent: string; type: string; msg: string }[],
    scrollRef: React.RefObject<HTMLDivElement | null>,
    label: string,
    status: SessionStatus,
  ) => (
    <div className="flex-1 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden min-h-0">
      <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-indigo-400" /> {label}
        </h3>
        <span className={clsx(
          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
          status === 'complete' ? "bg-emerald-900/50 text-emerald-400" :
          status === 'error' ? "bg-red-900/50 text-red-400" :
          "bg-indigo-900/50 text-indigo-400"
        )}>
          {status === 'complete' ? 'Complete' : status === 'error' ? 'Error' : 'Active'}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
        <AnimatePresence initial={false}>
          {log.map((entry, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 items-start"
            >
              <span className={clsx("shrink-0 font-bold", getAgentColor(entry.agent))}>
                [{entry.agent}]
              </span>
              <span className={clsx(
                "break-words leading-relaxed",
                entry.type === 'phase' ? "text-indigo-300 font-bold" :
                entry.type === 'warning' ? "text-amber-400" :
                entry.type === 'success' ? "text-emerald-400" : "text-slate-300"
              )}>
                {entry.msg}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {status === 'active' && (
          <div className="flex gap-1 items-center opacity-50 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-slate-100 p-6 flex flex-col font-sans overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-5 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Comparison In Progress</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timeline A</div>
              <p className="text-sm font-medium text-slate-800 line-clamp-2">{queryA}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timeline B</div>
              <p className="text-sm font-medium text-slate-800 line-clamp-2">{queryB}</p>
            </div>
          </div>
        </div>

        {/* Phase Pipeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-5 shrink-0">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(currentPhase / (PHASES.length - 1)) * 100}%` }}
            />
            {PHASES.map((phase, idx) => {
              const active = idx === currentPhase;
              const past = idx < currentPhase;
              return (
                <div key={phase} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={clsx(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white",
                    active ? "border-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)] scale-110" :
                    past ? "border-indigo-600 bg-indigo-50" : "border-slate-200 text-slate-400"
                  )}>
                    {past ? <CheckCircle className="w-4 h-4 text-indigo-600" /> :
                     active ? (idx === 2 ? <GitCompareArrows className="w-4 h-4 text-indigo-600 animate-pulse" /> : <ServerCog className="w-4 h-4 text-indigo-600 animate-spin" />) :
                     <Clock className="w-4 h-4" />}
                  </div>
                  <span className={clsx(
                    "text-[10px] font-medium uppercase tracking-wider",
                    active ? "text-indigo-700 font-bold" : past ? "text-indigo-600" : "text-slate-400"
                  )}>{phase}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dual Logs */}
        <div className="flex gap-4 flex-1 min-h-0">
          {renderLog(logA, scrollRefA, 'Timeline A — Agent Trace', statusA)}
          {renderLog(logB, scrollRefB, 'Timeline B — Agent Trace', statusB)}
        </div>

        {comparingPhase && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-indigo-50 rounded-xl p-4 border border-indigo-200 flex items-center gap-3 shrink-0"
          >
            <GitCompareArrows className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span className="text-sm font-medium text-indigo-800">
              Both timelines complete. AI is now analyzing similarities and differences...
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
