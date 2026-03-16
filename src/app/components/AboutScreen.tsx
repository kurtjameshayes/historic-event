import React from 'react';
import { ArrowLeft, BookOpen, Search, GitBranch, CheckCircle } from 'lucide-react';

interface AboutScreenProps {
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-y-auto">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="space-y-8">
          <div>
            <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              About Historical Causal Timeline Agent
            </h1>
            <p className="text-slate-600 leading-relaxed">
              An autonomous AI system that researches historical events, builds multi-threaded causal timelines, 
              and traces the interconnected roots of the past. Enter a historical question to generate a 
              causal graph of events, threads, and subtopics with source citations.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              How it works
            </h2>
            <p className="text-slate-600 leading-relaxed">
              This agent executes live iterative research loops (Plan → Act → Observe → Adapt) and 
              autonomously evaluates its own findings for historical completeness and contradictions. 
              It plans research threads, gathers sources, extracts events, and refines the causal 
              structure until it produces a coherent timeline.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-600" />
              Features
            </h2>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Multi-threaded causal timelines with subtopics and events</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Browse, Timeline, and Narrative views of the results</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Source citations and confidence scores</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Session history to revisit past investigations</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
