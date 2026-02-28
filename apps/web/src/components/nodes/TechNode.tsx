import { memo, useState } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "reactflow";
import { Plus } from "lucide-react";
import { TechNodeData } from "../../types/diagram";
import { NODE_ICONS } from "../../lib/nodeIcons";

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  network:  { border: "#3b82f6", bg: "#3b82f610", text: "#60a5fa" },
  backend:  { border: "#22c55e", bg: "#22c55e10", text: "#4ade80" },
  devops:   { border: "#f97316", bg: "#f9731610", text: "#fb923c" },
  frontend: { border: "#a855f7", bg: "#a855f710", text: "#c084fc" },
  database: { border: "#eab308", bg: "#eab30810", text: "#facc15" },
  queue:    { border: "#ef4444", bg: "#ef444410", text: "#f87171" },
  custom:   { border: "#64748b", bg: "#64748b10", text: "#94a3b8" },
};

interface ExtendedProps extends NodeProps<TechNodeData> {
  data: TechNodeData & {
    _highlighted?: boolean;
    _dimmed?: boolean;
    _selected?: boolean;
    onQuickAdd?: (nodeId: string, direction: "top" | "left" | "bottom" | "right") => void;
  };
}

export const TechNode = memo(({ data, selected, id }: ExtendedProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cat = CATEGORY_COLORS[data.category] || CATEGORY_COLORS.custom;
  const color = data.customColor || cat.border;
  const bg = data.customColor ? data.customColor + "10" : cat.bg;
  const textColor = data.customColor ? data.customColor : cat.text;
  const icon = data.customIcon || NODE_ICONS[data.tech || ""] || NODE_ICONS[data.category] || "⬡";

  const hasEndpoints = data.endpoints && data.endpoints.length > 0;
  const hasTopics = data.topics && data.topics.length > 0;

  const isDimmed = data._dimmed && !data._highlighted;
  const isHighlighted = data._highlighted;

  const openComments = (data.comments || []).filter((c) => !c.resolved);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ padding: "12px" }}
    >
      <div
        className="relative min-w-[150px] h-full rounded-xl border-2 transition-all duration-200 cursor-default select-none"
        style={{
          borderColor: isHighlighted ? "#818cf8" : selected ? "#818cf8" : color,
          background: bg,
          opacity: isDimmed ? 0.25 : 1,
          boxShadow: isHighlighted
            ? `0 0 0 2px #818cf840, 0 0 20px ${color}30`
            : selected
            ? `0 0 0 2px #818cf840`
            : "none",
        }}
      >
      <NodeResizer
        minWidth={140}
        minHeight={60}
        isVisible={selected}
        lineStyle={{ borderColor: "#818cf855" }}
        handleStyle={{ background: "#818cf8", width: 7, height: 7, borderRadius: 2 }}
      />

      {/* All handles are type="source" so any handle can initiate a connection.
          connectionMode="loose" on the ReactFlow instance allows connecting to any handle. */}
      <Handle id="target-top"    type="source" position={Position.Top}    className="!w-2.5 !h-2.5 !border-slate-600" style={{ background: color }} />
      <Handle id="target-left"   type="source" position={Position.Left}   className="!w-2.5 !h-2.5 !border-slate-600" style={{ background: color }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-slate-600" style={{ background: color }} />
      <Handle id="source-right"  type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !border-slate-600" style={{ background: color }} />

      <div className="p-3 flex flex-col items-center gap-1.5">
        <span className="text-2xl">{icon}</span>
        <div className="text-center">
          <div className="text-white font-semibold text-sm leading-tight">{data.label}</div>
          {data.tech && (
            <div
              className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-mono"
              style={{ background: color + "22", color: textColor }}
            >
              {data.tech}
            </div>
          )}
        </div>

        {data.description && (
          <div className="text-slate-400 text-xs text-center leading-tight mt-0.5">
            {data.description}
          </div>
        )}

        {/* Endpoints badge */}
        {hasEndpoints && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1"
            style={{ background: "#22c55e15", color: "#4ade80", border: "1px solid #22c55e22" }}
          >
            <span>⚡</span>
            <span>{data.endpoints!.length} endpoint{data.endpoints!.length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Topics badge */}
        {hasTopics && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1"
            style={{ background: "#ef444415", color: "#f87171", border: "1px solid #ef444422" }}
          >
            <span>📨</span>
            <span>{data.topics!.length} topic{data.topics!.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Comment badge */}
      {openComments.length > 0 && (
        <div
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "#f59e0b", color: "#fff", boxShadow: "0 0 0 2px #0f1117" }}
        >
          {openComments.length}
        </div>
      )}
      </div>

      {/* Quick add buttons on hover */}
      {isHovered && data.onQuickAdd && (
        <>
          {/* Top */}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[QuickAdd] Top button clicked");
              data.onQuickAdd?.(id, "top");
            }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center transition-all pointer-events-auto"
            style={{ zIndex: 1000 }}
            title="Add connected node above"
          >
            <Plus size={14} />
          </button>

          {/* Left */}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[QuickAdd] Left button clicked");
              data.onQuickAdd?.(id, "left");
            }}
            className="absolute top-1/2 -translate-y-1/2 -left-2 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center transition-all pointer-events-auto"
            style={{ zIndex: 1000 }}
            title="Add connected node to the left"
          >
            <Plus size={14} />
          </button>

          {/* Bottom */}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[QuickAdd] Bottom button clicked");
              data.onQuickAdd?.(id, "bottom");
            }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center transition-all pointer-events-auto"
            style={{ zIndex: 1000 }}
            title="Add connected node below"
          >
            <Plus size={14} />
          </button>

          {/* Right */}
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[QuickAdd] Right button clicked");
              data.onQuickAdd?.(id, "right");
            }}
            className="absolute top-1/2 -translate-y-1/2 -right-2 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center transition-all pointer-events-auto"
            style={{ zIndex: 1000 }}
            title="Add connected node to the right"
          >
            <Plus size={14} />
          </button>
        </>
      )}
    </div>
  );
});

TechNode.displayName = "TechNode";
