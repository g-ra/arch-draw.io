import { useState, useEffect } from "react";
import { CATEGORIES, REGION_TEMPLATES, NodeTemplate } from "../lib/nodeLibrary";
import { NodeCategory, MacroDefinition } from "../types/diagram";
import { NODE_ICONS } from "../lib/nodeIcons";
import { Search, Plus, Map, Blocks, Trash2, Upload } from "lucide-react";
import { useDiagramStore } from "../stores/diagramStore";
import { ReactFlowInstance } from "reactflow";
import { AddNodeTypeModal } from "./modals/AddNodeTypeModal";

interface Props {
  onDragStart: (e: React.DragEvent, template: NodeTemplate) => void;
  onCreateCustom: () => void;
  rfInstance: ReactFlowInstance | null;
}

type PanelTab = "nodes" | "snippets";

export function NodePanel({ onDragStart, onCreateCustom, rfInstance }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("nodes");
  const [activeCategory, setActiveCategory] = useState<NodeCategory | "all" | "regions">("all");
  const [search, setSearch] = useState("");
  const { customTemplates, nodeTypes, loadNodeTypes, macros, deleteMacro, insertMacro } = useDiagramStore();
  const [libraryMacros, setLibraryMacros] = useState<(MacroDefinition & { libraryId: string })[]>([]);
  const [libraryError, setLibraryError] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadNodeTypes();
  }, [loadNodeTypes]);

  useEffect(() => {
    if (activeTab !== "snippets") return;
    const controller = new AbortController();
    setLibraryLoading(true);
    setLibraryError(false);
    fetch("/api/macros", { credentials: "include", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((items: Array<{ id: string; name: string; tags: string[]; data: { nodes: unknown[]; edges: unknown[] }; createdAt: string }>) => {
        setLibraryMacros(
          items.map((item) => ({
            id: item.id,
            libraryId: item.id,
            name: item.name,
            tags: item.tags,
            nodes: item.data.nodes as import("reactflow").Node[],
            edges: item.data.edges as import("reactflow").Edge[],
            createdAt: item.createdAt,
            isLibrary: true,
          }))
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLibraryError(true);
      })
      .finally(() => setLibraryLoading(false));
    return () => controller.abort();
  }, [activeTab]);

  const publishMacro = async (macro: MacroDefinition) => {
    const res = await fetch("/api/macros", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: macro.name, tags: macro.tags, data: { nodes: macro.nodes, edges: macro.edges } }),
    });
    if (res.ok) {
      const created = await res.json();
      setLibraryMacros((prev) => [
        ...prev,
        { ...macro, libraryId: created.id, isLibrary: true },
      ]);
    }
  };

  const deleteLibraryMacro = async (libraryId: string) => {
    await fetch(`/api/macros/${libraryId}`, { method: "DELETE", credentials: "include" });
    setLibraryMacros((prev) => prev.filter((m) => m.libraryId !== libraryId));
  };

  const handleInsertMacro = (macro: MacroDefinition) => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = rfInstance?.screenToFlowPosition(center) ?? { x: 200, y: 200 };
    insertMacro(macro, pos);
  };

  const handleAddNodeType = async (data: any) => {
    try {
      const res = await fetch("/api/node-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newType = await res.json();
        useDiagramStore.getState().addNodeType(newType);
        setShowAddModal(false);
      }
    } catch (err) {
      console.error("Failed to add node type:", err);
    }
  };

  const allTemplates = [...nodeTypes, ...customTemplates];
  const filtered = allTemplates.filter((n) => {
    if (activeCategory === "regions") return false;
    const matchCat = activeCategory === "all" || n.category === activeCategory;
    const matchSearch =
      !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      (n.tech || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="w-56 flex-shrink-0 border-r border-[#2d3148] bg-[#13151f] flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#2d3148]">
        <button
          onClick={() => setActiveTab("nodes")}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === "nodes"
              ? "text-white border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Nodes
        </button>
        <button
          onClick={() => setActiveTab("snippets")}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
            activeTab === "snippets"
              ? "text-white border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Blocks size={11} /> Snippets
          {macros.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 leading-tight ml-0.5">
              {macros.length}
            </span>
          )}
        </button>
      </div>

      {/* NODES TAB */}
      {activeTab === "nodes" && (
        <>
          <div className="p-3 border-b border-[#2d3148]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 p-2 border-b border-[#2d3148]">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                activeCategory === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            {CATEGORIES.filter((c) => c.id !== "region" && c.id !== "custom").map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className="px-2 py-0.5 rounded text-xs transition-colors"
                style={
                  activeCategory === c.id
                    ? { background: c.color + "33", color: c.color }
                    : { color: "#64748b" }
                }
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={() => setActiveCategory("regions")}
              className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                activeCategory === "regions" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Map size={10} /> Regions
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {activeCategory === "regions" && (
              <>
                <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">
                  Drag to canvas
                </div>
                {REGION_TEMPLATES.map((template) => (
                  <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                ))}
              </>
            )}
            {activeCategory !== "regions" && (
              <>
                {customTemplates.length > 0 &&
                  (activeCategory === "all" || activeCategory === "custom") && (
                    <>
                      <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider mt-1">
                        Custom
                      </div>
                      {customTemplates.map((template) => (
                        <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                      ))}
                      <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider mt-1">
                        Library
                      </div>
                    </>
                  )}
                {filtered.map((template) => (
                  <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                ))}
              </>
            )}
          </div>

          <div className="p-2 border-t border-[#2d3148] space-y-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-indigo-400 hover:border-indigo-500 text-xs transition-colors"
            >
              <Plus size={12} /> Add Node Type
            </button>
            <button
              onClick={onCreateCustom}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-slate-400 hover:border-slate-500 text-xs transition-colors"
            >
              <Plus size={12} /> Create custom node
            </button>
          </div>
        </>
      )}

      {/* SNIPPETS TAB */}
      {activeTab === "snippets" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {macros.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">
                This diagram
              </div>
              {macros.map((macro) => (
                <MacroItem
                  key={macro.id}
                  macro={macro}
                  onInsert={() => handleInsertMacro(macro)}
                  onDelete={() => deleteMacro(macro.id)}
                  onPublish={() => publishMacro(macro)}
                  showPublish
                />
              ))}
            </div>
          )}

          <div className="p-2 border-t border-[#2d3148]">
            <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">
              My Library
            </div>
            {libraryLoading && (
              <p className="text-xs text-slate-500 px-2 py-3 text-center">Loading...</p>
            )}
            {libraryError && !libraryLoading && (
              <p className="text-xs text-red-400 px-2 py-3 text-center">Failed to load library</p>
            )}
            {!libraryLoading && !libraryError && libraryMacros.length === 0 && (
              <p className="text-xs text-slate-600 px-2 py-3 text-center">
                Publish local macros to use across all diagrams
              </p>
            )}
            {libraryMacros.map((macro) => (
              <MacroItem
                key={macro.libraryId}
                macro={macro}
                onInsert={() => handleInsertMacro(macro)}
                onDelete={() => deleteLibraryMacro(macro.libraryId)}
                showPublish={false}
              />
            ))}
          </div>

          {macros.length === 0 && libraryMacros.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-slate-600 text-center leading-relaxed">
                Select nodes → right-click → "Save as Macro" to create reusable snippets
              </p>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddNodeTypeModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddNodeType}
        />
      )}
    </div>
  );
}

