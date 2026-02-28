import { Node } from "reactflow";
import { X, Trash2 } from "lucide-react";
import { TextAnnotationData } from "../../types/diagram";
import { useDiagramStore } from "../../stores/diagramStore";

interface Props {
  node: Node<TextAnnotationData>;
  onClose: () => void;
}

const FONT_SIZES = [12, 14, 16, 20, 24, 32, 48];
const PRESET_COLORS = ["#e2e8f0", "#94a3b8", "#60a5fa", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fff"];

export function TextAnnotationPanel({ node, onClose }: Props) {
  const { updateNodeData, deleteNode } = useDiagramStore();
  const data = node.data;
  const update = (patch: Partial<TextAnnotationData>) => updateNodeData(node.id, patch);

  return (
    <div className="w-64 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3148]">
        <span className="text-white font-semibold text-sm">Text</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { deleteNode(node.id); onClose(); }} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Font size */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Font size</label>
          <div className="flex gap-1.5 flex-wrap">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => update({ fontSize: s })}
                className="px-2 py-1 rounded text-xs transition-all"
                style={
                  (data.fontSize || 16) === s
                    ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                    : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Font weight */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Weight</label>
          <div className="flex gap-2">
            {(["normal", "bold"] as const).map((w) => (
              <button
                key={w}
                onClick={() => update({ fontWeight: w })}
                className="flex-1 py-1.5 rounded text-xs capitalize transition-all"
                style={
                  (data.fontWeight || "normal") === w
                    ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544", fontWeight: w }
                    : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148", fontWeight: w }
                }
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Text align */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Align</label>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => update({ textAlign: a })}
                className="flex-1 py-1.5 rounded text-xs capitalize transition-all"
                style={
                  (data.textAlign || "left") === a
                    ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                    : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                }
              >
                {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  background: c,
                  outline: (data.color || "#e2e8f0") === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                  border: c === "#fff" ? "1px solid #2d3148" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
