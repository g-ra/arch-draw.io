import dagre from "@dagrejs/dagre";
import { create } from "zustand";
import {
  Node, Edge,
  applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange, Connection, addEdge,
} from "reactflow";
import { NodeTemplate } from "../lib/nodeLibrary";
import { EditorTool, MacroDefinition } from "../types/diagram";

interface DiagramStore {
  nodes: Node[];
  edges: Edge[];
  diagramId: string | null;
  diagramName: string;
  isDirty: boolean;

  viewMode: boolean;
  tool: EditorTool;

  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[]; // multi-select

  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;

  customTemplates: NodeTemplate[];

  // Actions
  setDiagramId: (id: string | null) => void;
  setDiagramName: (name: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<Node["data"]>) => void;
  updateEdgeData: (edgeId: string, data: Partial<Edge["data"]>) => void;
  loadDiagram: (data: { nodes: Node[]; edges: Edge[]; macros?: MacroDefinition[] }) => void;
  markSaved: () => void;

  setViewMode: (v: boolean) => void;
  setTool: (t: EditorTool) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  highlightPath: (nodeId: string) => void;
  clearHighlight: () => void;
  addCustomTemplate: (t: NodeTemplate) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  setNodeZIndex: (nodeId: string, zIndex: number) => void;
  bringSelectionToFront: () => void;
  sendSelectionToBack: () => void;

  autoLayout: () => void;

  // Alignment
  alignNodes: (direction: "left" | "right" | "top" | "bottom" | "centerH" | "centerV") => void;
  distributeNodes: (axis: "horizontal" | "vertical") => void;

  macros: MacroDefinition[];
  setMacros: (macros: MacroDefinition[]) => void;
  saveMacro: (name: string, tags: string[]) => void;
  deleteMacro: (id: string) => void;
  insertMacro: (macro: MacroDefinition, position: { x: number; y: number }) => void;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  nodes: [],
  edges: [],
  diagramId: null,
  diagramName: "Untitled",
  isDirty: false,
  viewMode: false,
  tool: "select",
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedNodeIds: [],
  highlightedNodeIds: new Set(),
  highlightedEdgeIds: new Set(),
  customTemplates: [],
  macros: [],

