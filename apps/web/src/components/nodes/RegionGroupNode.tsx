import { memo } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { TechNodeData } from "../../types/diagram";

export const RegionGroupNode = memo(({ data, selected }: NodeProps<TechNodeData>) => {
  const color = data.regionColor || "#3b82f6";
  const name = data.regionName || data.label || "Region";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineStyle={{ borderColor: color } as React.CSSProperties}
        handleStyle={{ background: color } as React.CSSProperties}
      />

      {/* Visible border — pointer-events: none so clicks pass through to nodes inside */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          border: `2px dashed ${color}55`,
          background: `${color}07`,
          pointerEvents: "none",
        }}
      />

      {/* Label — pointer-events: all so clicking the label selects the region */}
      <div
        className="absolute -top-3.5 left-4 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none"
        style={{
          background: color + "22",
          color,
          border: `1px solid ${color}44`,
          pointerEvents: "all",
        }}
      >
        {data.icon || "🌍"} {name}
      </div>

      {data.description && (
        <div
          className="absolute bottom-2 right-3 text-xs select-none"
          style={{ color: color + "77", pointerEvents: "none" }}
        >
          {data.description}
        </div>
      )}
    </div>
  );
});

RegionGroupNode.displayName = "RegionGroupNode";
