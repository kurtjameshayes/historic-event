import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import { DAGData, EventNode, CausalEdge, Subtopic, Thread } from '../types';
import { TimelineFlowNode, type TimelineFlowNodeData } from './TimelineFlowNode';

interface TimelineViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
  onEdgeClick: (edge: CausalEdge) => void;
}

interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThreadWithSubtopics extends Thread {
  subtopics: Subtopic[];
}

interface LaneLayout {
  thread: ThreadWithSubtopics;
  top: number;
  height: number;
  accentBg: string;
}

interface TimelineEdgeData {
  rawEdge: CausalEdge;
}

const nodeTypes = {
  timelineNode: TimelineFlowNode,
} satisfies NodeTypes;

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

function getAccentBgClass(color: string): string {
  if (!color) return 'bg-slate-400';
  if (color.includes('orange')) return 'bg-orange-500';
  if (color.includes('emerald') || color.includes('green')) return 'bg-emerald-500';
  if (color.includes('blue')) return 'bg-blue-500';
  if (color.includes('indigo')) return 'bg-indigo-500';
  if (color.includes('purple')) return 'bg-purple-500';
  if (color.includes('rose')) return 'bg-rose-500';
  if (color.includes('cyan')) return 'bg-cyan-500';
  return color.startsWith('bg-') ? color : `bg-${color}`;
}

function threadColorToStrokeHex(color: string): string {
  if (!color) return '#94a3b8';
  if (color.includes('orange')) return '#f97316';
  if (color.includes('emerald') || color.includes('green')) return '#10b981';
  if (color.includes('blue')) return '#3b82f6';
  if (color.includes('indigo')) return '#6366f1';
  if (color.includes('purple')) return '#a855f7';
  if (color.includes('rose')) return '#f43f5e';
  if (color.includes('cyan')) return '#06b6d4';
  return '#94a3b8';
}

function yearToX(year: number, startYear: number, totalYears: number, availW: number): number {
  const frac = Math.max(0, (year - startYear) / totalYears);
  return PAD_H + frac * availW;
}

function buildEventToSubtopicMap(events: EventNode[], allSubtopics: Subtopic[]): Map<string, Subtopic> {
  const map = new Map<string, Subtopic>();
  const byThread = new Map<string, Subtopic[]>();

  for (const st of allSubtopics) {
    const list = byThread.get(st.thread_id) ?? [];
    list.push(st);
    byThread.set(st.thread_id, list);
  }

  for (const list of byThread.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  for (const st of allSubtopics) {
    for (const eventId of st.event_ids ?? []) {
      map.set(eventId, st);
    }
  }

  for (const ev of events) {
    if (ev.subtopic_id && !map.has(ev.id)) {
      const byId = allSubtopics.find((candidate) => candidate.id === ev.subtopic_id);
      if (byId) map.set(ev.id, byId);
    }
  }

  for (const ev of events) {
    if (map.has(ev.id)) continue;
    const candidates = byThread.get(ev.thread_id) ?? [];
    if (candidates.length === 0) continue;

    let year: number | null = null;
    if (typeof ev.timestamp === 'number' && Number.isFinite(ev.timestamp) && ev.timestamp > 0) {
      year = new Date(ev.timestamp).getUTCFullYear();
    }
    if (year == null || !Number.isFinite(year)) {
      year = parseYear(ev.date ?? '');
    }

    if (year != null) {
      const containing = candidates.find((st) => {
        const start = parseYear(st.date_range?.start ?? '');
        const end = parseYear(st.date_range?.end ?? '');
        if (start == null) return false;
        return year! >= start && year! <= (end ?? start);
      });
      if (containing) {
        map.set(ev.id, containing);
        continue;
      }

      let best = candidates[0];
      let bestDistance = Infinity;
      for (const st of candidates) {
        const start = parseYear(st.date_range?.start ?? '');
        if (start == null) continue;
        const distance = Math.abs(start - year);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = st;
        }
      }
      map.set(ev.id, best);
      continue;
    }

    map.set(ev.id, candidates[0]);
  }

  return map;
}

