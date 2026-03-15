import React, { useState } from 'react';
import { Search, History, Settings2, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InputScreenProps {
  onSubmit: (query: string, config: any) => void;
  error?: string | null;
}

export function InputScreen({ onSubmit, error }: InputScreenProps) {
  const [query, setQuery] = useState('');
  // Advanced config hidden for now; fixed values: depth=1, cycles=1, sources=3, max 5 threads
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [depth, setDepth] = useState(1);
  const [cycles, setCycles] = useState(1);
  const [sourcesPerThread, setSourcesPerThread] = useState(3);
  const [focusThreads, setFocusThreads] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSubmit(query, { depth, cycles, sourcesPerThread, focusThreads: focusThreads.split(',').map(t => t.trim()).filter(Boolean), maxThreads: 5 });
  };

  const suggestions = [
    "What caused the Fall of the Berlin Wall?",
    "Why did the 2008 Financial Crisis happen?",
    "What precipitated the Meiji Restoration?"
  ];

  return (
    <div className="h-full bg-slate-50 flex flex-col items-center justify-center p-6 font-sans overflow-y-auto">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-6">
            <History className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Historical Causal Timeline Agent
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            An autonomous AI system that researches historical events, builds multi-threaded causal timelines, and traces the interconnected roots of the past.
          </p>
        </div>

        <form onSubmit={handleSearch} className="bg-white p-2 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 transition-all duration-300">
          <div className="relative flex items-center">
            <Search className="absolute left-6 text-slate-400 w-6 h-6" />
            <input 
              type="text" 
              placeholder="Ask about a historical event..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-16 pr-32 py-5 text-lg bg-transparent border-none outline-none focus:ring-0 text-slate-900 placeholder:text-slate-400"
            />
            <button 
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Investigate
            </button>
          </div>

          <div className="px-4 pb-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <div className="flex gap-2">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuery(sug)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
            
            {/* Advanced config hidden for now - remove 'hidden' class to restore */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="hidden text-sm flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors py-2 px-3 rounded-lg hover:bg-slate-50"
            >
              <Settings2 className="w-4 h-4" />
              Advanced config
            </button>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100 bg-slate-50/50 rounded-b-xl"
              >
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Max Causal Depth (1-5)</label>
                    <input 
                      type="range" 
                      min="1" max="5" 
                      value={depth} 
                      onChange={(e) => setDepth(parseInt(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Shallow (1)</span>
                      <span className="font-medium text-indigo-600">{depth} levels</span>
                      <span>Deep (5)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Max Research Cycles</label>
                    <input 
                      type="range" 
                      min="1" max="10" 
                      value={cycles} 
                      onChange={(e) => setCycles(parseInt(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Fast (1)</span>
                      <span className="font-medium text-indigo-600">{cycles} loops</span>
                      <span>Thorough (10)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sources per Topic (1-20)</label>
                    <input 
                      type="range" 
                      min="1" max="20" 
                      value={sourcesPerThread} 
                      onChange={(e) => setSourcesPerThread(parseInt(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Fewer (1)</span>
                      <span className="font-medium text-indigo-600">{sourcesPerThread} sources</span>
                      <span>More (20)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Focus Threads (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Economic, Military"
                      value={focusThreads}
                      onChange={(e) => setFocusThreads(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Comma-separated dimensions to prioritize</p>
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

        <div className="mt-8 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200/50 text-amber-800 text-sm max-w-2xl mx-auto">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> This agent executes live iterative research loops (Plan &rarr; Act &rarr; Observe &rarr; Adapt) and autonomously evaluates its own findings for historical completeness and contradictions.
          </p>
        </div>
      </div>
    </div>
  );
}
