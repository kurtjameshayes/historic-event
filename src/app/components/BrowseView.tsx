import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Layers,
  FolderOpen,
  Calendar,
  ArrowLeft,
  Hash,
} from 'lucide-react';
import { DAGData, EventNode, Subtopic, Thread } from '../types';
import { ScrollArea } from './ui/scroll-area';

interface BrowseViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
}

type BrowseNav =
  | { level: 'threads' }
  | { level: 'subtopics'; threadId: string }
  | { level: 'events'; threadId: string; subtopicId: string };

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
  onClick,
}: {
  thread: Thread;
  stats: { eventCount: number; subtopicCount: number; dateRange: string };
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
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

function SubtopicCard({
  subtopic,
  eventCount,
  onClick,
}: {
  subtopic: Subtopic;
  eventCount: number;
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
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-0.5" />
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
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

function BreadcrumbNav({
  nav,
  data,
  onNavigate,
}: {
  nav: BrowseNav;
  data: DAGData;
  onNavigate: (nav: BrowseNav) => void;
}) {
  const thread =
    nav.level !== 'threads'
      ? data.threads.find(t => t.id === nav.threadId)
      : null;
  const subtopic =
    nav.level === 'events'
      ? data.subtopics.find(s => s.id === nav.subtopicId)
      : null;

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4">
      <button
        onClick={() => onNavigate({ level: 'threads' })}
        className={`font-medium transition-colors ${
          nav.level === 'threads'
            ? 'text-slate-900'
            : 'text-slate-500 hover:text-indigo-600'
        }`}
      >
        All Topics
      </button>
      {thread && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={() =>
              onNavigate({ level: 'subtopics', threadId: thread.id })
            }
            className={`font-medium transition-colors truncate max-w-[200px] ${
              nav.level === 'subtopics'
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-indigo-600'
            }`}
          >
            {thread.name}
          </button>
        </>
      )}
      {subtopic && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-900 truncate max-w-[200px]">
            {subtopic.name}
          </span>
        </>
      )}
    </nav>
  );
}

export function BrowseView({ data, onNodeClick }: BrowseViewProps) {
  const [nav, setNav] = useState<BrowseNav>({ level: 'threads' });

  const eventsById = useMemo(() => {
    const map = new Map<string, EventNode>();
    for (const ev of data.events) {
      map.set(ev.id, ev);
    }
    return map;
  }, [data.events]);

  const goBack = () => {
    if (nav.level === 'events') {
      setNav({ level: 'subtopics', threadId: nav.threadId });
    } else if (nav.level === 'subtopics') {
      setNav({ level: 'threads' });
    }
  };

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

  const renderThreads = () => (
    <div className="space-y-3">
      {sortedThreads.map(thread => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          stats={getThreadStats(thread, data)}
          onClick={() => setNav({ level: 'subtopics', threadId: thread.id })}
        />
      ))}
    </div>
  );

  const renderSubtopics = (threadId: string) => {
    const subtopics = data.subtopics
      .filter(s => s.thread_id === threadId)
      .sort((a, b) => a.order - b.order);

    if (subtopics.length === 0) {
      const threadEvents = data.events
        .filter(e => e.thread_id === threadId)
        .sort((a, b) => a.timestamp - b.timestamp);
      return (
        <div className="space-y-2">
          {threadEvents.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              onClick={() => onNodeClick(ev)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {subtopics.map(subtopic => {
          const eventCount = subtopic.event_ids.filter(id =>
            eventsById.has(id),
          ).length;
          return (
            <SubtopicCard
              key={subtopic.id}
              subtopic={subtopic}
              eventCount={eventCount}
              onClick={() =>
                setNav({
                  level: 'events',
                  threadId,
                  subtopicId: subtopic.id,
                })
              }
            />
          );
        })}
      </div>
    );
  };

  const renderEvents = (subtopicId: string) => {
    const subtopic = data.subtopics.find(s => s.id === subtopicId);
    if (!subtopic) return null;

    const events = subtopic.event_ids
      .map(id => eventsById.get(id))
      .filter((e): e is EventNode => e !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    return (
      <div className="space-y-2">
        {events.map(ev => (
          <EventCard key={ev.id} event={ev} onClick={() => onNodeClick(ev)} />
        ))}
      </div>
    );
  };

  const levelTitle = () => {
    if (nav.level === 'threads') return 'Causal Threads';
    if (nav.level === 'subtopics') {
      const thread = data.threads.find(t => t.id === nav.threadId);
      return thread?.name ?? 'Subtopics';
    }
    const subtopic = data.subtopics.find(s => s.id === nav.subtopicId);
    return subtopic?.name ?? 'Events';
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex-none px-5 pt-4 pb-2">
        <BreadcrumbNav nav={nav} data={data} onNavigate={setNav} />
        <div className="flex items-center gap-3">
          {nav.level !== 'threads' && (
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-900">{levelTitle()}</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 pb-5 pt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={
                nav.level === 'threads'
                  ? 'threads'
                  : nav.level === 'subtopics'
                    ? `st-${nav.threadId}`
                    : `ev-${nav.subtopicId}`
              }
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {nav.level === 'threads' && renderThreads()}
              {nav.level === 'subtopics' && renderSubtopics(nav.threadId)}
              {nav.level === 'events' && renderEvents(nav.subtopicId)}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
