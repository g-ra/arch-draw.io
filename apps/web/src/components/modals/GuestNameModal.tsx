import { useState } from "react";
import { Users } from "lucide-react";

interface Props {
  onSubmit: (name: string) => void;
}

export function GuestNameModal({ onSubmit }: Props) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-2xl w-[400px] max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#2d3148]">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Users size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Join as Guest</h2>
            <p className="text-xs text-slate-400">Enter your name to collaborate</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                autoFocus
                className="w-full px-3 py-2 bg-[#0f1117] border border-[#2d3148] rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
              <div className="text-indigo-400 text-xs leading-relaxed">
                You're joining as a guest. Your changes will be synced in real-time with other collaborators.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Join Diagram
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
