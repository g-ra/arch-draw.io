import { useCallback } from "react";
import { Edge } from "reactflow";
import { X, Zap, Trash2 } from "lucide-react";
import { FlowEdgeData, FlowProtocol } from "../../types/diagram";
import { PROTOCOL_COLORS } from "../nodes/AnimatedFlowEdge";
import { useDiagramStore } from "../../stores/diagramStore";

const PROTOCOLS: FlowProtocol[] = ["HTTP", "HTTPS", "gRPC", "TCP", "UDP", "AMQP", "WebSocket", "Kafka", "NATS", "custom"];
const SPEEDS = [
  { value: "slow",   label: "Slow",   desc: "3s" },
  { value: "normal", label: "Normal", desc: "1.5s" },
  { value: "fast",   label: "Fast",   desc: "0.6s" },
] as const;

const PRESET_COLORS = [
  "#60a5fa", "#34d399", "#a78bfa", "#fb923c",
  "#f472b6", "#fbbf24", "#38bdf8", "#ef4444",
  "#22c55e", "#94a3b8", "#ffffff",
];

interface Props {
  edge: Edge<FlowEdgeData>;
  onClose: () => void;
}

export function EdgePropertiesPanel({ edge, onClose }: Props) {
  const { updateEdgeData, deleteEdge } = useDiagramStore();
  const data: FlowEdgeData = edge.data || {};

  const update = useCallback(
    (patch: Partial<FlowEdgeData>) => updateEdgeData(edge.id, patch),
    [edge.id, updateEdgeData]
  );

  const protocol = data.protocol || "HTTP";
  const autoColor = PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;

  return (
    <div className="w-72 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3148]">
        <span className="text-white font-semibold text-sm">Connection</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { deleteEdge(edge.id); onClose(); }}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Delete connection"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Direction — prominent section with visual buttons */}
        <Field label="Direction">
          <div className="flex gap-2">
            <button
              onClick={() => update({ bidirectional: false })}
              className="flex-1 py-2.5 rounded-lg text-xs flex flex-col items-center gap-1 transition-all"
              style={
                !data.bidirectional
                  ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                  : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
              }
            >
              <span className="text-lg leading-none">→</span>
              <span>One-way</span>
            </button>
            <button
              onClick={() => update({ bidirectional: true })}
              className="flex-1 py-2.5 rounded-lg text-xs flex flex-col items-center gap-1 transition-all"
              style={
                data.bidirectional
                  ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                  : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
              }
            >
              <span className="text-lg leading-none">↔</span>
              <span>Two-way</span>
            </button>
          </div>
        </Field>

        {/* Label */}
        <Field label="Label">
          <input
            value={data.label || ""}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="e.g. user data"
            className="w-full px-3 py-1.5 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={data.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What flows through this connection?"
            rows={2}
            className="w-full px-3 py-1.5 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </Field>

        {/* Protocol */}
        <Field label="Protocol">
          <div className="grid grid-cols-3 gap-1.5">
            {PROTOCOLS.map((p) => {
              const c = PROTOCOL_COLORS[p] || PROTOCOL_COLORS.default;
              const active = protocol === p;
              return (
                <button
                  key={p}
                  onClick={() => update({ protocol: p, color: undefined })}
                  className="px-2 py-1 rounded text-xs font-mono transition-all"
                  style={
                    active
                      ? { background: c + "25", color: c, border: `1px solid ${c}66` }
                      : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                  }
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Animation */}
        <Field label="Animation">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">Animated flow</span>
            <Toggle
              value={data.animated !== false}
              onChange={(v) => update({ animated: v })}
            />
          </div>
        </Field>

        {/* Speed */}
        {data.animated !== false && (
          <Field label="Speed">
            <div className="flex gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ animationSpeed: s.value })}
                  className="flex-1 py-1.5 rounded text-xs transition-all flex flex-col items-center gap-0.5"
                  style={
                    (data.animationSpeed || "normal") === s.value
                      ? { background: "#4f46e520", color: "#818cf8", border: "1px solid #4f46e544" }
                      : { background: "#0f1117", color: "#64748b", border: "1px solid #2d3148" }
                  }
                >
                  <span>{s.label}</span>
                  <span className="opacity-60 text-[10px]">{s.desc}</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Color */}
        <Field label="Color">
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className="w-6 h-6 rounded-full transition-all"
                style={{
                  background: c,
                  outline: (data.color || autoColor) === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
            <button
              onClick={() => update({ color: undefined })}
              className="w-6 h-6 rounded-full bg-[#0f1117] border border-[#2d3148] text-slate-500 text-xs flex items-center justify-center"
              title="Auto (by protocol)"
            >A</button>
          </div>
          <div
            className="text-xs flex items-center gap-1"
            style={{ color: data.color || autoColor }}
          >
            <Zap size={10} /> {data.color ? "Custom color" : `Auto: ${protocol}`}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{ background: value ? "#4f46e5" : "#2d3148" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: value ? "18px" : "2px" }}
      />
    </button>
  );
}
