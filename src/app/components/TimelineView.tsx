import React, { useMemo } from 'react';
import { DAGData, EventNode, CausalEdge, Subtopic } from '../types';
import { SubtopicCard } from './SubtopicCard';

interface TimelineViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
  onEdgeClick: (edge: CausalEdge) => void;
}

interface EdgePath {
  edge: CausalEdge;
  pathD: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

function parseYear(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const t = dateStr.trim();
  const decadeMatch = /^(\d{4})s$/.exec(t);
  if (decadeMatch) return parseInt(decadeMatch[1], 10);
  const m = /(\d{4})/.exec(t);
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

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 56;
const THREAD_GAP = 48;
const TIMELINE_LEFT = 64;
const TIMELINE_WIDTH = 1224;

export function TimelineView({ data, onNodeClick, onEdgeClick }: TimelineViewProps) {
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

    let subtopics = data.subtopics;
    if (subtopics.length === 0 && data.events.length > 0) {
      const eventsByThread = new Map<string, EventNode[]>();
      for (const ev of data.events) {
        const list = eventsByThread.get(ev.thread_id) ?? [];
        list.push(ev);
        eventsByThread.set(ev.thread_id, list);
      }
      for (const list of eventsByThread.values()) {
        list.sort((a, b) => a.timestamp - b.timestamp);
      }
      subtopics = [];
      for (const [threadId, evs] of eventsByThread) {
        for (let i = 0; i < evs.length; i += 3) {
          const chunk = evs.slice(i, i + 3);
          const dates = chunk.map((e) => e.date).filter(Boolean);
          const start = dates[0] ?? '';
          const end = dates[dates.length - 1] ?? start;
          subtopics.push({
            id: `syn-${threadId}-${i}`,
            thread_id: threadId,
            name: chunk[0]?.title ?? `Events ${i + 1}`,
            description: '',
            event_ids: chunk.map((e) => e.id),
            date_range: { start, end },
            order: i,
          });
        }
      }
    }

    const subtopicsByThread = new Map<string, Subtopic[]>();
    for (const st of subtopics) {
      const list = subtopicsByThread.get(st.thread_id) ?? [];
      list.push(st);
      subtopicsByThread.set(st.thread_id, list);
    }
    for (const list of subtopicsByThread.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const allYears: number[] = [];
    for (const st of subtopics) {
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
    for (const st of subtopics) {
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

  const { edgePaths, totalContentHeight } = useMemo(() => {
    const allSubtopics = sortedThreads.flatMap((t) => t.subtopics ?? []);
    const eventToSubtopic = new Map<string, Subtopic>();
    for (const st of allSubtopics) {
      for (const eid of st.event_ids ?? []) {
        eventToSubtopic.set(eid, st);
      }
    }
    for (const ev of data.events) {
      if (ev.subtopic_id && !eventToSubtopic.has(ev.id)) {
        const st = allSubtopics.find((s) => s.id === ev.subtopic_id);
        if (st) eventToSubtopic.set(ev.id, st);
      }
    }

    const subtopicPositions = new Map<
      string,
      { x: number; y: number }
    >();
    let threadTop = 0;
    for (const thread of sortedThreads) {
      const subtopics = thread.subtopics ?? [];
      if (subtopics.length === 0) {
        threadTop += HEADER_HEIGHT + THREAD_GAP;
        continue;
      }
      const stacked = getStackedSubtopicsForEdges(
        subtopics,
        startYear,
        endYear,
        totalYears,
      );
      const totalHeight = stacked.length * ROW_HEIGHT;
      threadTop += HEADER_HEIGHT;
      for (let ri = 0; ri < stacked.length; ri++) {
        const row = stacked[ri];
        for (const { st, leftPercent, widthPercent } of row) {
          const cx =
            TIMELINE_LEFT +
            (TIMELINE_WIDTH * (leftPercent + widthPercent / 2)) / 100;
          const cy = threadTop + ri * ROW_HEIGHT + ROW_HEIGHT / 2;
          subtopicPositions.set(st.id, { x: cx, y: cy });
        }
      }
      threadTop += totalHeight + THREAD_GAP;
    }

    const paths: EdgePath[] = [];
    for (const edge of data.edges ?? []) {
      const fromSt = eventToSubtopic.get(edge.from_event_id);
      const toSt = eventToSubtopic.get(edge.to_event_id);
      if (!fromSt || !toSt) continue;
      const fromPos = subtopicPositions.get(fromSt.id);
      const toPos = subtopicPositions.get(toSt.id);
      if (!fromPos || !toPos) continue;
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = 14;
      const fromX = fromPos.x + (dx / dist) * offset;
      const fromY = fromPos.y + (dy / dist) * offset;
      const toX = toPos.x - (dx / dist) * offset;
      const toY = toPos.y - (dy / dist) * offset;
      const pathD = `M ${fromX} ${fromY} L ${toX} ${toY}`;
      paths.push({ edge, pathD, fromX, fromY, toX, toY });
    }
    return {
      edgePaths: paths,
      totalContentHeight: threadTop,
    };
  }, [
    data.edges,
    data.events,
    data.subtopics,
    sortedThreads,
    startYear,
    endYear,
    totalYears,
  ]);

  function getStackedSubtopicsForEdges(
    subtopics: Subtopic[],
    startYear: number,
    endYear: number,
    totalYears: number,
  ) {
    const getPos = (y: number) => ((y - startYear) / totalYears) * 100;
    const getW = (sy: number, ey: number) =>
      ((ey - sy) / totalYears) * 100;
    const withYears = subtopics
      .map((st) => {
        const sy =
          parseYear(st.date_range?.start ?? "") ?? startYear;
        const ey =
          parseYear(st.date_range?.end ?? "") ?? startYear + 1;
        return { st, startYear: sy, endYear: ey };
      })
      .sort((a, b) => a.startYear - b.startYear);
    const minWidthPercent = 12;
    const withPos = withYears.map(({ st, startYear: sy, endYear: ey }) => {
      const left = getPos(sy);
      const w = Math.max(getW(sy, ey), minWidthPercent);
      return { st, leftPercent: left, widthPercent: w };
    });
    const rows: typeof withPos[][] = [];
    for (const item of withPos) {
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const hasOverlap = rows[i].some(
          (ex) =>
            !(
              item.leftPercent + item.widthPercent + 2 <= ex.leftPercent ||
              item.leftPercent >= ex.leftPercent + ex.widthPercent + 2
            ),
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
  }

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
        <div className="space-y-12 mb-8 relative">
          {edgePaths.length > 0 && (
            <svg
              className="absolute left-0 top-0"
              width={MIN_WIDTH}
              height={totalContentHeight}
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="currentColor"
                    className="text-indigo-400"
                  />
                </marker>
              </defs>
              {edgePaths.map(({ edge, pathD }) => (
                <path
                  key={edge.id}
                  d={pathD}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-indigo-300 hover:text-indigo-500 cursor-pointer transition-colors"
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead)"
                  style={{ pointerEvents: 'stroke' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdgeClick(edge);
                  }}
                />
              ))}
            </svg>
          )}
          {sortedThreads.map((thread) => {
            const subtopics = thread.subtopics ?? [];
            if (subtopics.length === 0) return null;

            const stackedRows = getStackedSubtopics(subtopics);
            const totalHeight = stackedRows.length * ROW_HEIGHT;
            const borderClass = getBorderClass(thread.color);

            return (
              <div key={thread.id} className="relative">
                <div
                  className={`mb-4 pb-2 border-l-4 pl-4 ${borderClass} bg-white/50 rounded-r min-w-0 overflow-hidden`}
                >
                  <h3 className="text-slate-900 font-bold break-words">{thread.name}</h3>
                  <p className="text-sm text-slate-600 break-words">{thread.description}</p>
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
                        top: `${rowIndex * ROW_HEIGHT}px`,
                        height: `${ROW_HEIGHT - 8}px`,
                      }}
                    >
                      {row.map(({ st, leftPercent, rightPercent }) => {
                        const sy = parseYear(st.date_range?.start ?? '') ?? startYear;
                        const ey = parseYear(st.date_range?.end ?? '') ?? sy + 1;
                        const clampedLeft = Math.max(0, leftPercent);
                        const clampedRight = Math.min(100, rightPercent);
                        const widthPercent = Math.max(12, clampedRight - clampedLeft);

                        return (
                          <div
                            key={st.id}
                            className="absolute h-full min-w-0"
                            style={{
                              left: `${clampedLeft}%`,
                              width: `${widthPercent}%`,
                              minWidth: '120px',
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

        <div className="sticky bottom-0 bg-slate-50 z-10 pt-6 border-t-2 border-slate-300 pl-8">
          <div className="relative h-12 border-b-2 border-slate-300">
            <div className="absolute inset-0 border-b border-slate-200" />
            {majorTicks.map((year) => {
              const position = getPositionPercent(year);
              return (
                <div
                  key={year}
                  className="absolute bottom-0 -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div className="text-xs font-semibold text-slate-600 whitespace-nowrap mb-0.5">
                    {year}
                  </div>
                  <div className="w-px h-3 bg-slate-500 mx-auto" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
