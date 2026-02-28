import { useState } from "react";
import { Node } from "reactflow";
import { X, Plus, Trash2, ChevronDown, ChevronRight, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import { TechNodeData, Endpoint, BrokerTopic, NodeComment } from "../../types/diagram";
import { useDiagramStore } from "../../stores/diagramStore";
import { NODE_ICONS } from "../../lib/nodeIcons";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "gRPC", "WS"] as const;
const METHOD_COLORS: Record<string, string> = {
  GET: "#34d399", POST: "#60a5fa", PUT: "#fbbf24",
  PATCH: "#fb923c", DELETE: "#f87171", gRPC: "#a78bfa", WS: "#38bdf8",
};
const TOPIC_DIRECTIONS = [
  { value: "in",   label: "IN",   color: "#34d399" },
  { value: "out",  label: "OUT",  color: "#f87171" },
  { value: "both", label: "BOTH", color: "#fbbf24" },
] as const;

interface Props {
  node: Node<TechNodeData>;
  onClose: () => void;
}

export function NodePropertiesPanel({ node, onClose }: Props) {
  const { updateNodeData, deleteNode } = useDiagramStore();
  const data: TechNodeData = node.data;

  const update = (patch: Partial<TechNodeData>) => updateNodeData(node.id, patch);

  // --- Endpoints ---
  const addEndpoint = () => {
    const ep: Endpoint = {
      id: crypto.randomUUID(),
      method: "GET",
      path: "/",
      description: "",
    };
    update({ endpoints: [...(data.endpoints || []), ep] });
  };

  const updateEndpoint = (id: string, patch: Partial<Endpoint>) => {
    update({
      endpoints: (data.endpoints || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const removeEndpoint = (id: string) => {
    update({ endpoints: (data.endpoints || []).filter((e) => e.id !== id) });
  };

  // --- Topics ---
  const addTopic = () => {
    const t: BrokerTopic = {
      id: crypto.randomUUID(),
      name: "new.topic",
      direction: "in",
      messageType: "",
      description: "",
    };
    update({ topics: [...(data.topics || []), t] });
  };

  const updateTopic = (id: string, patch: Partial<BrokerTopic>) => {
    update({
      topics: (data.topics || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  const removeTopic = (id: string) => {
    update({ topics: (data.topics || []).filter((t) => t.id !== id) });
  };

  const icon = data.customIcon || NODE_ICONS[data.tech || ""] || NODE_ICONS[data.category] || "⬡";

  return (
    <div className="w-80 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2d3148]">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{data.label}</div>
          {data.tech && <div className="text-slate-500 text-xs">{data.tech}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { deleteNode(node.id); onClose(); }}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Delete node (Del)"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">

        {/* Info section */}
        <div className="border-b border-[#2d3148]">
          <div className="px-4 py-2.5 text-sm font-medium text-slate-300">
            General
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-3">
              <PanelField label="Label">
                <input
                  value={data.label}
                  onChange={(e) => update({ label: e.target.value })}
                  className={inputCls}
                />
              </PanelField>
              <PanelField label="Tech / Stack">
                <input
                  value={data.tech || ""}
                  onChange={(e) => update({ tech: e.target.value })}
                  placeholder="e.g. nginx, postgres..."
                  className={inputCls}
                />
              </PanelField>
              <PanelField label="Description">
                <textarea
                  value={data.description || ""}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </PanelField>
              <PanelField label="Custom Icon (emoji)">
                <input
                  value={data.customIcon || ""}
                  onChange={(e) => update({ customIcon: e.target.value })}
                  placeholder="e.g. 🚀"
                  className={inputCls}
                />
              </PanelField>
              <PanelField label="Custom Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={data.customColor || "#3b82f6"}
                    onChange={(e) => update({ customColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-[#2d3148] bg-transparent"
                  />
                  <input
                    value={data.customColor || ""}
                    onChange={(e) => update({ customColor: e.target.value })}
                    placeholder="Auto"
                    className={`${inputCls} flex-1`}
                  />
                  {data.customColor && (
                    <button
                      onClick={() => update({ customColor: undefined })}
                      className="text-slate-500 hover:text-white text-xs"
                    >Reset</button>
                  )}
                </div>
              </PanelField>
            </div>
          </div>
        </div>

        {/* Endpoints section — always shown so any node can have endpoints */}
        <div className="border-b border-[#2d3148]">
          <div className="px-4 py-2.5 text-sm font-medium text-slate-300">
            Endpoints ({(data.endpoints || []).length})
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {(data.endpoints || []).map((ep) => (
                <EndpointRow
                  key={ep.id}
                  endpoint={ep}
                  onUpdate={(p) => updateEndpoint(ep.id, p)}
                  onRemove={() => removeEndpoint(ep.id)}
                />
              ))}
              <button
                onClick={addEndpoint}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-white hover:border-indigo-500 text-xs transition-colors"
              >
                <Plus size={12} /> Add Endpoint
              </button>
            </div>
          </div>
        </div>

        {/* Topics section — always shown so any node can have topics */}
        <div className="border-b border-[#2d3148]">
          <div className="px-4 py-2.5 text-sm font-medium text-slate-300">
            Topics ({(data.topics || []).length})
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {(data.topics || []).map((t) => (
                <TopicRow
                  key={t.id}
                  topic={t}
                  onUpdate={(p) => updateTopic(t.id, p)}
                  onRemove={() => removeTopic(t.id)}
                />
              ))}
              <button
                onClick={addTopic}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-white hover:border-red-500 text-xs transition-colors"
              >
                <Plus size={12} /> Add Topic
              </button>
            </div>
          </div>
        </div>

        {/* Comments section */}
        <CommentsSection
          nodeId={node.id}
          comments={data.comments || []}
          onUpdate={(comments) => update({ comments })}
        />
      </div>
    </div>
  );
}

// ── Endpoint row ──────────────────────────────────────────────────────────────
function EndpointRow({
  endpoint, onUpdate, onRemove,
}: { endpoint: Endpoint; onUpdate: (p: Partial<Endpoint>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const color = METHOD_COLORS[endpoint.method] || "#94a3b8";

  return (
    <div className="rounded-lg border border-[#2d3148] overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <select
          value={endpoint.method}
          onChange={(e) => onUpdate({ method: e.target.value as Endpoint["method"] })}
          className="text-xs font-bold rounded px-1 py-0.5 border-0 focus:outline-none cursor-pointer"
          style={{ background: color + "22", color }}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m} style={{ background: "#1a1d2e", color: METHOD_COLORS[m] }}>{m}</option>
          ))}
        </select>
        <input
          value={endpoint.path}
          onChange={(e) => onUpdate({ path: e.target.value })}
          className="flex-1 text-xs bg-transparent text-white font-mono focus:outline-none"
          placeholder="/path"
        />
        <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-white">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <button onClick={onRemove} className="text-slate-600 hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[#2d3148] px-2 pb-2 space-y-1.5 pt-1.5">
          <input
            value={endpoint.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            className={`${inputCls} text-xs`}
          />
          <input
            value={endpoint.requestBody || ""}
            onChange={(e) => onUpdate({ requestBody: e.target.value })}
            placeholder="Request body / params..."
            className={`${inputCls} text-xs`}
          />
          <input
            value={endpoint.responseBody || ""}
            onChange={(e) => onUpdate({ responseBody: e.target.value })}
            placeholder="Response structure..."
            className={`${inputCls} text-xs`}
          />
        </div>
      )}
    </div>
  );
}

// ── Topic row ─────────────────────────────────────────────────────────────────
function TopicRow({
  topic, onUpdate, onRemove,
}: { topic: BrokerTopic; onUpdate: (p: Partial<BrokerTopic>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const dir = TOPIC_DIRECTIONS.find((d) => d.value === topic.direction) || TOPIC_DIRECTIONS[0];

  return (
    <div className="rounded-lg border border-[#2d3148] overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <select
          value={topic.direction}
          onChange={(e) => onUpdate({ direction: e.target.value as BrokerTopic["direction"] })}
          className="text-xs font-bold rounded px-1 py-0.5 border-0 focus:outline-none cursor-pointer"
          style={{ background: dir.color + "22", color: dir.color }}
        >
          {TOPIC_DIRECTIONS.map((d) => (
            <option key={d.value} value={d.value} style={{ background: "#1a1d2e", color: d.color }}>{d.label}</option>
          ))}
        </select>
        <input
          value={topic.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 text-xs bg-transparent text-white font-mono focus:outline-none"
          placeholder="topic.name"
        />
        <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-white">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <button onClick={onRemove} className="text-slate-600 hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-[#2d3148] px-2 pb-2 space-y-1.5 pt-1.5">
          <input
            value={topic.messageType || ""}
            onChange={(e) => onUpdate({ messageType: e.target.value })}
            placeholder="Message type / schema (e.g. UserCreatedEvent)"
            className={`${inputCls} text-xs`}
          />
          <input
            value={topic.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            className={`${inputCls} text-xs`}
          />
        </div>
      )}
    </div>
  );
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500";

// ── Comments section ──────────────────────────────────────────────────────────
function CommentsSection({
  nodeId, comments, onUpdate,
}: {
  nodeId: string;
  comments: NodeComment[];
  onUpdate: (c: NodeComment[]) => void;
}) {
  const [newText, setNewText] = useState("");
  const [author, setAuthor] = useState(() => localStorage.getItem("tf_author") || "");
  const open_ = comments.filter((c) => !c.resolved).length;

  const addComment = () => {
    if (!newText.trim()) return;
    const a = author.trim() || "Anonymous";
    localStorage.setItem("tf_author", a);
    onUpdate([
      ...comments,
      { id: crypto.randomUUID(), text: newText.trim(), author: a, createdAt: new Date().toISOString(), resolved: false },
    ]);
    setNewText("");
  };

  const toggleResolve = (id: string) => {
    onUpdate(comments.map((c) => c.id === id ? { ...c, resolved: !c.resolved } : c));
  };

  const removeComment = (id: string) => onUpdate(comments.filter((c) => c.id !== id));

  const label = `Comments${open_ > 0 ? ` (${open_} open)` : comments.length > 0 ? ` (${comments.length} resolved)` : ""}`;

  return (
    <div className="border-b border-[#2d3148]">
      <div className="px-4 py-2.5 text-sm font-medium text-slate-300">
        {label}
      </div>
      <div className="px-4 pb-4">
        <div className="space-y-2">
        {/* Existing comments */}
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-lg p-2.5 text-xs"
            style={{
              background: c.resolved ? "#0f111788" : "#1e2130",
              border: `1px solid ${c.resolved ? "#2d314844" : "#2d3148"}`,
              opacity: c.resolved ? 0.6 : 1,
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <span className="font-semibold text-white">{c.author}</span>
                <span className="text-slate-500 ml-1.5">
                  {new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleResolve(c.id)}
                  className={`transition-colors ${c.resolved ? "text-green-400" : "text-slate-500 hover:text-green-400"}`}
                  title={c.resolved ? "Mark as open" : "Resolve"}
                >
                  {c.resolved ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                </button>
                <button onClick={() => removeComment(c.id)} className="text-slate-600 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <p className="text-slate-300 leading-snug whitespace-pre-wrap">{c.text}</p>
          </div>
        ))}

        {/* New comment form */}
        <div className="space-y-1.5 pt-1">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            className={`${inputCls} text-xs`}
          />
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) addComment(); }}
            placeholder="Write a comment... (⌘Enter to submit)"
            rows={2}
            className={`${inputCls} text-xs resize-none`}
          />
          <button
            onClick={addComment}
            disabled={!newText.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-600/30 text-xs hover:bg-amber-600/30 disabled:opacity-40 transition-colors"
          >
            <MessageSquare size={12} /> Add comment
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
