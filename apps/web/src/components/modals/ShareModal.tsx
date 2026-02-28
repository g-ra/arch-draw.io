import { useState } from "react";
import { X, Copy, Check, Users } from "lucide-react";

interface Props {
  diagramId: string;
  diagramName: string;
  onClose: () => void;
}

export function ShareModal({ diagramId, diagramName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/editor/${diagramId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-2xl w-[500px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3148]">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Share Diagram</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Diagram Name</label>
            <div className="text-white font-medium">{diagramName}</div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Share Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#2d3148] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-[#0f1117] border border-[#2d3148] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium mb-1">Real-time Collaboration</div>
                <div className="text-slate-400 text-xs leading-relaxed">
                  Anyone with this link can view and edit the diagram in real-time. Changes are synced automatically via WebSocket.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-amber-400 text-lg">⚠️</div>
              <div className="flex-1">
                <div className="text-amber-400 text-sm font-medium mb-1">Public Access</div>
                <div className="text-amber-300/80 text-xs leading-relaxed">
                  This link provides full edit access. Share only with trusted collaborators.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2d3148]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
