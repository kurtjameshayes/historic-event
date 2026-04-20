import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitCompareArrows,
  Layers,
  AlignLeft,
  ArrowRight,
  ArrowLeft,
  Equal,
  Send,
  MessageSquarePlus,
  FileEdit,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type { ComparisonData, DAGData, EventNode } from '../types';
import { BrowseView } from './BrowseView';
import { addComparisonSuggestion, addComparisonPromptChange } from '../services/api';

interface CompareResultsScreenProps {
  data: ComparisonData;
  onReset: () => void;
}

type ViewTab = 'comparison' | 'browse' | 'narrative';

const CATEGORY_COLORS: Record<string, string> = {
  political: 'bg-blue-100 text-blue-800 border-blue-200',
  economic: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  social: 'bg-purple-100 text-purple-800 border-purple-200',
  military: 'bg-red-100 text-red-800 border-red-200',
  cultural: 'bg-amber-100 text-amber-800 border-amber-200',
  institutional: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  ideological: 'bg-rose-100 text-rose-800 border-rose-200',
  technological: 'bg-teal-100 text-teal-800 border-teal-200',
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category.toLowerCase()] || 'bg-slate-100 text-slate-800 border-slate-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors}`}>
      {category}
    </span>
  );
}

function SideIndicator({ side }: { side: 'a' | 'b' | 'both' }) {
  if (side === 'a') return <span className="flex items-center gap-1 text-xs font-bold text-indigo-600"><ArrowLeft className="w-3 h-3" /> A only</span>;
  if (side === 'b') return <span className="flex items-center gap-1 text-xs font-bold text-amber-600"><ArrowRight className="w-3 h-3" /> B only</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-slate-600"><Equal className="w-3 h-3" /> Divergent</span>;
}

