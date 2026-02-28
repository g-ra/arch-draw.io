import { useEffect, useRef } from "react";
import { useDiagramStore } from "../stores/diagramStore";

interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
  onSaveMacro: () => void;
}

export function NodeContextMenu({ nodeId, x, y, onClose, onSaveMacro }: Props) {
  const { nodes, setNodeZIndex } = useDiagramStore();
  const ref = useRef<HTMLDivElement>(null);

  const currentZ = (nodes.find((n) => n.id === nodeId)?.data?.zIndex ?? 10) as number;
  const techNodes = nodes.filter((n) => n.type !== "regionGroup");
  const maxZ = techNodes.length > 0
    ? Math.max(...techNodes.map((n) => (n.data?.zIndex ?? 10) as number))
    : 10;
  const minZ = 1;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const zActions = [
    {
      label: "Bring to Front",
      disabled: currentZ >= maxZ,
      onClick: () => { setNodeZIndex(nodeId, maxZ + 1); onClose(); },
    },
    {
      label: "Bring Forward",
      disabled: currentZ >= maxZ,
      onClick: () => { setNodeZIndex(nodeId, currentZ + 1); onClose(); },
    },
    {
      label: "Send Backward",
      disabled: currentZ <= minZ,
      onClick: () => { setNodeZIndex(nodeId, Math.max(minZ, currentZ - 1)); onClose(); },
    },
    {
      label: "Send to Back",
      disabled: currentZ <= minZ,
      onClick: () => { setNodeZIndex(nodeId, minZ); onClose(); },
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[1000] bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-1.5 text-xs text-slate-500 font-medium uppercase tracking-wide border-b border-[#2d3148]">
        Layer order
      </div>
      {zActions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          disabled={a.disabled}
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-[#2d3148] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {a.label}
        </button>
      ))}
      <div className="border-t border-[#2d3148] mt-1 pt-1">
        <button
          onClick={() => { onSaveMacro(); onClose(); }}
          className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-[#2d3148] hover:text-indigo-300 transition-colors"
        >
          Save as Macro...
        </button>
      </div>
    </div>
  );
}
