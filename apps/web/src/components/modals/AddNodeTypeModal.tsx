import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (data: {
    label: string;
    category: string;
    tech?: string;
    description?: string;
    icon?: string;
    color?: string;
  }) => void;
}

const CATEGORIES = [
  { id: "network", label: "Network", color: "#3b82f6" },
  { id: "backend", label: "Backend", color: "#22c55e" },
  { id: "database", label: "Database", color: "#eab308" },
  { id: "queue", label: "Queue", color: "#ef4444" },
  { id: "devops", label: "DevOps", color: "#f97316" },
  { id: "frontend", label: "Frontend", color: "#a855f7" },
  { id: "custom", label: "Custom", color: "#64748b" },
];

export function AddNodeTypeModal({ onClose, onSubmit }: Props) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("custom");
  const [tech, setTech] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#64748b");

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSubmit({
      label: label.trim(),
      category,
      tech: tech.trim() || undefined,
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      color: color || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Add Node Type</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Label *</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Redis Cache"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                const cat = CATEGORIES.find((c) => c.id === e.target.value);
                if (cat) setColor(cat.color);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tech</label>
            <input
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              placeholder="e.g., redis"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., In-memory cache"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Icon (emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g., 🗄️"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#64748b"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
}