function orderYearForEndpoint(ev: EventNode | undefined, st: Subtopic): number | null {
  if (ev) {
    if (typeof ev.timestamp === 'number' && Number.isFinite(ev.timestamp) && ev.timestamp > 0) {
      const y = new Date(ev.timestamp).getUTCFullYear();
      if (Number.isFinite(y)) return y;
    }
    const parsed = parseYear(ev.date ?? '');
    if (parsed != null) return parsed;
  }

  const start = parseYear(st.date_range?.start ?? '');
  const end = parseYear(st.date_range?.end ?? '');
  if (start != null && end != null) return (start + end) / 2;
  if (start != null) return start;
  if (end != null) return end;
  return null;
}

const CARD_HEIGHT = 100;
const ROW_HEIGHT = 114;
const CARD_MIN_WIDTH = 164;
const PAD_H = 16;
const MIN_TIMELINE_WIDTH = 1600;
const FRAME_PADDING_X = 32;
const LANE_HEADER_HEIGHT = 48;
const LANE_BOTTOM_PADDING = 24;
const LANE_GAP = 28;
const TOP_PADDING = 24;
const AXIS_HEIGHT = 58;
const SHOW_TIMELINE_GRAPH = true;
const SHOW_CAUSAL_EDGES = true;
const EDGE_ROUTE_OFFSET = 40;
const EDGE_ROUTE_RADIUS = 24;

type Side = 'top' | 'bottom' | 'left' | 'right';
const ALL_SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
const SIDE_NORMALS: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const ALIGNMENT_WEIGHT = 100;

function getHandlePoint(b: CardBounds, side: Side): { x: number; y: number } {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  switch (side) {
    case 'top': return { x: cx, y: b.y };
    case 'bottom': return { x: cx, y: b.y + b.height };
    case 'left': return { x: b.x, y: cy };
    case 'right': return { x: b.x + b.width, y: cy };
  }
}

function chooseBestHandles(
  src: CardBounds,
  tgt: CardBounds,
): { sourceHandle: string; targetHandle: string } {
  let bestScore = Infinity;
  let bestSrc: Side = 'right';
  let bestTgt: Side = 'left';

  for (const srcSide of ALL_SIDES) {
    const sp = getHandlePoint(src, srcSide);
    const sn = SIDE_NORMALS[srcSide];

    for (const tgtSide of ALL_SIDES) {
      const tp = getHandlePoint(tgt, tgtSide);
      const tn = SIDE_NORMALS[tgtSide];

      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ndx = dx / dist;
      const ndy = dy / dist;

      const exitAlign = sn.x * ndx + sn.y * ndy;
      const entryAlign = tn.x * -ndx + tn.y * -ndy;

      const score = dist
        + (1 - exitAlign) * ALIGNMENT_WEIGHT
        + (1 - entryAlign) * ALIGNMENT_WEIGHT;

      if (score < bestScore) {
        bestScore = score;
        bestSrc = srcSide;
        bestTgt = tgtSide;
      }
    }
  }

  return { sourceHandle: `source-${bestSrc}`, targetHandle: `target-${bestTgt}` };
}

