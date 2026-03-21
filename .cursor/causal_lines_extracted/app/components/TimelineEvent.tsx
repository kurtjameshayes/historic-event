import { Calendar, ArrowRight } from 'lucide-react';

interface TimelineEventProps {
  title: string;
  dateRange: string;
  showArrow?: boolean;
}

export function TimelineEvent({ title, dateRange, showArrow = false }: TimelineEventProps) {
  return (
    <div className="relative">
      <div className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 p-6 max-w-[280px]">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{dateRange}</span>
          </div>
        </div>
        
        {/* Subtle accent on left edge */}
        <div className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full" />
      </div>
      
      {/* Arrow connector */}
      {showArrow && (
        <div className="absolute -right-8 top-1/2 -translate-y-1/2 z-10">
          <div className="flex items-center gap-1">
            <div className="w-12 h-[2px] bg-gradient-to-r from-blue-500 to-blue-400" />
            <ArrowRight className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      )}
    </div>
  );
}