export function CompareResultsScreen({ data, onReset }: CompareResultsScreenProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('comparison');
  const [selectedNode, setSelectedNode] = useState<EventNode | null>(null);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionSaved, setSuggestionSaved] = useState(false);
  const [showPromptChange, setShowPromptChange] = useState(false);
  const [promptOriginal, setPromptOriginal] = useState('');
  const [promptRevised, setPromptRevised] = useState('');
  const [promptReason, setPromptReason] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [expandedSimilarity, setExpandedSimilarity] = useState<number | null>(null);
  const [expandedDifference, setExpandedDifference] = useState<number | null>(null);

  const { analysis, dag_a, dag_b } = data;
  const targetA = dag_a?.target_event;
  const targetB = dag_b?.target_event;

  const handleSuggestionSubmit = async () => {
    if (!suggestionText.trim()) return;
    try {
      await addComparisonSuggestion(data.id, suggestionText.trim());
      setSuggestionSaved(true);
      setSuggestionText('');
      setTimeout(() => setSuggestionSaved(false), 3000);
    } catch { /* silent */ }
  };

  const handlePromptChangeSubmit = async () => {
    if (!promptRevised.trim()) return;
    try {
      await addComparisonPromptChange(data.id, promptOriginal.trim(), promptRevised.trim(), promptReason.trim());
      setPromptSaved(true);
      setPromptOriginal('');
      setPromptRevised('');
      setPromptReason('');
      setTimeout(() => setPromptSaved(false), 3000);
    } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4" />
            Comparison Complete
          </div>
          <h1 className="text-lg font-bold text-slate-800 hidden md:block">
            {targetA?.name || data.query_a} <span className="text-slate-400 font-normal mx-2">vs</span> {targetB?.name || data.query_b}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-slate-200 flex text-sm font-medium">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'comparison' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" /> Analysis
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'browse' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Browse
            </button>
            <button
              onClick={() => setActiveTab('narrative')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'narrative' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" /> Narrative
            </button>
          </div>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
          >
            New Comparison
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'comparison' && (
            <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-auto">
              <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Event Description Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-200">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Timeline A</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{targetA?.name || data.query_a}</h2>
                    {targetA?.date && <p className="text-sm font-medium text-slate-500 mb-2">{targetA.date}</p>}
                    <p className="text-sm text-slate-700 leading-relaxed">{targetA?.description || data.query_a}</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2">Timeline B</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{targetB?.name || data.query_b}</h2>
                    {targetB?.date && <p className="text-sm font-medium text-slate-500 mb-2">{targetB.date}</p>}
                    <p className="text-sm text-slate-700 leading-relaxed">{targetB?.description || data.query_b}</p>
                  </div>
                </div>

                {/* AI Summary */}
                {analysis?.summary && (
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <AlignLeft className="w-4 h-4 text-indigo-500" /> Comparative Summary
                    </h3>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{analysis.summary}</div>
                  </div>
                )}

                {/* Similarities */}
                {analysis && analysis.similarities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Equal className="w-4 h-4 text-emerald-500" /> Similarities ({analysis.similarities.length})
                    </h3>
                    <div className="space-y-2">
                      {analysis.similarities.map((sim, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => setExpandedSimilarity(expandedSimilarity === idx ? null : idx)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <CategoryBadge category={sim.category} />
                              <span className="text-sm font-medium text-slate-800">{sim.description}</span>
                            </div>
                            {expandedSimilarity === idx ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </button>
                          <AnimatePresence>
                            {expandedSimilarity === idx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 pt-1 grid grid-cols-2 gap-3 border-t border-slate-100">
                                  <div>
                                    <div className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Timeline A Events</div>
                                    {sim.events_a.length > 0 ? (
                                      <ul className="space-y-1">
                                        {sim.events_a.map((eid) => {
                                          const ev = dag_a?.events.find(e => e.id === eid);
                                          return <li key={eid} className="text-xs text-slate-600">{ev?.title || eid}</li>;
                                        })}
                                      </ul>
                                    ) : <p className="text-xs text-slate-400 italic">No specific events referenced</p>}
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-bold text-amber-500 uppercase mb-1">Timeline B Events</div>
                                    {sim.events_b.length > 0 ? (
                                      <ul className="space-y-1">
                                        {sim.events_b.map((eid) => {
                                          const ev = dag_b?.events.find(e => e.id === eid);
                                          return <li key={eid} className="text-xs text-slate-600">{ev?.title || eid}</li>;
                                        })}
                                      </ul>
                                    ) : <p className="text-xs text-slate-400 italic">No specific events referenced</p>}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Differences */}
                {analysis && analysis.differences.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <GitCompareArrows className="w-4 h-4 text-rose-500" /> Differences ({analysis.differences.length})
                    </h3>
                    <div className="space-y-2">
                      {analysis.differences.map((diff, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => setExpandedDifference(expandedDifference === idx ? null : idx)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <CategoryBadge category={diff.category} />
                              <SideIndicator side={diff.side} />
                              <span className="text-sm font-medium text-slate-800">{diff.description}</span>
                            </div>
                            {expandedDifference === idx ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </button>
                          <AnimatePresence>
                            {expandedDifference === idx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                                  <p className="text-sm text-slate-700 leading-relaxed">{diff.detail}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestion Input */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <MessageSquarePlus className="w-4 h-4 text-indigo-500" /> Share a Suggestion
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">Help improve future comparisons by sharing your insights.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder="e.g., Consider comparing the economic recovery timelines..."
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionSubmit()}
                    />
                    <button
                      onClick={handleSuggestionSubmit}
                      disabled={!suggestionText.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit
                    </button>
                  </div>
                  {suggestionSaved && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">Suggestion saved. Thank you!</p>
                  )}
                </div>

                {/* Prompt Refinement */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <button
                    onClick={() => setShowPromptChange(!showPromptChange)}
                    className="text-sm font-bold text-slate-800 flex items-center gap-2 w-full text-left"
                  >
                    <FileEdit className="w-4 h-4 text-indigo-500" /> Refine Comparison Prompt
                    {showPromptChange ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
                  </button>
                  <AnimatePresence>
                    {showPromptChange && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3">
                          <p className="text-xs text-slate-500">Suggest how the comparison analysis prompt should be improved for better results.</p>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Original prompt aspect (optional)</label>
                            <input
                              type="text"
                              value={promptOriginal}
                              onChange={(e) => setPromptOriginal(e.target.value)}
                              placeholder="e.g., The analysis focused too much on military aspects"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Revised guidance</label>
                            <textarea
                              value={promptRevised}
                              onChange={(e) => setPromptRevised(e.target.value)}
                              placeholder="e.g., Give equal weight to economic and social factors alongside military ones"
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
                            <input
                              type="text"
                              value={promptReason}
                              onChange={(e) => setPromptReason(e.target.value)}
                              placeholder="e.g., Both events had significant economic dimensions that were underrepresented"
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                          </div>
                          <button
                            onClick={handlePromptChangeSubmit}
                            disabled={!promptRevised.trim()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" /> Save Refinement
                          </button>
                          {promptSaved && (
                            <p className="text-xs text-emerald-600 font-medium">Prompt refinement saved. It will inform future comparisons.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'browse' && (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <div className="grid grid-cols-2 h-full divide-x divide-slate-200">
                <div className="overflow-auto p-4">
                  <div className="mb-3 px-2">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Timeline A</span>
                    <h3 className="text-sm font-bold text-slate-800">{targetA?.name || data.query_a}</h3>
                  </div>
                  {dag_a ? (
                    <BrowseView data={dag_a} onNodeClick={setSelectedNode} />
                  ) : (
                    <p className="text-sm text-slate-400 p-4">No data available for Timeline A</p>
                  )}
                </div>
                <div className="overflow-auto p-4">
                  <div className="mb-3 px-2">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Timeline B</span>
                    <h3 className="text-sm font-bold text-slate-800">{targetB?.name || data.query_b}</h3>
                  </div>
                  {dag_b ? (
                    <BrowseView data={dag_b} onNodeClick={setSelectedNode} />
                  ) : (
                    <p className="text-sm text-slate-400 p-4">No data available for Timeline B</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'narrative' && (
            <motion.div key="narrative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-auto">
              <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-3">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Timeline A Narrative</span>
                    <h3 className="text-lg font-bold text-slate-800">{targetA?.name || data.query_a}</h3>
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <p className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
                      {dag_a?.narrative || 'No narrative available.'}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="mb-3">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Timeline B Narrative</span>
                    <h3 className="text-lg font-bold text-slate-800">{targetB?.name || data.query_b}</h3>
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <p className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
                      {dag_b?.narrative || 'No narrative available.'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Event Detail Side Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col z-50"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Event Detail</h3>
              <button onClick={() => setSelectedNode(null)} className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">{selectedNode.title}</h2>
              <p className="text-sm font-medium text-slate-500">{selectedNode.date}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{selectedNode.description}</p>
              {selectedNode.sources.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">Sources</h4>
                  <ul className="space-y-2">
                    {selectedNode.sources.map((src, i) => (
                      <li key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 capitalize">{src.quality}</span>
                        <p className="text-xs font-medium text-slate-800 mt-1">{src.title}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
