import { Calendar } from 'lucide-react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import type { Subtopic } from '../types';

export interface TimelineFlowNodeData {
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

export function TimelineFlowNode({ data, selected }: NodeProps<TimelineFlowNodeData>) {
  const dateRange =
    data.subtopic.date_range?.start && data.subtopic.date_range?.end
      ? formatDateRange(data.subtopic.date_range.start, data.subtopic.date_range.end)
      : null;

  const handleClass = "!w-2 !h-2 !opacity-0 !border-0 !bg-transparent";

  return (
    <div className="w-full h-full">
      <Handle type="target" id="target-top" position={Position.Top} isConnectable={false} className={handleClass} />
      <Handle type="target" id="target-bottom" position={Position.Bottom} isConnectable={false} className={handleClass} />
      <Handle type="target" id="target-left" position={Position.Left} isConnectable={false} className={handleClass} />
      <Handle type="target" id="target-right" position={Position.Right} isConnectable={false} className={handleClass} />
      <button
        type="button"
        onClick={data.onClick}
        className={`w-full h-full text-left border-2 rounded-lg px-3 py-2.5 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-1.5 overflow-hidden ${data.topicColor} ${selected ? 'ring-2 ring-indigo-200' : ''}`}
      >
        <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-3">
          {data.subtopic.name}
        </h4>
        {dateRange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{dateRange}</span>
          </div>
        )}
      </button>
      <Handle type="source" id="source-top" position={Position.Top} isConnectable={false} className={handleClass} />
      <Handle type="source" id="source-bottom" position={Position.Bottom} isConnectable={false} className={handleClass} />
      <Handle type="source" id="source-left" position={Position.Left} isConnectable={false} className={handleClass} />
      <Handle type="source" id="source-right" position={Position.Right} isConnectable={false} className={handleClass} />
    </div>
  );
}
