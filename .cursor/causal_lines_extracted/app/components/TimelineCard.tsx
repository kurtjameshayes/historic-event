import { Calendar } from 'lucide-react';

interface TimelineCardProps {
  title: string;
  dateRange: string;
  color: 'orange' | 'purple';
  style?: React.CSSProperties;
  className?: string;
}

const colorBorder = {
  orange: 'border-orange-400 hover:border-orange-500 hover:shadow-orange-100',
  purple: 'border-purple-400 hover:border-purple-500 hover:shadow-purple-100',
};

const iconColor = {
  orange: 'text-orange-400',
  purple: 'text-purple-400',
};

const accentBar = {
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
};

export function TimelineCard({
  title,
  dateRange,
  color,
  style,
  className = '',
}: TimelineCardProps) {
  return (
    <div
      className={`absolute bg-white rounded-xl border-2 ${colorBorder[color]} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${className}`}
      style={{ height: 72, ...style }}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar[color]}`} />

      <div className="pl-4 pr-3 py-3 h-full flex flex-col justify-center">
        <h3 className="font-semibold text-gray-900 leading-snug text-sm line-clamp-2">
          {title}
        </h3>
        <div className={`flex items-center gap-1 mt-1 text-xs text-gray-500`}>
          <Calendar className={`w-3 h-3 flex-shrink-0 ${iconColor[color]}`} />
          <span className="truncate">{dateRange}</span>
        </div>
      </div>
    </div>
  );
}
