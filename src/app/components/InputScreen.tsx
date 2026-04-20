import React, { useState } from 'react';
import { Search, Settings2, Sparkles, AlertCircle, Clock, Brain, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface InputScreenProps {
  onSubmit: (query: string, config: any) => void;
  error?: string | null;
  onAboutClick?: () => void;
}

export function InputScreen({ onSubmit, error, onAboutClick }: InputScreenProps) {
  const [query, setQuery] = useState('');
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
    <div className="size-full overflow-auto bg-gradient-to-br from-parchment-50 via-manuscript-50 to-parchment-100 font-sans">
      {/* Hero Section */}
      <div className="relative min-h-[70vh] flex items-center justify-center px-6">
        <div className="absolute inset-0 opacity-10">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1676115388797-5f448ad78e44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwdGltZWxpbmUlMjBzY3JvbGwlMjBwYXJjaG1lbnR8ZW58MXx8fHwxNzczNjA4NTEwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Ancient timeline scroll"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-4xl w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-bronze-300/30 blur-3xl rounded-full" />
              <div className="relative bg-gradient-to-br from-bronze-400 to-bronze-600 p-5 rounded-2xl shadow-2xl">
                <Clock className="w-14 h-14 text-parchment-50" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-manuscript-900 mb-4 tracking-tight">
            Historical Causal Timeline Agent
          </h1>
          <p className="text-xl md:text-2xl text-manuscript-700 mb-2 font-light">
            AI-Powered Historical Timeline Analysis
          </p>
          <p className="text-base md:text-lg text-manuscript-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            An autonomous AI system that researches historical events, builds multi-threaded causal timelines, and traces the interconnected roots of the past.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="bg-white/90 backdrop-blur p-2 rounded-2xl shadow-xl border-2 border-bronze-200/60 transition-all">
            <div className="relative flex items-stretch gap-2 py-2 pl-14 pr-2">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-manuscript-400 w-5 h-5 pointer-events-none" />
              <textarea
                rows={2}
                placeholder="Ask about a historical event..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                className="flex-1 min-w-0 py-2 text-lg bg-transparent border-none outline-none focus:ring-0 text-manuscript-900 placeholder:text-manuscript-400 resize-none leading-normal"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="shrink-0 self-center px-5 py-2.5 bg-gradient-to-r from-bronze-600 to-bronze-500 hover:from-bronze-700 hover:to-bronze-600 disabled:from-bronze-300 disabled:to-bronze-200 text-parchment-50 font-medium rounded-xl flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Investigate
              </button>
            </div>
            <div className="px-4 pb-2 flex items-center justify-between border-t border-bronze-100 pt-2">
              <div className="flex flex-wrap gap-2 justify-center flex-1">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuery(sug)}
                    className="text-xs px-3 py-1.5 rounded-full bg-bronze-100/80 text-manuscript-700 hover:bg-bronze-200/80 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="hidden text-sm flex items-center gap-1.5 text-manuscript-600 hover:text-manuscript-900 transition-colors py-2 px-3 rounded-lg hover:bg-manuscript-50"
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
                  className="overflow-hidden border-t border-bronze-100 bg-parchment-50/50 rounded-b-xl"
                >
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div>
                      <label className="block text-sm font-medium text-manuscript-700 mb-2">Focus Threads (Optional)</label>
                      <input type="text" placeholder="e.g., Economic, Military" value={focusThreads} onChange={(e) => setFocusThreads(e.target.value)} className="w-full px-3 py-2 border border-bronze-200 rounded-lg text-sm focus:ring-2 focus:ring-bronze-500 focus:border-bronze-500 outline-none" />
                      <p className="text-xs text-manuscript-500 mt-1">Comma-separated dimensions to prioritize</p>
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

          {onAboutClick && (
            <p className="mt-6 text-center text-sm text-manuscript-600">
              <button type="button" onClick={onAboutClick} className="text-bronze-600 hover:text-bronze-700 hover:underline">
                About this app
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="relative py-20 px-6 bg-manuscript-900/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl text-center text-manuscript-900 mb-12 font-serif">
            Discover Historical Connections
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/80 backdrop-blur rounded-2xl p-8 border-2 border-bronze-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-manuscript-500 to-manuscript-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl text-manuscript-900 mb-4 font-serif">AI-Driven Analysis</h3>
              <p className="text-manuscript-700 leading-relaxed text-sm">
                Advanced algorithms identify causal relationships and patterns across historical events, revealing hidden connections.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-8 border-2 border-bronze-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-bronze-500 to-bronze-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <GitBranch className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl text-manuscript-900 mb-4 font-serif">Causal Networks</h3>
              <p className="text-manuscript-700 leading-relaxed text-sm">
                Visualize how events cascade through time, showing cause and effect relationships across different historical periods.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-8 border-2 border-bronze-200 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-sage-600 to-sage-700 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl text-manuscript-900 mb-4 font-serif">Spanning Millennia</h3>
              <p className="text-manuscript-700 leading-relaxed text-sm">
                From ancient civilizations to contemporary events, explore comprehensive timelines across all of recorded history.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Showcase */}
      <div className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl text-manuscript-900 mb-6 font-serif">
                Where Past Meets Analysis
              </h2>
              <p className="text-base text-manuscript-700 mb-6 leading-relaxed">
                Our platform combines scholarly historical research with cutting-edge AI to create interactive,
                educational timelines that illuminate the threads connecting events across time.
              </p>
              <p className="text-base text-manuscript-700 leading-relaxed">
                Whether you're a researcher, student, or history enthusiast, this agent helps you understand
                not just when events happened, but why they mattered and how they shaped what came next.
              </p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-bronze-300/20 blur-2xl rounded-full" />
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1569586858631-d756e7387c56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwbGlicmFyeSUyMGJvb2tzfGVufDF8fHx8MTc3MzU2MjEyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Ancient library books"
                className="relative rounded-2xl shadow-2xl border-4 border-bronze-200 w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