function NodeItem({
  template,
  onDragStart,
}: {
  template: NodeTemplate;
  onDragStart: (e: React.DragEvent, t: NodeTemplate) => void;
}) {
  const icon = template.customIcon || NODE_ICONS[template.tech || ""] || NODE_ICONS[template.category] || "⬡";
  const cat = CATEGORIES.find((c) => c.id === template.category);
  const color = template.customColor || cat?.color || "#64748b";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, template)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-[#1e2130] transition-colors"
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate leading-tight">{template.label}</div>
        {template.description && (
          <div className="text-xs text-slate-500 truncate">{template.description}</div>
        )}
      </div>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
    </div>
  );
}

function MacroItem({
  macro,
  onInsert,
  onDelete,
  onPublish,
  showPublish,
}: {
  macro: MacroDefinition;
  onInsert: () => void;
  onDelete: () => void;
  onPublish?: () => void;
  showPublish: boolean;
}) {
  return (
    <div className="group flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-[#1e2130] transition-colors">
      <button onClick={onInsert} className="flex-1 text-left min-w-0">
        <div className="text-sm text-white truncate">{macro.name}</div>
        <div className="text-xs text-slate-500">
          {macro.nodes.length} nodes · {macro.edges.length} edges
        </div>
        {macro.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {macro.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2d3148] text-slate-400">
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        {showPublish && onPublish && (
          <button
            onClick={onPublish}
            title="Publish to My Library"
            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Upload size={12} />
          </button>
        )}
        <button
          onClick={onDelete}
          title="Delete macro"
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
