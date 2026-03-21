import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TimelineCard } from './TimelineCard';

export interface TimelineEvent {
  id: string;
  title: string;
  startYear: number;
  endYear: number;
  row: number;
  dateRangeLabel?: string;
}

export interface TimelineConnection {
  fromId: string;
  toId: string;
}

interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TimelineSectionProps {
  title: string;
  description: string;
  color: 'orange' | 'purple';
  startYear: number;
  endYear: number;
  events: TimelineEvent[];
  connections: TimelineConnection[];
}

const CARD_HEIGHT = 72;
const ROW_HEIGHT = 114;
const CARD_MIN_WIDTH = 164;
const PAD_H = 16; // horizontal padding inside the container

function computeCardBounds(
  event: TimelineEvent,
  sectionStart: number,
  sectionEnd: number,
  containerWidth: number
): CardBounds {
  const span = sectionEnd - sectionStart;
  const availW = containerWidth - PAD_H * 2;
  const x = PAD_H + ((event.startYear - sectionStart) / span) * availW;
  const rawW = (Math.max(0, event.endYear - event.startYear) / span) * availW;
  const width = Math.max(CARD_MIN_WIDTH, rawW);
  const y = event.row * ROW_HEIGHT + 12;
  return { x, y, width, height: CARD_HEIGHT };
}

/**
 * Orthogonal flowchart arrow routing.
 *
 * Rules (matching standard flowchart tools like draw.io / Lucidchart):
 *   • Source exits from the CENTER of the most natural edge.
 *   • Target is entered at the CENTER of the most natural edge.
 *   • Every turn is 90°; no diagonal or curved segments.
 *   • The arrowhead tip lands exactly on the target card edge.
 */
function routeArrow(from: CardBounds, to: CardBounds): string {
  const r = (n: number) => Math.round(n * 10) / 10;

  const fromCx = r(from.x + from.width / 2);
  const fromCy = r(from.y + from.height / 2);
  const toCx   = r(to.x + to.width / 2);
  const toCy   = r(to.y + to.height / 2);

  // Named edge mid-points (source)
  const sRight  = { x: r(from.x + from.width), y: fromCy };
  const sLeft   = { x: r(from.x),              y: fromCy };
  const sBottom = { x: fromCx,                 y: r(from.y + from.height) };
  const sTop    = { x: fromCx,                 y: r(from.y) };

  // Named edge mid-points (target)
  const tRight  = { x: r(to.x + to.width), y: toCy };
  const tLeft   = { x: r(to.x),            y: toCy };
  const tBottom = { x: toCx,               y: r(to.y + to.height) };
  const tTop    = { x: toCx,               y: r(to.y) };

  // Gaps between bounding boxes
  const gapRight  = to.x - (from.x + from.width);   // > 0  → target is right of source
  const gapLeft   = from.x - (to.x + to.width);     // > 0  → target is left of source
  const gapBelow  = to.y - (from.y + from.height);  // > 0  → target is below source
  const gapAbove  = from.y - (to.y + to.height);    // > 0  → target is above source

  const seg = (...pts: number[]) => {
    const coords = [];
    for (let i = 0; i < pts.length; i += 2) coords.push(`${pts[i]} ${pts[i + 1]}`);
    return 'M ' + coords.join(' L ');
  };

  // ─── Case 1: Target clearly to the RIGHT ───────────────────────────────────
  if (gapRight > 10) {
    const { x: sx, y: sy } = sRight;
    const { x: ex, y: ey } = tLeft;
    if (Math.abs(sy - ey) < 2) return seg(sx, sy, ex, ey);           // straight
    const mx = r((sx + ex) / 2);
    return seg(sx, sy, mx, sy, mx, ey, ex, ey);                       // Z-shape
  }

  // ─── Case 2: Target clearly to the LEFT ────────────────────────────────────
  if (gapLeft > 10) {
    const { x: sx, y: sy } = sLeft;
    const { x: ex, y: ey } = tRight;
    if (Math.abs(sy - ey) < 2) return seg(sx, sy, ex, ey);
    const mx = r((sx + ex) / 2);
    return seg(sx, sy, mx, sy, mx, ey, ex, ey);
  }

  // ─── Cards overlap horizontally (concurrent periods) ───────────────────────
  // Sub-case: target is BELOW source
  if (gapBelow > -5) {
    if (toCx > sRight.x + 5) {
      // Target center is right of source right edge → exit right, enter top
      return seg(sRight.x, sRight.y, tTop.x, sRight.y, tTop.x, tTop.y);
    }
    if (toCx < sLeft.x - 5) {
      // Target center is left of source left edge → exit left, enter top
      return seg(sLeft.x, sLeft.y, tTop.x, sLeft.y, tTop.x, tTop.y);
    }
    // Vertically aligned → exit bottom, enter top
    if (Math.abs(fromCx - toCx) < 2) return seg(sBottom.x, sBottom.y, tTop.x, tTop.y);
    const my = r((sBottom.y + tTop.y) / 2);
    return seg(sBottom.x, sBottom.y, sBottom.x, my, tTop.x, my, tTop.x, tTop.y);
  }

  // Sub-case: target is ABOVE source
  if (gapAbove > -5) {
    if (toCx > sRight.x + 5) {
      // Target center is right of source right edge → exit right, enter bottom
      return seg(sRight.x, sRight.y, tBottom.x, sRight.y, tBottom.x, tBottom.y);
    }
    if (toCx < sLeft.x - 5) {
      // Target center is left of source left edge → exit left, enter bottom
      return seg(sLeft.x, sLeft.y, tBottom.x, sLeft.y, tBottom.x, tBottom.y);
    }
    // Vertically aligned → exit top, enter bottom
    if (Math.abs(fromCx - toCx) < 2) return seg(sTop.x, sTop.y, tBottom.x, tBottom.y);
    const my = r((sTop.y + tBottom.y) / 2);
    return seg(sTop.x, sTop.y, sTop.x, my, tBottom.x, my, tBottom.x, tBottom.y);
  }

  // ─── Fallback: completely overlapping cards ─────────────────────────────────
  return seg(fromCx, fromCy, toCx, toCy);
}

