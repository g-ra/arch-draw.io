import {
  Save, Download, Users, MessageSquare, Eye, EyeOff,
  ChevronDown, Wifi, WifiOff, StickyNote, Type, MousePointer2, Trash2
} from "lucide-react";
import { AlignmentToolbar } from "./AlignmentToolbar";
import { ReactFlowInstance } from "reactflow";

interface Props {
  // Selection state
  multiCount: number;
  hasSelection: boolean;

  // Diagram state
  diagramId: string | null;
  diagramName: string;
  isDirty: boolean;
  saving: boolean;
  viewMode: boolean;
  tool: string;
  wsConnected: boolean;

  // ReactFlow instance
  rfInstance: ReactFlowInstance | null;

  // Callbacks
  onSave: () => void;
  onExport: (type: string) => void;
  onShare: () => void;
  onComments: () => void;
  onViewModeToggle: () => void;
  onToolChange: (tool: string) => void;
  onAutoLayout: () => void;
  onDelete: () => void;
  onSaveMacro: () => void;

  // Export menu state
  showExportMenu: boolean;
  setShowExportMenu: (show: boolean) => void;
}

const TOOLS = [
  { id: "select", icon: <MousePointer2 size={15} />, label: "Select (V)", key: "v" },
  { id: "sticky", icon: <StickyNote size={15} />, label: "Sticky (S)", key: "s" },
  { id: "text", icon: <Type size={15} />, label: "Text (T)", key: "t" },
];

export function ContextualToolbar(props: Props) {
  const {
    multiCount,
    hasSelection,
    diagramId,
    isDirty,
    saving,
    viewMode,
    tool,
    wsConnected,
    rfInstance,
    onSave,
    onExport,
    onShare,
    onComments,
    onViewModeToggle,
    onToolChange,
    onAutoLayout,
    onDelete,
    onSaveMacro,
    showExportMenu,
    setShowExportMenu,
  } = props;

  // If multiple nodes selected, show AlignmentToolbar
  if (multiCount >= 2) {
    return (
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-xl px-3 py-2">
        <AlignmentToolbar count={multiCount} onSaveMacro={onSaveMacro} />
      </div>
    );
  }

  // Default toolbar
  return (
    <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-xl px-3 py-2 flex items-center gap-2">
      {/* Tools */}
      {!viewMode && (
        <>
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => onToolChange(t.id)}
                title={t.label}
                className={`p-1.5 rounded transition-colors ${
                  tool === t.id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-[#1e2130]"
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          {/* Delete */}
          {hasSelection && (
            <button
              onClick={onDelete}
              title="Delete (Del)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}

          <div className="w-px h-5 bg-[#2d3148]" />
        </>
      )}

      {/* WS Status */}
      {wsConnected ? (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <Wifi size={12} /> Live
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <WifiOff size={12} />
        </span>
      )}
      {isDirty && !viewMode && <span className="text-xs text-slate-500">Unsaved</span>}

      {/* View/Edit Toggle */}
      <button
        onClick={onViewModeToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={
          viewMode
            ? { background: "#f59e0b20", color: "#fbbf24", border: "1px solid #f59e0b33" }
            : { background: "#1e2130", color: "#94a3b8", border: "1px solid #2d3148" }
        }
      >
        {viewMode ? (
          <>
            <Eye size={14} /> View
          </>
        ) : (
          <>
            <EyeOff size={14} /> Edit
          </>
        )}
      </button>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-slate-300 text-sm border border-[#2d3148] hover:text-white transition-colors"
        >
          <Download size={14} /> Export <ChevronDown size={12} />
        </button>
        {showExportMenu && (
          <div
            className="absolute left-0 top-10 bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-xl overflow-hidden z-50 min-w-[150px]"
            onMouseLeave={() => setShowExportMenu(false)}
          >
            {[
              { label: "PNG image", type: "png" },
              { label: "SVG image", type: "svg" },
              { label: "JSON", type: "json" },
              { label: "Mermaid .md", type: "mermaid" },
              { label: "draw.io XML", type: "drawio" },
            ].map(({ label, type }) => (
              <button
                key={type}
                onClick={() => {
                  onExport(type);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-[#2d3148] hover:text-white transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share */}
      {diagramId && (
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-slate-300 text-sm border border-[#2d3148] hover:text-white transition-colors"
        >
          <Users size={14} /> Share
        </button>
      )}

      {/* Comments */}
      {diagramId && (
        <button
          onClick={onComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-slate-300 text-sm border border-[#2d3148] hover:text-white transition-colors"
        >
          <MessageSquare size={14} /> Comments
        </button>
      )}

      {/* Save */}
      {!viewMode && (
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          <Save size={14} /> {saving ? "Saving..." : "Save"}
        </button>
      )}
    </div>
  );
}
