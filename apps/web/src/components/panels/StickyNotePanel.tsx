import { Node } from "reactflow";
import { X, Trash2 } from "lucide-react";
import { StickyNoteData } from "../../types/diagram";
import { useDiagramStore } from "../../stores/diagramStore";
import { STICKY_COLORS } from "../nodes/StickyNoteNode";

interface Props {
  node: Node<StickyNoteData>;
  onClose: () => void;
}

const FONT_SIZES = [11, 13, 15, 18, 22, 28];

export function StickyNotePanel({ node, onClose }: Props) {
  const { updateNodeData, deleteNode } = useDiagramStore();
  const data = node.data;
  const update = (patch: Partial<StickyNoteData>) => updateNodeData(node.id, patch);

  return (
    <div className="w-64 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3148]">
        <span className="text-white font-semibold text-sm">Sticky Note</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { deleteNode(node.id); onClose(); }} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Color */}
        <div>
          <label className="block text-xs text-slate-500 mb-2">Color</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(STICKY_COLORS).map(([key, c]) => (
              <button
                key={key}
                onClick={() => update({ colorName: key })}
                className="h-8 rounded-lg transition-all"
                style={{
                  background: c.bg,
                  border: `2px solid ${data.colorName === key ? "#818cf8" : c.border}`,
                  outline: data.colorName === key ? "2px solid #818cf840" : "none",
                  outlineOffset: "2px",
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>

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
                  (data.fontSize || 14) === s
                    ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                    : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                }
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        {/* Author */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Author</label>
          <input
            value={data.author || ""}
            onChange={(e) => update({ author: e.target.value })}
            placeholder="Your name..."
            className="w-full px-2.5 py-1.5 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
