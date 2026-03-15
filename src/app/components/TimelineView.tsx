import React, { useMemo } from 'react';
import { DAGData, EventNode, CausalEdge, Subtopic } from '../types';
import { SubtopicCard } from './SubtopicCard';

interface TimelineViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
  onEdgeClick: (edge: CausalEdge) => void;
}

function parseYear(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = /\b(\d{4})\b/.exec(dateStr.trim());
  return m ? parseInt(m[1], 10) : null;
}

function getBorderClass(color: string): string {
  if (!color) return 'border-slate-400';
  if (color.includes('orange')) return 'border-orange-500';
  if (color.includes('emerald') || color.includes('green')) return 'border-emerald-500';
  if (color.includes('blue')) return 'border-blue-500';
  if (color.includes('indigo')) return 'border-indigo-500';
  if (color.includes('purple')) return 'border-purple-500';
  if (color.includes('rose')) return 'border-rose-500';
  if (color.includes('cyan')) return 'border-cyan-500';
  return color.startsWith('border-') ? color : `border-${color}`;
}

export function TimelineView({ data, onNodeClick }: TimelineViewProps) {
  const { sortedThreads, startYear, endYear, totalYears, majorTicks } = useMemo(() => {
    if (!data.threads.length) {
      return {
        sortedThreads: [] as typeof data.threads,
        startYear: 1925,
        endYear: 2025,
        totalYears: 100,
        majorTicks: [1925, 1950, 1975, 2000, 2025],
      };
    }

    const subtopicsByThread = new Map<string, Subtopic[]>();
    for (const st of data.subtopics) {
      const list = subtopicsByThread.get(st.thread_id) ?? [];
      list.push(st);
      subtopicsByThread.set(st.thread_id, list);
    }
    for (const list of subtopicsByThread.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const allYears: number[] = [];
    for (const st of data.subtopics) {
      const sy = parseYear(st.date_range?.start ?? '');
      const ey = parseYear(st.date_range?.end ?? '');
      if (sy != null) allYears.push(sy);
      if (ey != null) allYears.push(ey);
    }
    const minY = allYears.length ? Math.min(...allYears) : 1925;
    const maxY = allYears.length ? Math.max(...allYears) : 2025;
    const span = Math.max(maxY - minY, 50);
    const start = Math.max(1920, minY - Math.floor(span * 0.1));
    const end = Math.min(2030, maxY + Math.ceil(span * 0.1));
    const total = end - start || 1;

    const earliestByThread = new Map<string, number>();
    for (const st of data.subtopics) {
      const y = parseYear(st.date_range?.start ?? '');
      if (y != null) {
        const cur = earliestByThread.get(st.thread_id);
        if (cur === undefined || y < cur) earliestByThread.set(st.thread_id, y);
      }
    }

    const sorted = [...data.threads].sort((a, b) => {
      const ta = earliestByThread.get(a.id) ?? 9999;
      const tb = earliestByThread.get(b.id) ?? 9999;
      return ta - tb;
    });

    const step = total <= 50 ? 10 : total <= 100 ? 25 : 50;
    const ticks: number[] = [];
    for (let y = start; y <= end; y += step) ticks.push(y);
    if (ticks.length > 0 && ticks[ticks.length - 1] !== end) ticks.push(end);

    return {
      sortedThreads: sorted.map((t) => ({
        ...t,
        subtopics: subtopicsByThread.get(t.id) ?? [],
      })),
      startYear: start,
      endYear: end,
      totalYears: total,
      majorTicks: ticks,
    };
  }, [data]);

  const getPositionPercent = (year: number) =>
    ((year - startYear) / totalYears) * 100;
  const getWidthPercent = (startY: number, endY: number) =>
    ((endY - startY) / totalYears) * 100;

  const getStackedSubtopics = (subtopics: Subtopic[]) => {
    const withYears = subtopics
      .map((st) => {
        const sy = parseYear(st.date_range?.start ?? '') ?? startYear;
        const ey = parseYear(st.date_range?.end ?? '') ?? startYear + 1;
        return { st, startYear: sy, endYear: ey };
      })
      .sort((a, b) => a.startYear - b.startYear);

    const minWidthPercent = 12;
    const withPos = withYears.map(({ st, startYear: sy, endYear: ey }) => {
      const left = getPositionPercent(sy);
      const w = Math.max(getWidthPercent(sy, ey), minWidthPercent);
      return { st, leftPercent: left, rightPercent: left + w };
    });

    const rows: typeof withPos[][] = [];
    for (const item of withPos) {
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const hasOverlap = rows[i].some(
          (ex) =>
            !(
              item.rightPercent + 2 <= ex.leftPercent ||
              item.leftPercent >= ex.rightPercent + 2
            )
        );
        if (!hasOverlap) {
          rows[i].push(item);
          rows[i].sort((a, b) => a.leftPercent - b.leftPercent);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([item]);
    }
    return rows;
  };

  if (sortedThreads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-slate-500">No timeline data available</p>
      </div>
    );
  }

  const MIN_WIDTH = 1400;
  const RIGHT_PADDING = 80;

  return (
    <div className="w-full h-full min-h-[600px] overflow-auto bg-slate-50 rounded-2xl border border-slate-200">
      <div
        className="p-8 pb-4"
        style={{ minWidth: MIN_WIDTH, paddingRight: RIGHT_PADDING }}
      >
        <div className="space-y-12 mb-8">
          {sortedThreads.map((thread) => {
            const subtopics = thread.subtopics ?? [];
            if (subtopics.length === 0) return null;

            const stackedRows = getStackedSubtopics(subtopics);
            const rowHeight = 100;
            const totalHeight = stackedRows.length * rowHeight;
            const borderClass = getBorderClass(thread.color);

            return (
              <div key={thread.id} className="relative">
                <div
                  className={`mb-4 pb-2 border-l-4 pl-4 ${borderClass} bg-white/50 rounded-r`}
                >
                  <h3 className="text-slate-900 font-bold">{thread.name}</h3>
                  <p className="text-sm text-slate-600">{thread.description}</p>
                </div>

                <div
                  className="relative border-l-4 border-slate-100 pl-8"
                  style={{ height: `${totalHeight}px` }}
                >
                  {stackedRows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="absolute left-8 right-0"
                      style={{
                        top: `${rowIndex * rowHeight}px`,
                        height: `${rowHeight - 12}px`,
                      }}
                    >
                      {row.map(({ st, leftPercent, rightPercent }) => {
                        const sy = parseYear(st.date_range?.start ?? '') ?? startYear;
                        const ey = parseYear(st.date_range?.end ?? '') ?? sy + 1;
                        const widthPercent = rightPercent - leftPercent;

                        return (
                          <div
                            key={st.id}
                            className="absolute h-full"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              minWidth: '200px',
                            }}
                          >
                            <SubtopicCard
                              subtopic={st}
                              topicColor={borderClass}
                              onClick={() => {
                                const ev = st.event_ids?.length
                                  ? data.events.find((e) => e.id === st.event_ids[0])
                                  : data.events.find((e) => e.subtopic_id === st.id);
                                if (ev) onNodeClick(ev);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-slate-50 z-10 pt-6 border-t-2 border-slate-300">
          <div className="relative h-16">
            {majorTicks.map((year) => {
              const position = getPositionPercent(year);
              return (
                <div
                  key={year}
                  className="absolute bottom-0 -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div className="text-sm font-semibold text-slate-600 whitespace-nowrap mb-1">
                    {year}
                  </div>
                  <div className="w-0.5 h-4 bg-slate-500" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
