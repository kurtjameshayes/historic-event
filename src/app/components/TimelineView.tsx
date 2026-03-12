import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  MarkerType,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DAGData, EventNode, CausalEdge } from '../types';
import clsx from 'clsx';
import { Calendar } from 'lucide-react';

interface TimelineViewProps {
  data: DAGData;
  onNodeClick: (node: EventNode) => void;
  onEdgeClick: (edge: CausalEdge) => void;
}

// Custom Event Node
function EventNodeComponent({ data, isConnectable }: NodeProps) {
  const event = data.event as EventNode;
  const isTarget = event.is_target;
  const colorClass = data.colorClass as string;

  return (
    <div 
      className={clsx(
        "px-4 py-3 rounded-xl shadow-md border-2 bg-white w-64 transition-transform hover:scale-105 cursor-pointer",
        isTarget ? "border-red-500 shadow-red-200" : colorClass.split(' ')[1] // Gets the border-color from thread color
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-2 h-2 !bg-slate-400" />
      
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {event.date}
          </span>
          {isTarget && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-700 uppercase">
              Target
            </span>
          )}
        </div>
        <h4 className="text-sm font-bold text-slate-800 leading-tight">
          {event.title}
        </h4>
        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
          {event.description}
        </p>
      </div>

      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-2 h-2 !bg-slate-400" />
    </div>
  );
}

const nodeTypes = {
  eventNode: EventNodeComponent
};

export function TimelineView({ data, onNodeClick, onEdgeClick }: TimelineViewProps) {
  
  const { nodes, edges } = useMemo(() => {
    if (!data.events.length) return { nodes: [], edges: [] };

    const minTime = Math.min(...data.events.map(e => e.timestamp));
    const maxTime = Math.max(...data.events.map(e => e.timestamp));
    const timeSpan = maxTime - minTime || 1; // avoid division by zero
    
    // Timeline width - generous horizontal space
    const TIMELINE_WIDTH = 1500;
    const LANE_HEIGHT = 160;
    const X_PADDING = 100;
    const Y_PADDING = 50;

    const rfNodes: Node[] = data.events.map((ev) => {
      const threadIndex = data.threads.findIndex(t => t.id === ev.thread_id);
      const thread = data.threads[threadIndex];
      
      // Calculate X based on time
      const timeRatio = (ev.timestamp - minTime) / timeSpan;
      const x = X_PADDING + (timeRatio * TIMELINE_WIDTH);
      
      // Calculate Y based on thread lane
      // If it's a target event, center it vertically
      const y = ev.is_target 
        ? Y_PADDING + (data.threads.length * LANE_HEIGHT) / 2 - 40
        : Y_PADDING + (threadIndex * LANE_HEIGHT);

      return {
        id: ev.id,
        type: 'eventNode',
        position: { x, y },
        data: { 
          event: ev,
          colorClass: thread ? thread.color : 'border-slate-300'
        }
      };
    });

    const rfEdges: Edge[] = data.edges.map(edge => ({
      id: edge.id,
      source: edge.from_event_id,
      target: edge.to_event_id,
      animated: true,
      style: { strokeWidth: 1.5 + (edge.confidence * 2) }, // Thicker lines for higher confidence
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#94a3b8',
      },
      data: { edgeData: edge },
      className: "stroke-slate-400 hover:stroke-indigo-500 transition-colors cursor-pointer"
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [data]);

  return (
    <div className="w-full h-full min-h-[600px] relative bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      {/* Thread Lanes Background */}
      <div className="absolute inset-0 pointer-events-none z-0 flex flex-col pt-[50px]">
        {data.threads.map((thread, i) => (
          <div 
            key={thread.id} 
            className="w-full border-b border-slate-200/50 bg-slate-100/30 relative"
            style={{ height: '160px' }}
          >
            <div className="absolute left-4 top-4 px-2 py-1 rounded bg-white shadow-sm border border-slate-200 text-xs font-bold text-slate-500 opacity-60">
              {thread.name}
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 z-10">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeClick(node.data.event as EventNode)}
          onEdgeClick={(_, edge) => onEdgeClick(edge.data?.edgeData as CausalEdge)}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls showInteractive={false} className="bg-white border-slate-200 rounded-lg shadow-sm" />
        </ReactFlow>
      </div>
    </div>
  );
}
