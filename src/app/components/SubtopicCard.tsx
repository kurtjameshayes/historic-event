import { Calendar } from 'lucide-react';
import type { Subtopic } from '../types';

interface SubtopicCardProps {
  subtopic: Subtopic;
  topicColor: string;
  onClick?: () => void;
}

export function SubtopicCard({ subtopic, topicColor, onClick }: SubtopicCardProps) {
  const eventCount = subtopic.event_ids?.length ?? 0;
  const dateRange =
    subtopic.date_range?.start && subtopic.date_range?.end
      ? subtopic.date_range.start === subtopic.date_range.end
        ? subtopic.date_range.start
        : `${subtopic.date_range.start} — ${subtopic.date_range.end}`
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full w-full text-left border-2 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow ${topicColor}`}
    >
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <h4 className="text-sm font-bold text-slate-900 mb-1 leading-tight shrink-0">
          {subtopic.name}
        </h4>
        {dateRange && (
          <div className="flex items-center gap-1 text-xs text-slate-600 mb-2 shrink-0">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{dateRange}</span>
          </div>
        )}
        {subtopic.description && (
          <p className="text-xs text-slate-600 flex-1 min-h-0 overflow-y-auto">
            {subtopic.description}
          </p>
        )}
        <div className="text-xs text-slate-500 shrink-0 mt-2">
          {eventCount} event{eventCount !== 1 ? 's' : ''}
        </div>
      </div>
    </button>
  );
}
