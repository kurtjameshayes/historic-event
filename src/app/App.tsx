import React, { useState } from 'react';
import { History, PlusCircle } from 'lucide-react';
import { InputScreen } from './components/InputScreen';
import { StatusScreen } from './components/StatusScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { createSession } from './services/api';
import type { DAGData } from './types';

type AppState = 'INPUT' | 'RESEARCHING' | 'RESULTS' | 'HISTORY';

export default function App() {
  const [appState, setAppState] = useState<AppState>('INPUT');
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dagData, setDagData] = useState<DAGData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartSearch = async (q: string, c: any) => {
    setQuery(q);
    setError(null);

    try {
      const { session_id } = await createSession(q, {
        max_depth: c.depth,
        max_cycles: c.cycles,
        max_sources_per_thread: c.sourcesPerThread ?? 3,
        focus_threads: c.focusThreads || [],
        max_threads: c.maxThreads ?? 5,
      });
      setSessionId(session_id);
      setAppState('RESEARCHING');
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    }
  };

  const handleResearchComplete = (data: DAGData) => {
    setDagData(data);
    setAppState('RESULTS');
  };

  const handleReset = () => {
    setAppState('INPUT');
    setQuery('');
    setSessionId(null);
    setDagData(null);
    setError(null);
  };

  const handleLoadResults = (_sessionId: string, data: DAGData) => {
    setSessionId(_sessionId);
    setDagData(data);
    setAppState('RESULTS');
  };

  const handleResumeSession = (_sessionId: string, _query: string) => {
    setSessionId(_sessionId);
    setQuery(_query);
    setAppState('RESEARCHING');
  };

  const navActive = (state: AppState) =>
    appState === state
      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';

  return (
    <div className="w-full h-full bg-slate-50 text-slate-900 font-sans selection:bg-indigo-200 selection:text-indigo-900 flex flex-col">
      <nav className="flex-none h-12 border-b border-slate-200 bg-white px-6 flex items-center justify-between z-30">
        <button
          onClick={handleReset}
          className="text-sm font-bold text-slate-800 tracking-tight"
        >
          Historical Causal Timeline
        </button>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 text-sm font-medium">
          <button
            onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${navActive('INPUT')}`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Query
          </button>
          <button
            onClick={() => setAppState('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${navActive('HISTORY')}`}
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        {appState === 'INPUT' && (
          <InputScreen onSubmit={handleStartSearch} error={error} />
        )}

        {appState === 'RESEARCHING' && sessionId && (
          <StatusScreen
            query={query}
            sessionId={sessionId}
            onComplete={handleResearchComplete}
          />
        )}

        {appState === 'RESULTS' && dagData && (
          <ResultsScreen data={dagData} onReset={handleReset} />
        )}

        {appState === 'HISTORY' && (
          <HistoryScreen
            onLoadResults={handleLoadResults}
            onResumeSession={handleResumeSession}
          />
        )}
      </div>
    </div>
  );
}