export function TimelineSection({
  title,
  description,
  color,
  startYear,
  endYear,
  events,
  connections,
}: TimelineSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const boundsMap = useMemo(() => {
    const m: Record<string, CardBounds> = {};
    for (const ev of events) {
      m[ev.id] = computeCardBounds(ev, startYear, endYear, containerWidth);
    }
    return m;
  }, [events, startYear, endYear, containerWidth]);

  const maxRow = events.reduce((mx, e) => Math.max(mx, e.row), 0);
  const contentH = 12 + maxRow * ROW_HEIGHT + CARD_HEIGHT + 16;

  const strokeColor = color === 'orange' ? '#f97316' : '#a855f7';
  const markerId = `arrowhead-${color}`;

  // Year axis
  const span = endYear - startYear;
  const step = span > 50 ? 10 : 5;
  const availW = containerWidth - PAD_H * 2;
  const yearMarkers: { year: number; x: number }[] = [];
  const firstMark = Math.ceil(startYear / step) * step;
  for (let y = firstMark; y <= endYear; y += step) {
    yearMarkers.push({ year: y, x: PAD_H + ((y - startYear) / span) * availW });
  }

  const accentBg = color === 'orange' ? 'bg-orange-500' : 'bg-purple-500';

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <div className={`w-1 h-12 ${accentBg} rounded-full flex-shrink-0 mt-0.5`} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>

      {/* Main diagram area */}
      <div
        ref={containerRef}
        className="relative bg-white border border-gray-200 rounded-2xl shadow-sm overflow-visible"
        style={{ padding: `0 0 0 0` }}
      >
        {/* Cards + arrows canvas */}
        <div className="relative" style={{ height: contentH }}>
          {/* ── SVG arrow layer (below cards) ─────────────────────────────── */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/*
                refX = markerWidth places the TIP of the polygon exactly at the
                path endpoint, so the arrowhead lands precisely on the card edge.
              */}
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <polygon points="0 0, 10 4, 0 8" fill={strokeColor} />
              </marker>
            </defs>

            {connections.map(conn => {
              const fb = boundsMap[conn.fromId];
              const tb = boundsMap[conn.toId];
              if (!fb || !tb) return null;
              const d = routeArrow(fb, tb);
              return (
                <path
                  key={`${conn.fromId}→${conn.toId}`}
                  d={d}
                  stroke={strokeColor}
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="square"
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </svg>

          {/* ── Cards (above SVG) ──────────────────────────────────────────── */}
          {events.map(ev => {
            const b = boundsMap[ev.id];
            const label = ev.dateRangeLabel ?? `${ev.startYear}\u2009–\u2009${ev.endYear}`;
            return (
              <TimelineCard
                key={ev.id}
                title={ev.title}
                dateRange={label}
                color={color}
                style={{ left: b.x, top: b.y, width: b.width }}
              />
            );
          })}
        </div>

        {/* ── Year axis ─────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-200 relative" style={{ height: 32 }}>
          {yearMarkers.map(({ year, x }) => (
            <div
              key={year}
              className="absolute flex flex-col items-center"
              style={{ left: x, top: 0, transform: 'translateX(-50%)' }}
            >
              <div className="w-px bg-gray-300" style={{ height: 6, marginTop: 0 }} />
              <span className="text-xs text-gray-400 mt-0.5 select-none">{year}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
