import { useDiagramStore } from "../stores/diagramStore";

const ALIGN_BUTTONS = [
  { key: "left",    icon: "⬢", title: "Align left",          label: "⇤" },
  { key: "centerH", icon: "⬡", title: "Center horizontally", label: "↔" },
  { key: "right",   icon: "⬢", title: "Align right",         label: "⇥" },
  { key: "top",     icon: "⬡", title: "Align top",           label: "⇡" },
  { key: "centerV", icon: "⬡", title: "Center vertically",   label: "↕" },
  { key: "bottom",  icon: "⬡", title: "Align bottom",        label: "⇣" },
] as const;

interface Props {
  count: number;
  onSaveMacro: () => void;
}

export function AlignmentToolbar({ count, onSaveMacro }: Props) {
  const { alignNodes, distributeNodes, bringSelectionToFront, sendSelectionToBack } = useDiagramStore();

  return (
    <div className="flex items-center gap-1.5 bg-[#1a1d2e] border border-[#2d3148] rounded-xl px-3 py-1.5 shadow-xl">
      <span className="text-xs text-slate-500 mr-1">{count} selected</span>
      <div className="w-px h-4 bg-[#2d3148]" />

      {/* Align */}
      <span className="text-xs text-slate-600 ml-1">Align</span>
      {ALIGN_BUTTONS.map((btn) => (
        <button
          key={btn.key}
          onClick={() => alignNodes(btn.key)}
          title={btn.title}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors font-mono"
        >
          {btn.label}
        </button>
      ))}

      {/* Distribute (only if 3+) */}
      {count >= 3 && (
        <>
          <div className="w-px h-4 bg-[#2d3148] mx-0.5" />
          <span className="text-xs text-slate-600">Distribute</span>
          <button
            onClick={() => distributeNodes("horizontal")}
            title="Distribute horizontally"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors font-mono text-sm"
          >
            ⇔
          </button>
          <button
            onClick={() => distributeNodes("vertical")}
            title="Distribute vertically"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors font-mono text-sm"
          >
            ⇕
          </button>
        </>
      )}

      {/* Layer */}
      <div className="w-px h-4 bg-[#2d3148] mx-0.5" />
      <span className="text-xs text-slate-600">Layer</span>
      <button onClick={bringSelectionToFront} title="Bring all to front"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors text-xs font-bold">
        ↑↑
      </button>
      <button onClick={sendSelectionToBack} title="Send all to back"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors text-xs font-bold">
        ↓↓
      </button>

      {/* Macro */}
      <div className="w-px h-4 bg-[#2d3148] mx-0.5" />
      <button onClick={onSaveMacro} title="Save selection as Macro"
        className="px-2.5 h-7 rounded-lg flex items-center text-indigo-400 hover:bg-[#2d3148] hover:text-indigo-300 transition-colors text-xs">
        + Macro
      </button>
    </div>
  );
}
