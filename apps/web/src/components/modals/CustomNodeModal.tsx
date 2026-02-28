import { useState } from "react";
import { X } from "lucide-react";
import { NodeCategory } from "../../types/diagram";
import { NodeTemplate, CATEGORIES } from "../../lib/nodeLibrary";
import { useDiagramStore } from "../../stores/diagramStore";

const PRESET_ICONS = ["🚀", "⚡", "🔧", "📦", "🌐", "🔒", "📊", "🎯", "🔗", "⚙️", "🏗️", "📡", "🤖", "💡", "🔐"];

interface Props {
  onClose: () => void;
}

export function CustomNodeModal({ onClose }: Props) {
  const { addCustomTemplate } = useDiagramStore();
  const [label, setLabel] = useState("");
  const [tech, setTech] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NodeCategory>("backend");
  const [icon, setIcon] = useState("🚀");
  const [color, setColor] = useState("#4f46e5");

  const handleCreate = () => {
    if (!label.trim()) return;
    const template: NodeTemplate = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      category,
      tech: tech || undefined,
      description: description || undefined,
      isCustom: true,
      customIcon: icon,
      customColor: color,
    };
    addCustomTemplate(template);
    onClose();
  };

  const cat = CATEGORIES.find((c) => c.id === category);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3148]">
          <h2 className="text-white font-semibold">Create Custom Node</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview */}
          <div className="flex justify-center">
            <div
              className="flex flex-col items-center gap-2 px-5 py-3 rounded-xl border-2 min-w-[120px]"
              style={{ borderColor: color, background: color + "10" }}
            >
              <span className="text-3xl">{icon || "⬡"}</span>
              <div className="text-center">
                <div className="text-white font-semibold text-sm">{label || "My Node"}</div>
                {tech && (
                  <div
                    className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{ background: color + "22", color }}
                  >
                    {tech}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Custom Service"
              className={inputCls}
            />
          </div>

          {/* Tech */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tech tag</label>
            <input
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              placeholder="e.g. rust, elixir..."
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this node do?"
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter(c => c.id !== "region").map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={
                    category === c.id
                      ? { background: c.color + "25", color: c.color, border: `1px solid ${c.color}55` }
                      : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all"
                  style={
                    icon === ic
                      ? { background: color + "25", outline: `1px solid ${color}55` }
                      : { background: "#0f1117" }
                  }
                >
                  {ic}
                </button>
              ))}
            </div>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Or type any emoji..."
              className={`${inputCls} text-center text-lg`}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border border-[#2d3148] bg-transparent"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={`${inputCls} flex-1`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-slate-400 hover:text-white border border-[#2d3148] text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!label.trim()}
            className="flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: color }}
          >
            Create Node
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500";
