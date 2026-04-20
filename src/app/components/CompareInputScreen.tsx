import React, { useState } from 'react';
import { GitCompareArrows, Settings2, Sparkles, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface CompareInputScreenProps {
  onSubmit: (queryA: string, queryB: string, config: any) => void;
  error?: string | null;
}

const SUGGESTION_PAIRS = [
  { a: "What caused the Fall of the Roman Empire?", b: "What caused the Fall of the Berlin Wall?" },
  { a: "Why did the 2008 Financial Crisis happen?", b: "What caused the Great Depression?" },
  { a: "What precipitated the French Revolution?", b: "What precipitated the Russian Revolution?" },
];

export function CompareInputScreen({ onSubmit, error }: CompareInputScreenProps) {
  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [depth, setDepth] = useState(1);
  const [cycles, setCycles] = useState(1);
  const [sourcesPerThread, setSourcesPerThread] = useState(3);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryA.trim() || !queryB.trim()) return;
    onSubmit(queryA, queryB, { depth, cycles, sourcesPerThread, maxThreads: 5 });
  };

  const applySuggestionPair = (pair: typeof SUGGESTION_PAIRS[0]) => {
    setQueryA(pair.a);
    setQueryB(pair.b);
  };

  return (
    <div className="size-full overflow-auto bg-gradient-to-br from-parchment-50 via-manuscript-50 to-parchment-100 font-sans">
      <div className="relative min-h-[70vh] flex items-center justify-center px-6">
        <div className="absolute inset-0 opacity-10">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1676115388797-5f448ad78e44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwdGltZWxpbmUlMjBzY3JvbGwlMjBwYXJjaG1lbnR8ZW58MXx8fHwxNzczNjA4NTEwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Ancient timeline scroll"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-5xl w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-bronze-300/30 blur-3xl rounded-full" />
              <div className="relative bg-gradient-to-br from-bronze-400 to-bronze-600 p-5 rounded-2xl shadow-2xl">
                <GitCompareArrows className="w-14 h-14 text-parchment-50" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-manuscript-900 mb-4 tracking-tight">
            Compare Timelines
          </h1>
          <p className="text-xl md:text-2xl text-manuscript-700 mb-2 font-light">
            Side-by-Side Historical Analysis
          </p>
          <p className="text-base md:text-lg text-manuscript-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Enter two historical events to compare their causal timelines, discover parallels, and uncover divergences.
          </p>

          <form onSubmit={handleCompare} className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border-2 border-bronze-200/60">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
              <div className="p-4 md:border-r border-bronze-100">
                <label className="block text-xs font-bold text-manuscript-500 uppercase tracking-wider mb-2 text-left">
                  Timeline A
                </label>
                <textarea
                  placeholder="e.g., What caused the Fall of the Roman Empire?"
                  value={queryA}
                  onChange={(e) => setQueryA(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 text-base bg-parchment-50/50 border border-bronze-200 rounded-xl outline-none focus:ring-2 focus:ring-bronze-400 focus:border-bronze-400 text-manuscript-900 placeholder:text-manuscript-400 resize-none"
                />
              </div>
              <div className="p-4 border-t md:border-t-0 border-bronze-100">
                <label className="block text-xs font-bold text-manuscript-500 uppercase tracking-wider mb-2 text-left">
                  Timeline B
                </label>
                <textarea
                  placeholder="e.g., What caused the Fall of the Berlin Wall?"
                  value={queryB}
                  onChange={(e) => setQueryB(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 text-base bg-parchment-50/50 border border-bronze-200 rounded-xl outline-none focus:ring-2 focus:ring-bronze-400 focus:border-bronze-400 text-manuscript-900 placeholder:text-manuscript-400 resize-none"
                />
              </div>
            </div>

            <div className="px-4 pb-2 pt-2 border-t border-bronze-100">
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {SUGGESTION_PAIRS.map((pair, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applySuggestionPair(pair)}
                    className="text-xs px-3 py-1.5 rounded-full bg-bronze-100/80 text-manuscript-700 hover:bg-bronze-200/80 transition-colors max-w-xs truncate"
                  >
                    {pair.a.replace(/^What caused |^Why did |^What precipitated /i, '')} vs {pair.b.replace(/^What caused |^Why did |^What precipitated /i, '')}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm flex items-center gap-1.5 text-manuscript-600 hover:text-manuscript-900 transition-colors py-2 px-3 rounded-lg hover:bg-manuscript-50"
                >
                  <Settings2 className="w-4 h-4" />
                  Advanced config
                </button>
                <button
                  type="submit"
                  disabled={!queryA.trim() || !queryB.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-bronze-600 to-bronze-500 hover:from-bronze-700 hover:to-bronze-600 disabled:from-bronze-300 disabled:to-bronze-200 text-parchment-50 font-medium rounded-xl flex items-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Compare Timelines
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-bronze-100 bg-parchment-50/50 rounded-b-xl"
                >
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-manuscript-700 mb-2">Max Causal Depth (1-5)</label>
                      <input type="range" min="1" max="5" value={depth} onChange={(e) => setDepth(parseInt(e.target.value))} className="w-full accent-bronze-600" />
                      <div className="flex justify-between text-xs text-manuscript-500 mt-1">
                        <span>Shallow (1)</span>
                        <span className="font-medium text-bronze-600">{depth} levels</span>
                        <span>Deep (5)</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-manuscript-700 mb-2">Max Research Cycles</label>
                      <input type="range" min="1" max="10" value={cycles} onChange={(e) => setCycles(parseInt(e.target.value))} className="w-full accent-bronze-600" />
                      <div className="flex justify-between text-xs text-manuscript-500 mt-1">
                        <span>Fast (1)</span>
                        <span className="font-medium text-bronze-600">{cycles} loops</span>
                        <span>Thorough (10)</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-manuscript-700 mb-2">Sources per Topic (1-20)</label>
                      <input type="range" min="1" max="20" value={sourcesPerThread} onChange={(e) => setSourcesPerThread(parseInt(e.target.value))} className="w-full accent-bronze-600" />
                      <div className="flex justify-between text-xs text-manuscript-500 mt-1">
                        <span>Fewer (1)</span>
                        <span className="font-medium text-bronze-600">{sourcesPerThread} sources</span>
                        <span>More (20)</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {error && (
            <div className="mt-6 flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200/50 text-red-800 text-sm max-w-2xl mx-auto">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
