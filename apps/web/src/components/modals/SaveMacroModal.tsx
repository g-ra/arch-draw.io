import { useState } from "react";
import { useDiagramStore } from "../../stores/diagramStore";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function SaveMacroModal({ onClose }: Props) {
  const [name, setName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const { saveMacro, selectedNodeIds } = useDiagramStore();

  const handleSave = () => {
    if (!name.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    saveMacro(name.trim(), tags);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-2xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Save as Macro</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Saving {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? "s" : ""} as a reusable snippet.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Auth Service Pattern"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="auth, backend, kafka"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            Save Macro
          </button>
        </div>
      </div>
    </div>
  );
}
