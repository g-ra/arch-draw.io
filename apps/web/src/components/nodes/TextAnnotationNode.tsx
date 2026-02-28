import { memo, useCallback } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { TextAnnotationData } from "../../types/diagram";
import { useDiagramStore } from "../../stores/diagramStore";

export const TextAnnotationNode = memo(({ data, selected, id }: NodeProps<TextAnnotationData>) => {
  const { updateNodeData, viewMode } = useDiagramStore();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => updateNodeData(id, { text: e.target.value }),
    [id, updateNodeData]
  );

  const style: React.CSSProperties = {
    fontSize: data.fontSize || 16,
    fontWeight: data.fontWeight || "normal",
    color: data.color || "#e2e8f0",
    textAlign: (data.textAlign as React.CSSProperties["textAlign"]) || "left",
  };

  return (
    <div className="w-full h-full">
      <NodeResizer
        minWidth={80}
        minHeight={24}
        isVisible={selected}
        lineStyle={{ borderColor: "#818cf855" }}
        handleStyle={{ background: "#818cf8", width: 7, height: 7 }}
      />

      {viewMode ? (
        <p className="m-0 whitespace-pre-wrap leading-tight" style={style}>
          {data.text || ""}
        </p>
      ) : (
        <textarea
          value={data.text || ""}
          onChange={handleChange}
          placeholder="Text..."
          className="w-full h-full border-0 outline-none resize-none bg-transparent leading-tight placeholder-slate-600"
          style={style}
        />
      )}

      {/* Selection border only */}
      {selected && (
        <div
          className="absolute inset-0 rounded pointer-events-none"
          style={{ border: "1px dashed #818cf866" }}
        />
      )}
    </div>
  );
});

TextAnnotationNode.displayName = "TextAnnotationNode";