export function TimelineView({ data, onNodeClick, onEdgeClick }: TimelineViewProps) {
  const [viewportWidth, setViewportWidth] = useState(1200);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setViewportWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setViewportWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const { sortedThreads, startYear, totalYears, majorTicks } = useMemo(() => {
    if (!data.threads.length) {
      return {
        sortedThreads: [] as ThreadWithSubtopics[],
        startYear: 1925,
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
      const start = parseYear(st.date_range?.start ?? '');
      const end = parseYear(st.date_range?.end ?? '');
      if (start != null) allYears.push(start);
      if (end != null) allYears.push(end);
    }

    const minYear = allYears.length ? Math.min(...allYears) : 1925;
    const maxYear = allYears.length ? Math.max(...allYears) : 2025;
    const span = Math.max(maxYear - minYear, 50);
    const startYear = minYear;
    const endYear = Math.min(2030, maxYear + Math.ceil(span * 0.1));
    const totalYears = endYear - startYear || 1;

    const earliestByThread = new Map<string, number>();
    for (const st of subtopics) {
      const year = parseYear(st.date_range?.start ?? '');
      if (year != null) {
        const cur = earliestByThread.get(st.thread_id);
        if (cur === undefined || year < cur) earliestByThread.set(st.thread_id, year);
      }
    }

    const sortedThreads = [...data.threads].sort((a, b) => {
      const aMin = earliestByThread.get(a.id) ?? 9999;
      const bMin = earliestByThread.get(b.id) ?? 9999;
      return aMin - bMin;
    });

    const step = totalYears <= 50 ? 10 : totalYears <= 100 ? 25 : 50;
    const ticks: number[] = [];
    for (let year = startYear; year <= endYear; year += step) ticks.push(year);
    if (ticks[ticks.length - 1] !== endYear) ticks.push(endYear);

    return {
      sortedThreads: sortedThreads.map((thread) => ({
        ...thread,
        subtopics: subtopicsByThread.get(thread.id) ?? [],
      })) as ThreadWithSubtopics[],
      startYear,
      totalYears,
      majorTicks: ticks,
    };
  }, [data]);

  const timelineWidth = Math.max(viewportWidth - FRAME_PADDING_X * 2, MIN_TIMELINE_WIDTH);
  const availW = timelineWidth - PAD_H * 2;

  function stackSubtopics(subtopics: Subtopic[]) {
    const items = subtopics
      .map((st) => {
        const sy = parseYear(st.date_range?.start ?? '') ?? startYear;
        const ey = parseYear(st.date_range?.end ?? '') ?? sy + 1;
        return { st, startYear: sy, endYear: ey };
      })
      .sort((a, b) => a.startYear - b.startYear);

    const withBounds = items.map(({ st, startYear: sy, endYear: ey }) => {
      const rawWidth = (Math.max(0, ey - sy) / totalYears) * availW;
      const x = yearToX(sy, startYear, totalYears, availW);
      const width = Math.max(CARD_MIN_WIDTH, rawWidth);
      return { st, x, width };
    });

    const rows: typeof withBounds[][] = [];
    for (const item of withBounds) {
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const overlaps = rows[i].some(
          (existing) => !(item.x >= existing.x + existing.width + 10 || existing.x >= item.x + item.width + 10),
        );
        if (!overlaps) {
          rows[i].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([item]);
    }

    const positioned: { st: Subtopic; bounds: CardBounds }[] = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      for (const { st, x, width } of rows[rowIndex]) {
        positioned.push({
          st,
          bounds: {
            x,
            y: rowIndex * ROW_HEIGHT + 12,
            width,
            height: CARD_HEIGHT,
          },
        });
      }
    }

    return { items: positioned, rowCount: rows.length };
  }

  const { laneLayouts, nodes, edges, flowPaneHeight, tickPositions } = useMemo(() => {
    const laneLayouts: LaneLayout[] = [];
    const nodes: Node<TimelineFlowNodeData>[] = [];
    const edges: Edge<TimelineEdgeData>[] = [];
    const boundsBySubtopic = new Map<string, CardBounds>();
    const threadBySubtopic = new Map<string, ThreadWithSubtopics>();
    const eventById = new Map<string, EventNode>();
    const allSubtopics = sortedThreads.flatMap((thread) => thread.subtopics ?? []);
    const eventToSubtopic = buildEventToSubtopicMap(data.events, allSubtopics);
    let yCursor = TOP_PADDING;

    for (const ev of data.events) {
      eventById.set(ev.id, ev);
    }

    for (const thread of sortedThreads) {
      const subtopics = thread.subtopics ?? [];
      if (subtopics.length === 0) continue;

      const { items, rowCount } = stackSubtopics(subtopics);
      const contentHeight = 12 + (rowCount > 0 ? (rowCount - 1) * ROW_HEIGHT + CARD_HEIGHT : 0) + 16;
      const laneHeight = LANE_HEADER_HEIGHT + contentHeight + LANE_BOTTOM_PADDING;

      laneLayouts.push({
        thread,
        top: yCursor,
        height: laneHeight,
        accentBg: getAccentBgClass(thread.color),
      });

      for (const { st, bounds } of items) {
        const graphBounds = {
          x: bounds.x,
          y: yCursor + LANE_HEADER_HEIGHT + bounds.y,
          width: bounds.width,
          height: CARD_HEIGHT,
        };
        boundsBySubtopic.set(st.id, graphBounds);
        threadBySubtopic.set(st.id, thread);

        const primaryEvent =
          (st.event_ids ?? []).map((id) => eventById.get(id)).find(Boolean) ??
          data.events.find((event) => event.subtopic_id === st.id);

        nodes.push({
          id: st.id,
          type: 'timelineNode',
          position: { x: graphBounds.x, y: graphBounds.y },
          draggable: false,
          selectable: true,
          data: {
            subtopic: st,
            topicColor: getBorderClass(thread.color),
            onClick: primaryEvent ? () => onNodeClick(primaryEvent) : undefined,
          },
          style: {
            width: graphBounds.width,
            height: CARD_HEIGHT,
            border: 'none',
            padding: 0,
            background: 'transparent',
          },
        });
      }

      yCursor += laneHeight + LANE_GAP;
    }

    const laneBottom = laneLayouts.length > 0 ? yCursor - LANE_GAP : TOP_PADDING;
    const flowPaneHeight = laneBottom + 12;

    for (const edge of data.edges) {
      const fromSt = eventToSubtopic.get(edge.from_event_id);
      const toSt = eventToSubtopic.get(edge.to_event_id);
      if (!fromSt || !toSt) continue;
      if (fromSt.id === toSt.id) continue;
      if (!boundsBySubtopic.has(fromSt.id) || !boundsBySubtopic.has(toSt.id)) continue;

      const fromEvent = eventById.get(edge.from_event_id);
      const toEvent = eventById.get(edge.to_event_id);
      const fromYear = orderYearForEndpoint(fromEvent, fromSt);
      const toYear = orderYearForEndpoint(toEvent, toSt);
      const timeBackward = fromYear != null && toYear != null && fromYear > toYear;
      const sourceSt = timeBackward ? toSt : fromSt;
      const targetSt = timeBackward ? fromSt : toSt;
      const sourceThread = threadBySubtopic.get(sourceSt.id);
      const targetThread = threadBySubtopic.get(targetSt.id);
      const strokeHex =
        sourceThread && targetThread && sourceThread.id === targetThread.id
          ? threadColorToStrokeHex(sourceThread.color)
          : threadColorToStrokeHex(sourceThread?.color ?? targetThread?.color ?? '');

      const srcBounds = boundsBySubtopic.get(sourceSt.id)!;
      const tgtBounds = boundsBySubtopic.get(targetSt.id)!;
      const { sourceHandle, targetHandle } = chooseBestHandles(srcBounds, tgtBounds);

      edges.push({
        id: edge.id,
        source: sourceSt.id,
        target: targetSt.id,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: edge.confidence >= 0.85,
        data: { rawEdge: edge },
        style: {
          stroke: strokeHex,
          strokeWidth: 1.5 + edge.confidence * 2,
        },
        pathOptions: {
          offset: EDGE_ROUTE_OFFSET,
          borderRadius: EDGE_ROUTE_RADIUS,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeHex,
          width: 20,
          height: 20,
        },
      });
    }

    const tickPositions = majorTicks.map((year) => ({
      year,
      x: yearToX(year, startYear, totalYears, availW),
    }));

    return { laneLayouts, nodes, edges, flowPaneHeight, tickPositions };
  }, [availW, data.edges, data.events, majorTicks, onNodeClick, sortedThreads, startYear, totalYears]);

  if (sortedThreads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-slate-500">No timeline data available</p>
      </div>
    );
  }

  if (!SHOW_TIMELINE_GRAPH) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
        <div className="max-w-md text-center px-6">
          <h3 className="text-lg font-semibold text-slate-900">Timeline graph hidden</h3>
          <p className="mt-2 text-sm text-slate-600">
            The timeline graph is currently hidden in the UI, but the underlying renderer remains in the codebase.
          </p>
        </div>
      </div>
    );
  }

  const totalHeight = flowPaneHeight + AXIS_HEIGHT;
  const visibleEdges = SHOW_CAUSAL_EDGES ? edges : [];

  return (
    <div className="w-full h-full min-h-[600px] overflow-auto bg-slate-50 rounded-2xl border border-slate-200">
      <div ref={viewportRef} className="p-8 pb-4">
        <div
          ref={frameRef}
          className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          style={{ width: timelineWidth, height: totalHeight }}
        >
          <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: flowPaneHeight }}>
            {tickPositions.map(({ year, x }) => (
              <div
                key={`grid-${year}`}
                className="absolute top-0 bottom-0 w-px bg-slate-100"
                style={{ left: x }}
              />
            ))}
            {laneLayouts.map(({ thread, top, height, accentBg }) => (
              <div
                key={`lane-${thread.id}`}
                className="absolute left-2 right-2 rounded-xl border border-slate-100 bg-slate-50/80"
                style={{ top, height }}
              >
                <div className="absolute inset-x-4 top-3 flex items-start gap-3">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${accentBg}`} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{thread.name}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{thread.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {nodes.map((node) => (
              <div
                key={`guide-${node.id}`}
                className="absolute w-px bg-slate-200"
                style={{
                  left: node.position.x,
                  top: node.position.y + CARD_HEIGHT,
                  height: Math.max(0, flowPaneHeight - (node.position.y + CARD_HEIGHT)),
                }}
              />
            ))}
          </div>

          <div className="absolute inset-x-0 top-0" style={{ height: flowPaneHeight }}>
            <ReactFlow
              nodes={nodes}
              edges={visibleEdges}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={{
                type: 'smoothstep',
                pathOptions: {
                  offset: EDGE_ROUTE_OFFSET,
                  borderRadius: EDGE_ROUTE_RADIUS,
                },
              }}
              onEdgeClick={(_, edge) => {
                if (edge.data?.rawEdge) onEdgeClick(edge.data.rawEdge);
              }}
              fitView={false}
              minZoom={1}
              maxZoom={1}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnDrag={false}
              panOnScroll={false}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              className="bg-transparent"
              style={{ background: 'transparent' }}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[58px] border-t border-slate-200 bg-white/95 pointer-events-none">
            <div
              className="absolute bottom-0 border-b-2 border-slate-300"
              style={{ left: PAD_H, right: PAD_H }}
            />
            {nodes.map((node) => (
              <div
                key={`axis-marker-${node.id}`}
                className="absolute bottom-0 w-0.5 h-4 bg-slate-400"
                data-axis-node-id={node.id}
                style={{ left: node.position.x }}
              />
            ))}
            {tickPositions.map(({ year, x }) => (
              <div
                key={year}
                className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                data-tick-year={year}
                style={{ left: x }}
              >
                <div className="text-xs font-semibold text-slate-600 whitespace-nowrap mb-0.5">
                  {year}
                </div>
                <div className="w-px h-3 bg-slate-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
