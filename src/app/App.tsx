import React, { useState, useCallback } from 'react';
import { History, PlusCircle, Info, GitCompareArrows } from 'lucide-react';
import { InputScreen } from './components/InputScreen';
import { StatusScreen } from './components/StatusScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { AboutScreen } from './components/AboutScreen';
import { CompareInputScreen } from './components/CompareInputScreen';
import { CompareStatusScreen } from './components/CompareStatusScreen';
import { CompareResultsScreen } from './components/CompareResultsScreen';
import { createSession, createComparison } from './services/api';
import type { DAGData, ComparisonData } from './types';

type AppState = 'INPUT' | 'RESEARCHING' | 'RESULTS' | 'HISTORY' | 'ABOUT' | 'COMPARE_INPUT' | 'COMPARE_RESEARCHING' | 'COMPARE_RESULTS';

export default function App() {
  const [appState, setAppState] = useState<AppState>('INPUT');
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dagData, setDagData] = useState<DAGData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [compareSessionIdA, setCompareSessionIdA] = useState<string | null>(null);
  const [compareSessionIdB, setCompareSessionIdB] = useState<string | null>(null);
  const [compareQueryA, setCompareQueryA] = useState('');
  const [compareQueryB, setCompareQueryB] = useState('');
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

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
        attachment_context: c.attachmentContext || undefined,
      });
      setSessionId(session_id);
      setAppState('RESEARCHING');
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    }
  };

  const handleStartComparison = async (queryA: string, queryB: string, c: any) => {
    setCompareQueryA(queryA);
    setCompareQueryB(queryB);
    setCompareError(null);

    try {
      const { comparison_id, session_id_a, session_id_b } = await createComparison(queryA, queryB, {
        max_depth: c.depth,
        max_cycles: c.cycles,
        max_sources_per_thread: c.sourcesPerThread ?? 3,
        max_threads: c.maxThreads ?? 5,
        attachment_context_a: c.attachmentContextA || undefined,
        attachment_context_b: c.attachmentContextB || undefined,
      });
      setComparisonId(comparison_id);
      setCompareSessionIdA(session_id_a);
      setCompareSessionIdB(session_id_b);
      setAppState('COMPARE_RESEARCHING');
    } catch (err: any) {
      setCompareError(err.message || 'Failed to start comparison');
    }
  };

  const handleComparisonComplete = useCallback((data: ComparisonData) => {
    setComparisonData(data);
    setAppState('COMPARE_RESULTS');
  }, []);

  const handleLoadComparison = useCallback((data: ComparisonData) => {
    setComparisonData(data);
    setComparisonId(data.id);
    setCompareQueryA(data.query_a);
    setCompareQueryB(data.query_b);
    setCompareSessionIdA(data.session_id_a);
    setCompareSessionIdB(data.session_id_b);
    setAppState('COMPARE_RESULTS');
  }, []);

  const handleResearchComplete = useCallback((data: DAGData) => {
    setDagData(data);
    setAppState('RESULTS');
  }, []);

  const handleReset = () => {
    setAppState('INPUT');
    setQuery('');
    setSessionId(null);
    setDagData(null);
    setError(null);
    setComparisonId(null);
    setCompareSessionIdA(null);
    setCompareSessionIdB(null);
    setCompareQueryA('');
    setCompareQueryB('');
    setComparisonData(null);
    setCompareError(null);
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
            onClick={() => { setCompareError(null); setAppState('COMPARE_INPUT'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${navActive('COMPARE_INPUT')}`}
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            Compare
          </button>
          <button
            onClick={() => setAppState('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${navActive('HISTORY')}`}
          >
            <History className="w-3.5 h-3.5" />
            Investigation Results
          </button>
          <button
            onClick={() => setAppState('ABOUT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${navActive('ABOUT')}`}
          >
            <Info className="w-3.5 h-3.5" />
            About
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden">
        {appState === 'INPUT' && (
          <InputScreen
            onSubmit={handleStartSearch}
            error={error}
            onAboutClick={() => setAppState('ABOUT')}
          />
        )}

        {appState === 'RESEARCHING' && sessionId && (
          <StatusScreen
            query={query}
            sessionId={sessionId}
            onComplete={handleResearchComplete}
          />
        )}

        {appState === 'RESULTS' && dagData && (
          <ResultsScreen data={dagData} sessionId={sessionId} onReset={handleReset} />
        )}

        {appState === 'COMPARE_INPUT' && (
          <CompareInputScreen
            onSubmit={handleStartComparison}
            error={compareError}
          />
        )}

        {appState === 'COMPARE_RESEARCHING' && comparisonId && compareSessionIdA && compareSessionIdB && (
          <CompareStatusScreen
            comparisonId={comparisonId}
            sessionIdA={compareSessionIdA}
            sessionIdB={compareSessionIdB}
            queryA={compareQueryA}
            queryB={compareQueryB}
            onComplete={handleComparisonComplete}
          />
        )}

        {appState === 'COMPARE_RESULTS' && comparisonData && (
          <CompareResultsScreen data={comparisonData} onReset={handleReset} />
        )}

        {appState === 'HISTORY' && (
          <HistoryScreen
            onLoadResults={handleLoadResults}
            onResumeSession={handleResumeSession}
            onLoadComparison={handleLoadComparison}
          />
        )}

        {appState === 'ABOUT' && (
          <AboutScreen onBack={handleReset} />
        )}
      </div>
    </div>
  );
}
