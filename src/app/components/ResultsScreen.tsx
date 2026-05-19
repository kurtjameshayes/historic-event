import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Network, AlignLeft, Layers, X, ExternalLink, ShieldCheck, CornerDownRight, Zap, Loader2 } from 'lucide-react';
import { DAGData, EventNode, CausalEdge } from '../types';
import { TimelineView } from './TimelineView';
import { NarrativeView } from './NarrativeView';
import { BrowseView } from './BrowseView';
import { getEventDetail } from '../services/api';

function isSafeUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface ResultsScreenProps {
  data: DAGData;
  sessionId: string | null;
  onReset: () => void;
}

type Tab = 'browse' | 'timeline' | 'narrative';

const SHOW_TIMELINE_TAB = false;

export function ResultsScreen({ data, sessionId, onReset }: ResultsScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [selectedNode, setSelectedNode] = useState<EventNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<CausalEdge | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const getThreadColor = (id: string) => data.threads.find(t => t.id === id)?.color || 'text-slate-500';

  useEffect(() => {
    if (!selectedNode || !sessionId) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    const eventId = selectedNode.id;
    const cached = detailCache[eventId] ?? (selectedNode.detail || '').trim();
    if (cached) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    getEventDetail(sessionId, eventId)
      .then((res) => {
        if (cancelled) return;
        setDetailCache((prev) => ({ ...prev, [eventId]: res.detail }));
        setDetailLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err?.message || 'Failed to load detailed analysis.');
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode, sessionId, detailCache]);

  const renderEventDetail = (node: EventNode) => {
    const cached = detailCache[node.id] ?? (node.detail || '').trim();
    const paragraphs = cached
      ? cached.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      : [];

    if (detailLoading && !cached) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            Composing detailed historical analysis…
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-[95%]" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-[88%]" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-[60%]" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
            {node.description}
          </p>
        </div>
      );
    }

    if (detailError && !cached) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">{node.description}</p>
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
            {detailError}
          </p>
        </div>
      );
    }

    if (paragraphs.length === 0) {
      return <p className="text-sm text-slate-700 leading-relaxed">{node.description}</p>;
    }

    return (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Analysis Complete
          </div>
          <h1 className="text-xl font-bold text-slate-800">{data.target_event.name}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-slate-200 flex text-sm font-medium">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors ${
                activeTab === 'browse' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" /> Browse
            </button>
            {SHOW_TIMELINE_TAB && (
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors ${
                  activeTab === 'timeline' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="w-4 h-4" /> Timeline (DAG)
              </button>
            )}
            <button
              onClick={() => setActiveTab('narrative')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors ${
                activeTab === 'narrative' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlignLeft className="w-4 h-4" /> Narrative
            </button>
          </div>
          
          <button 
            onClick={onReset}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
          >
            New Query
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <main
          className={`flex-1 transition-all duration-300 ${
            selectedNode ? 'mr-[30rem]' : selectedEdge ? 'mr-96' : ''
          }`}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'browse' && (
              <motion.div
                key="browse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full p-4"
              >
                <BrowseView
                  data={data}
                  onNodeClick={(n) => { setSelectedNode(n); setSelectedEdge(null); }}
                />
              </motion.div>
            )}
            {SHOW_TIMELINE_TAB && activeTab === 'timeline' && (
              <motion.div 
                key="timeline" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="h-full w-full p-4"
              >
                <TimelineView 
                  data={data} 
                  onNodeClick={(n) => { setSelectedNode(n); setSelectedEdge(null); }}
                  onEdgeClick={(e) => { setSelectedEdge(e); setSelectedNode(null); }}
                />
              </motion.div>
            )}
            {activeTab === 'narrative' && (
              <motion.div 
                key="narrative" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="h-full w-full overflow-y-auto"
              >
                <NarrativeView data={data} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Side Panel for Detail */}
        <AnimatePresence>
          {(selectedNode || selectedEdge) && (
            <motion.aside 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`absolute right-0 top-0 bottom-0 ${
                selectedNode ? 'w-[30rem]' : 'w-96'
              } bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20`}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  {selectedNode ? "Event Detail" : "Causal Edge"}
                </h3>
                <button 
                  onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                  className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {selectedNode && (
                  <div className="space-y-6">
                    <div>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold mb-3 border ${getThreadColor(selectedNode.thread_id)}`}>
                        {data.threads.find(t => t.id === selectedNode.thread_id)?.name}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedNode.title}</h2>
                      <div className="text-sm font-medium text-slate-500 mb-4">{selectedNode.date}</div>
                      {renderEventDetail(selectedNode)}
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Supporting Sources
                      </h4>
                      <ul className="space-y-3">
                        {selectedNode.sources.map((src, i) => (
                          <li key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 capitalize">
                                {src.quality}
                              </span>
                              {isSafeUrl(src.url) && (
                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="font-medium text-sm text-slate-800 mb-1">{src.title}</div>
                            <blockquote className="text-xs text-slate-500 border-l-2 border-slate-300 pl-2 italic">
                              "{src.excerpt}"
                            </blockquote>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500 font-bold mb-1">CAUSE:</div>
                      <div className="font-medium text-slate-900 mb-4">
                        {data.events.find(e => e.id === selectedEdge.from_event_id)?.title}
                      </div>
                      
                      <div className="flex justify-center my-2">
                        <CornerDownRight className="w-6 h-6 text-indigo-400" />
                      </div>

                      <div className="text-xs text-slate-500 font-bold mb-1">EFFECT:</div>
                      <div className="font-medium text-slate-900">
                        {data.events.find(e => e.id === selectedEdge.to_event_id)?.title}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2">Agent Causal Reasoning</h4>
                      <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                        <p className="text-sm text-indigo-900 leading-relaxed">
                          {selectedEdge.reasoning}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2">Confidence Score</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${selectedEdge.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-lg text-emerald-700">
                          {Math.round(selectedEdge.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Composite score based on source count, quality rating, and inter-source agreement.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
