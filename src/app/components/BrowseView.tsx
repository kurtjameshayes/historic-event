import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Layers,
  FolderOpen,
  Calendar,
  Hash,
} from 'lucide-react';
import { DAGData, EventNode, Subtopic, Thread } from '../types';
import { ScrollArea } from './ui/scroll-area';

interface BrowseViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
}

function getThreadStats(thread: Thread, data: DAGData) {
  const events = data.events.filter(e => e.thread_id === thread.id);
  const subtopics = data.subtopics.filter(s => s.thread_id === thread.id);
  const dates = events.map(e => e.date).filter(Boolean).sort();
  return {
    eventCount: events.length,
    subtopicCount: subtopics.length,
    dateRange: dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : '',
  };
}

function ThreadCard({
  thread,
  stats,
  expanded,
  onClick,
}: {
  thread: Thread;
  stats: { eventCount: number; subtopicCount: number; dateRange: string };
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {thread.name}
            </h3>
          </div>
          <p className="text-sm text-slate-600 line-clamp-2 mb-3">
            {thread.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              {stats.subtopicCount} subtopic{stats.subtopicCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {stats.eventCount} event{stats.eventCount !== 1 ? 's' : ''}
            </span>
            {stats.dateRange && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {stats.dateRange}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-all duration-200 flex-shrink-0 mt-1 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>
    </button>
  );
}

function SubtopicCard({
  subtopic,
  eventCount,
  expanded,
  onClick,
}: {
  subtopic: Subtopic;
  eventCount: number;
  expanded: boolean;
  onClick: () => void;
}) {
  const dateLabel =
    subtopic.date_range.start && subtopic.date_range.end
      ? subtopic.date_range.start === subtopic.date_range.end
        ? subtopic.date_range.start
        : `${subtopic.date_range.start} — ${subtopic.date_range.end}`
      : '';

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <h4 className="text-base font-semibold text-slate-900 truncate">
              {subtopic.name}
            </h4>
          </div>
          {subtopic.description && (
            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
              {subtopic.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </span>
            {dateLabel && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dateLabel}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-all duration-200 flex-shrink-0 mt-0.5 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>
    </button>
  );
}

function EventCard({
  event,
  onClick,
}: {
  event: EventNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 w-20 text-right">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            {event.date}
          </span>
        </div>
        <div className="w-px self-stretch bg-slate-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-indigo-700 transition-colors">
            {event.title}
          </h5>
          <p className="text-xs text-slate-500 line-clamp-2">
            {event.description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function BrowseView({ data, onNodeClick }: BrowseViewProps) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());

  const toggleThread = useCallback((id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSubtopic = useCallback((id: string) => {
    setExpandedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eventsById = useMemo(() => {
    const map = new Map<string, EventNode>();
    for (const ev of data.events) map.set(ev.id, ev);
    return map;
  }, [data.events]);

  const sortedThreads = useMemo(() => {
    const minTimestamp = new Map<string, number>();
    for (const ev of data.events) {
      const cur = minTimestamp.get(ev.thread_id);
      if (cur === undefined || ev.timestamp < cur) {
        minTimestamp.set(ev.thread_id, ev.timestamp);
      }
    }
    return [...data.threads].sort(
      (a, b) => (minTimestamp.get(a.id) ?? Infinity) - (minTimestamp.get(b.id) ?? Infinity),
    );
  }, [data.threads, data.events]);

  const subtopicsByThread = useMemo(() => {
    const map = new Map<string, Subtopic[]>();
    for (const st of data.subtopics) {
      const list = map.get(st.thread_id) ?? [];
      list.push(st);
      map.set(st.thread_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [data.subtopics]);

  return (
    <div className="h-full flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex-none px-5 pt-4 pb-2">
        <h2 className="text-xl font-bold text-slate-900">Causal Threads</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 pb-5 pt-2 space-y-3">
          {sortedThreads.map(thread => {
            const threadExpanded = expandedThreads.has(thread.id);
            const subtopics = subtopicsByThread.get(thread.id) ?? [];
            const hasSubtopics = subtopics.length > 0;

            const threadEvents = !hasSubtopics
              ? data.events
                  .filter(e => e.thread_id === thread.id)
                  .sort((a, b) => a.timestamp - b.timestamp)
              : [];

            return (
              <div key={thread.id}>
                <ThreadCard
                  thread={thread}
                  stats={getThreadStats(thread, data)}
                  expanded={threadExpanded}
                  onClick={() => toggleThread(thread.id)}
                />

                <AnimatePresence initial={false}>
                  {threadExpanded && (
                    <motion.div
                      key={`children-${thread.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-6 pt-2 space-y-2">
                        {hasSubtopics
                          ? subtopics.map(subtopic => {
                              const stExpanded = expandedSubtopics.has(subtopic.id);
                              const eventCount = subtopic.event_ids.filter(id => eventsById.has(id)).length;

                              return (
                                <div key={subtopic.id}>
                                  <SubtopicCard
                                    subtopic={subtopic}
                                    eventCount={eventCount}
                                    expanded={stExpanded}
                                    onClick={() => toggleSubtopic(subtopic.id)}
                                  />

                                  <AnimatePresence initial={false}>
                                    {stExpanded && (
                                      <motion.div
                                        key={`events-${subtopic.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pl-6 pt-2 space-y-2">
                                          {subtopic.event_ids
                                            .map(id => eventsById.get(id))
                                            .filter((e): e is EventNode => e !== undefined)
                                            .sort((a, b) => a.timestamp - b.timestamp)
                                            .map(ev => (
                                              <EventCard
                                                key={ev.id}
                                                event={ev}
                                                onClick={() => onNodeClick(ev)}
                                              />
                                            ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })
                          : threadEvents.map(ev => (
                              <EventCard
                                key={ev.id}
                                event={ev}
                                onClick={() => onNodeClick(ev)}
                              />
                            ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