  setDiagramId: (id) => set({ diagramId: id }),
  setDiagramName: (name) => set({ diagramName: name, isDirty: true }),
  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) =>
    set((s) => {
      const removedIds = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
      return {
        nodes: applyNodeChanges(changes, s.nodes),
        isDirty: true,
        selectedNodeId: removedIds.includes(s.selectedNodeId || "") ? null : s.selectedNodeId,
      };
    }),

  onEdgesChange: (changes) =>
    set((s) => {
      const removedIds = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
      return {
        edges: applyEdgeChanges(changes, s.edges),
        isDirty: true,
        selectedEdgeId: removedIds.includes(s.selectedEdgeId || "") ? null : s.selectedEdgeId,
      };
    }),

  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge(
        { ...connection, type: "animatedFlow", data: { protocol: "HTTP", animated: true, animationSpeed: "normal" } },
        s.edges
      ),
      isDirty: true,
    })),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node], isDirty: true })),

  updateNodeData: (nodeId, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n),
      isDirty: true,
    })),

  updateEdgeData: (edgeId, data) =>
    set((s) => ({
      edges: s.edges.map((e) => e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e),
      isDirty: true,
    })),

  loadDiagram: (data) => set({
    nodes: data.nodes,
    edges: data.edges,
    macros: data.macros ?? [],
    isDirty: false,
  }),
  markSaved: () => set({ isDirty: false }),

  setViewMode: (viewMode) =>
    set({ viewMode, tool: "select", selectedNodeId: null, selectedEdgeId: null,
      selectedNodeIds: [], highlightedNodeIds: new Set(), highlightedEdgeIds: new Set() }),

  setTool: (tool) => set({ tool, selectedNodeId: null, selectedEdgeId: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setSelectedNodeIds: (ids) => set((s) => {
    if (ids.length === s.selectedNodeIds.length && ids.every((id, i) => id === s.selectedNodeIds[i])) return s;
    return { selectedNodeIds: ids };
  }),

  highlightPath: (nodeId) => {
    const { edges } = get();
    const nodeIds = new Set<string>([nodeId]);
    const edgeIds = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (e.source === cur && !nodeIds.has(e.target)) {
          nodeIds.add(e.target); edgeIds.add(e.id); queue.push(e.target);
        }
        if (e.target === cur && !nodeIds.has(e.source)) {
          nodeIds.add(e.source); edgeIds.add(e.id); queue.push(e.source);
        }
      }
    }
    set({ highlightedNodeIds: nodeIds, highlightedEdgeIds: edgeIds });
  },

  clearHighlight: () => set({ highlightedNodeIds: new Set(), highlightedEdgeIds: new Set() }),

  addCustomTemplate: (t) => set((s) => ({ customTemplates: [...s.customTemplates, t] })),

  deleteNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      isDirty: true,
    })),

  deleteEdge: (edgeId) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId,
      isDirty: true,
    })),

  setNodeZIndex: (nodeId, zIndex) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, zIndex } } : n
      ),
      isDirty: true,
    })),

  bringSelectionToFront: () =>
    set((s) => {
      const unselected = s.nodes.filter((n) => !s.selectedNodeIds.includes(n.id));
      const maxZ = unselected.length > 0
        ? Math.max(...unselected.map((n) => (n.data?.zIndex ?? 10) as number))
        : 10;
      return {
        nodes: s.nodes.map((n) =>
          s.selectedNodeIds.includes(n.id)
            ? { ...n, data: { ...n.data, zIndex: maxZ + 1 } }
            : n
        ),
        isDirty: true,
      };
    }),

  sendSelectionToBack: () =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        s.selectedNodeIds.includes(n.id)
          ? { ...n, data: { ...n.data, zIndex: 1 } }
          : n
      ),
      isDirty: true,
    })),

  autoLayout: () => {
    const { nodes, edges } = get();

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });

    const layoutNodes = nodes.filter((n) => n.type !== "regionGroup");
    const regionNodes = nodes.filter((n) => n.type === "regionGroup");

    for (const node of layoutNodes) {
      g.setNode(node.id, { width: node.width ?? 150, height: node.height ?? 60 });
    }
    for (const edge of edges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    }

    dagre.layout(g);

    const layoutedNodes = layoutNodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: {
          x: pos.x - (node.width ?? 150) / 2,
          y: pos.y - (node.height ?? 60) / 2,
        },
      };
    });

    set({ nodes: [...regionNodes, ...layoutedNodes], isDirty: true });
  },

  setMacros: (macros) => set({ macros }),

  saveMacro: (name, tags) => {
    const { nodes, edges, selectedNodeIds } = get();
    const selectedSet = new Set(selectedNodeIds);
    const macroNodes = nodes.filter((n) => selectedSet.has(n.id));
    const macroEdges = edges.filter(
      (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
    );
    const macro: MacroDefinition = {
      id: crypto.randomUUID(),
      name,
      tags,
      nodes: macroNodes,
      edges: macroEdges,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ macros: [...s.macros, macro] }));
  },

  deleteMacro: (id) =>
    set((s) => ({ macros: s.macros.filter((m) => m.id !== id) })),

  insertMacro: (macro, position) => {
    const idMap = new Map<string, string>();
    for (const n of macro.nodes) {
      idMap.set(n.id, crypto.randomUUID());
    }

    const xs = macro.nodes.map((n) => n.position.x);
    const ys = macro.nodes.map((n) => n.position.y);
    const originX = xs.length ? Math.min(...xs) : 0;
    const originY = ys.length ? Math.min(...ys) : 0;

    const newNodes = macro.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: {
        x: position.x + (n.position.x - originX),
        y: position.y + (n.position.y - originY),
      },
    }));

    const newEdges = macro.edges.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      isDirty: true,
    }));
  },

  alignNodes: (direction) => {
    const { nodes, selectedNodeIds } = get();
    if (selectedNodeIds.length < 2) return;
    const targets = nodes.filter((n) => selectedNodeIds.includes(n.id));

    let updater: (n: Node) => Node["position"];
    const xs = targets.map((n) => n.position.x);
    const ys = targets.map((n) => n.position.y);
    const widths = targets.map((n) => (n.width || 150));
    const heights = targets.map((n) => (n.height || 60));

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs.map((x, i) => x + widths[i]));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys.map((y, i) => y + heights[i]));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    switch (direction) {
      case "left":    updater = () => ({ x: minX,        y: 0 }); break;
      case "right":   updater = (n) => ({ x: maxX - (n.width || 150), y: 0 }); break;
      case "top":     updater = () => ({ x: 0,           y: minY }); break;
      case "bottom":  updater = (n) => ({ x: 0,          y: maxY - (n.height || 60) }); break;
      case "centerH": updater = (n) => ({ x: centerX - (n.width || 150) / 2, y: 0 }); break;
      case "centerV": updater = (n) => ({ x: 0, y: centerY - (n.height || 60) / 2 }); break;
      default: return;
    }

    const isHorizontal = ["left", "right", "centerH"].includes(direction);
    set({
      nodes: nodes.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const delta = updater(n);
        return {
          ...n,
          position: {
            x: isHorizontal ? delta.x : n.position.x,
            y: isHorizontal ? n.position.y : delta.y,
          },
        };
      }),
      isDirty: true,
    });
  },

  distributeNodes: (axis) => {
    const { nodes, selectedNodeIds } = get();
    if (selectedNodeIds.length < 3) return;
    const targets = [...nodes.filter((n) => selectedNodeIds.includes(n.id))];

    if (axis === "horizontal") {
      targets.sort((a, b) => a.position.x - b.position.x);
      const total = targets[targets.length - 1].position.x - targets[0].position.x;
      const gap = total / (targets.length - 1);
      const startX = targets[0].position.x;
      set({
        nodes: nodes.map((n) => {
          const idx = targets.findIndex((t) => t.id === n.id);
          if (idx < 0) return n;
          return { ...n, position: { x: startX + idx * gap, y: n.position.y } };
        }),
        isDirty: true,
      });
    } else {
      targets.sort((a, b) => a.position.y - b.position.y);
      const total = targets[targets.length - 1].position.y - targets[0].position.y;
      const gap = total / (targets.length - 1);
      const startY = targets[0].position.y;
      set({
        nodes: nodes.map((n) => {
          const idx = targets.findIndex((t) => t.id === n.id);
          if (idx < 0) return n;
          return { ...n, position: { x: n.position.x, y: startY + idx * gap } };
        }),
        isDirty: true,
      });
    }
  },
}));
