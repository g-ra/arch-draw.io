import { memo, useRef, useEffect, useCallback } from "react";
import { NodeProps, NodeResizer } from "reactflow";
import { StickyNoteData } from "../../types/diagram";
import { useDiagramStore } from "../../stores/diagramStore";

export const STICKY_COLORS: Record<string, { bg: string; border: string; text: string; name: string }> = {
  yellow: { bg: "#fef9c3", border: "#facc15", text: "#713f12", name: "Yellow" },
  green:  { bg: "#dcfce7", border: "#86efac", text: "#14532d", name: "Green"  },
  blue:   { bg: "#dbeafe", border: "#93c5fd", text: "#1e3a5f", name: "Blue"   },
  pink:   { bg: "#fce7f3", border: "#f9a8d4", text: "#831843", name: "Pink"   },
  purple: { bg: "#f3e8ff", border: "#d8b4fe", text: "#581c87", name: "Purple" },
  orange: { bg: "#fed7aa", border: "#fb923c", text: "#7c2d12", name: "Orange" },
  dark:   { bg: "#1e2130", border: "#4f46e5", text: "#e2e8f0", name: "Dark"   },
};

export const StickyNoteNode = memo(({ data, selected, id }: NodeProps<StickyNoteData>) => {
  const color = STICKY_COLORS[data.colorName] || STICKY_COLORS.yellow;
  const { updateNodeData, viewMode } = useDiagramStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [data.text]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <div
      className="w-full h-full flex flex-col rounded-lg shadow-md overflow-hidden"
      style={{
        background: color.bg,
        border: `2px solid ${selected ? "#818cf8" : color.border}`,
        outline: selected ? "2px solid #818cf840" : "none",
        outlineOffset: "2px",
      }}
    >
      <NodeResizer
        minWidth={140}
        minHeight={80}
        isVisible={selected}
        lineStyle={{ borderColor: "#818cf8" }}
        handleStyle={{ background: "#818cf8", width: 8, height: 8 }}
      />

      {/* Color strip */}
      <div className="h-1.5 flex-shrink-0" style={{ background: color.border }} />

      {/* Text area */}
      <div className="flex-1 p-3 overflow-hidden">
        {viewMode ? (
          <p
            className="whitespace-pre-wrap leading-snug m-0"
            style={{ color: color.text, fontSize: data.fontSize || 14 }}
          >
            {data.text || ""}
          </p>
        ) : (
          <textarea
            ref={textareaRef}
            value={data.text || ""}
            onChange={handleChange}
            placeholder="Write a note..."
            className="w-full h-full border-0 outline-none resize-none bg-transparent leading-snug placeholder-opacity-40"
            style={{ color: color.text, fontSize: data.fontSize || 14, minHeight: 60 }}
          />
        )}
      </div>

      {/* Author / footer */}
      {data.author && (
        <div
          className="px-3 pb-1.5 text-xs opacity-50 flex-shrink-0"
          style={{ color: color.text }}
        >
          — {data.author}
        </div>
      )}
    </div>
  );
});

StickyNoteNode.displayName = "StickyNoteNode";
