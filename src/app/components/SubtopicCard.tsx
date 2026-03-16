import { Calendar } from 'lucide-react';
import type { Subtopic } from '../types';

interface SubtopicCardProps {
  subtopic: Subtopic;
  topicColor: string;
  onClick?: () => void;
}

function formatDatePart(s: string): string {
  if (!s || typeof s !== 'string') return s;
  const t = s.trim();
  if (/^\d{4}s$/.test(t)) return t;
  const m = /\b(\d{4})\b/.exec(t);
  return m ? m[1] : t;
}

function formatDateRange(start: string, end: string): string {
  const a = formatDatePart(start);
  const b = formatDatePart(end);
  return a === b ? a : `${a} – ${b}`;
}

export function SubtopicCard({ subtopic, topicColor, onClick }: SubtopicCardProps) {
  const dateRange =
    subtopic.date_range?.start && subtopic.date_range?.end
      ? formatDateRange(subtopic.date_range.start, subtopic.date_range.end)
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full w-full min-w-0 text-left border-2 rounded-lg px-3 py-3 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center gap-1.5 ${topicColor}`}
    >
      <h4 className="text-sm font-bold text-slate-900 break-words leading-snug">
        {subtopic.name}
      </h4>
      {dateRange && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="break-words">{dateRange}</span>
        </div>
      )}
    </button>
  );
}
