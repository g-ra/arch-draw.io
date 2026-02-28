import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  ReactFlowProvider, ReactFlowInstance, Panel,
  Node, Edge, NodeMouseHandler, EdgeMouseHandler, OnSelectionChangeParams,
  ConnectionMode, NodeChange, EdgeChange, Connection,
} from "reactflow";
import "reactflow/dist/style.css";

import { TechNode } from "./nodes/TechNode";
import { AnimatedFlowEdge } from "./nodes/AnimatedFlowEdge";
import { RegionGroupNode } from "./nodes/RegionGroupNode";
import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { TextAnnotationNode } from "./nodes/TextAnnotationNode";
import { NodePanel } from "./NodePanel";
import { EdgePropertiesPanel } from "./panels/EdgePropertiesPanel";
import { NodePropertiesPanel } from "./panels/NodePropertiesPanel";
import { StickyNotePanel } from "./panels/StickyNotePanel";
import { TextAnnotationPanel } from "./panels/TextAnnotationPanel";
import { AlignmentToolbar } from "./AlignmentToolbar";
import { CustomNodeModal } from "./modals/CustomNodeModal";
import { SaveMacroModal } from "./modals/SaveMacroModal";
import { ShareModal } from "./modals/ShareModal";
import { GuestNameModal } from "./modals/GuestNameModal";
import { NodeContextMenu } from "./NodeContextMenu";
import { UserPresence } from "./UserPresence";
import { CommentsPanel } from "./CommentsPanel";
import { useDiagramStore } from "../stores/diagramStore";
import { NodeTemplate } from "../lib/nodeLibrary";
import { useExport } from "../hooks/useExport";
import {
  ArrowLeft, Save, Wifi, WifiOff, Eye, EyeOff,
  Download, ChevronDown, MousePointer2, StickyNote, Type, MessageSquare, LayoutGrid, Users,
  Trash2, ZoomIn, ZoomOut, Maximize2, Plus,
} from "lucide-react";
import { TechNodeData, FlowEdgeData, StickyNoteData, TextAnnotationData, EditorTool } from "../types/diagram";

const nodeTypes = {
  techNode: TechNode,
  regionGroup: RegionGroupNode,
  stickyNote: StickyNoteNode,
  textAnnotation: TextAnnotationNode,
};
const edgeTypes = { animatedFlow: AnimatedFlowEdge };

const TOOLS: { id: EditorTool; icon: React.ReactNode; label: string; key: string }[] = [
  { id: "select", icon: <MousePointer2 size={15} />, label: "Select (V)", key: "v" },
  { id: "sticky", icon: <StickyNote size={15} />,    label: "Sticky note (S)", key: "s" },
  { id: "text",   icon: <Type size={15} />,           label: "Text (T)", key: "t" },
  { id: "comment",icon: <MessageSquare size={15} />,  label: "Comment (C)", key: "c" },
];

interface Props {
  diagramId: string | null;
  currentUser: { id: string; name: string; email: string } | null;
  onBack: () => void;
}

export function DiagramEditor({ diagramId, currentUser, onBack }: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner diagramId={diagramId} currentUser={currentUser} onBack={onBack} />
    </ReactFlowProvider>
  );
}

function EditorInner({ diagramId, currentUser, onBack }: Props) {
  const store = useDiagramStore();
  // Stable action reference — Zustand actions don't change between renders
  const setSelectedNodeIds = useDiagramStore((s) => s.setSelectedNodeIds);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCustomNodeModal, setShowCustomNodeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGuestNameModal, setShowGuestNameModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [showSaveMacroModal, setShowSaveMacroModal] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const versionRef = useRef(0);
  const senderIdRef = useRef(crypto.randomUUID());
  const isApplyingRemoteChangeRef = useRef(false);

  // Throttle refs
  const throttleTimerRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef(false);

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const offlineChangesRef = useRef(false);

  const { exportPng, exportSvg, exportJson, exportMermaid, exportDrawio } = useExport(store.diagramName);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
      if (tool && !store.viewMode) store.setTool(tool.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store.viewMode]);

  // Load diagram
  useEffect(() => {
    // Check if user is authenticated
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((authUser) => {
        // If not authenticated and no guest name - show modal
        if (!authUser && !localStorage.getItem("tf_author")) {
          setShowGuestNameModal(true);
          // Still load empty diagram if no diagramId
          if (!diagramId) {
            store.loadDiagram({ nodes: [], edges: [] });
          }
          return;
        }

        // Load diagram if diagramId exists
        if (!diagramId) {
          store.loadDiagram({ nodes: [], edges: [] });
          return;
        }

        return fetch(`/api/diagrams/${diagramId}`, { credentials: "include" })
          .then((r) => r.ok ? r.json() : Promise.reject(r.status))
          .then((d) => {
            store.setDiagramId(diagramId);
            store.setDiagramName(d.name);
            store.loadDiagram(d.data);
          });
      })
      .catch(() => {
        if (diagramId) {
          store.setDiagramName("Failed to load");
        }
      });
  }, [diagramId]);

  // WebSocket with reconnection
  useEffect(() => {
    if (!diagramId) return;

    let reconnectTimeout: number | null = null;

    const connect = () => {
      const ws = new WebSocket(`ws://${location.host}/ws/diagram/${diagramId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to diagram sync");
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Sync offline changes if any
        if (offlineChangesRef.current) {
          console.log("[WS] Syncing offline changes");
          offlineChangesRef.current = false;
          // Clear pending throttle
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
          }
          pendingUpdateRef.current = false;
          sendUpdateImmediate();
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected");
        setWsConnected(false);
        wsRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
        reconnectAttemptsRef.current++;

        reconnectTimeout = window.setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        ws.close();
      };

      ws.onmessage = async (e) => {
        try {
          // Handle both string and Blob
          let data = e.data;
          if (data instanceof Blob) {
            data = await data.text();
          }

          const msg = JSON.parse(data);

          // Validate message structure
          if (!msg || typeof msg !== "object" || !msg.type) {
            console.warn("[WS] Invalid message: missing type field");
            return;
          }

          // Handle sync messages with versioning
          if (msg.type === "sync") {
            // Validate sync message fields
            if (!msg.senderId || typeof msg.version !== "number" || !msg.data) {
              console.warn("[WS] Invalid sync message: missing required fields");
              return;
            }
            // Ignore own messages
            if (msg.senderId === senderIdRef.current) {
              console.log("[WS] Ignoring own message");
              return;
            }

            // Ignore old versions
            if (msg.version <= versionRef.current) {
              console.log(`[WS] Ignoring old version ${msg.version}, current: ${versionRef.current}`);
              return;
            }

            // Apply remote change
            console.log(`[WS] Applying version ${msg.version} from ${msg.senderId}`);
            isApplyingRemoteChangeRef.current = true;
            versionRef.current = msg.version;

            if (msg.data.nodes) store.setNodes(msg.data.nodes);
            if (msg.data.edges) store.setEdges(msg.data.edges);

            // Reset flag after state updates
            queueMicrotask(() => {
              isApplyingRemoteChangeRef.current = false;
            });
          }

          // Legacy support (remove after migration)
          if (msg.type === "nodes") store.setNodes(msg.payload);
          if (msg.type === "edges") store.setEdges(msg.payload);
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [diagramId]);

  // Send versioned update to other clients (immediate, no throttle)
  const sendUpdateImmediate = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("[WS] Cannot send: socket not open, readyState:", wsRef.current?.readyState);
      return;
    }

    // Don't send if we're applying a remote change
    if (isApplyingRemoteChangeRef.current) {
      console.log("[WS] Skipping send: applying remote change");
      return;
    }

    versionRef.current++;
    const state = useDiagramStore.getState(); // Get fresh state
    const message = {
      type: "sync",
      version: versionRef.current,
      senderId: senderIdRef.current,
      timestamp: Date.now(),
      data: {
        nodes: state.nodes, // Use fresh state
        edges: state.edges,
      },
    };

    console.log(`[WS] Sending version ${versionRef.current}, nodes count:`, state.nodes.length);
    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (err) {
      console.error("[WS] Failed to send update:", err);
    }
    pendingUpdateRef.current = false;
  }, []); // No dependencies - always uses fresh state

  // Throttled send (150ms delay)
  const sendUpdate = useCallback(() => {
    pendingUpdateRef.current = true;

    if (throttleTimerRef.current) {
      // Already scheduled
      return;
    }

    throttleTimerRef.current = window.setTimeout(() => {
      if (pendingUpdateRef.current) {
        sendUpdateImmediate();
        pendingUpdateRef.current = false;
      }
      throttleTimerRef.current = null;
    }, 150);
  }, [sendUpdateImmediate]);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  // Wrapper for onNodesChange that sends WS update
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    console.log("[Sync] handleNodesChange called with changes:", changes);
    store.onNodesChange(changes);
    if (!isApplyingRemoteChangeRef.current) {
      console.log("[Sync] Not applying remote change, will send update");
      if (!wsConnected) {
        offlineChangesRef.current = true;
      }
      // Check if any change is a remove operation
      const hasDelete = changes.some(c => c.type === 'remove');
      if (hasDelete) {
        console.log("[Sync] Has delete, sending immediate");
        sendUpdateImmediate(); // Immediate sync for deletes
      } else {
        console.log("[Sync] No delete, sending throttled");
        sendUpdate(); // Throttled sync for other changes
      }
    } else {
      console.log("[Sync] Applying remote change, skipping send");
    }
  }, [sendUpdate, sendUpdateImmediate, wsConnected]);

  // Wrapper for onEdgesChange that sends WS update
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    store.onEdgesChange(changes);
    if (!isApplyingRemoteChangeRef.current) {
      if (!wsConnected) {
        offlineChangesRef.current = true;
      }
      // Check if any change is a remove operation
      const hasDelete = changes.some(c => c.type === 'remove');
      if (hasDelete) {
        sendUpdateImmediate(); // Immediate sync for deletes
      } else {
        sendUpdate(); // Throttled sync for other changes
      }
    }
  }, [sendUpdate, sendUpdateImmediate, wsConnected]);

  // Quick add connected node
  const handleQuickAdd = useCallback((sourceNodeId: string, direction: "top" | "left" | "bottom" | "right") => {
    const sourceNode = store.nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    const offsets = {
      top: { x: 0, y: -150 },
      bottom: { x: 0, y: 150 },
      left: { x: -250, y: 0 },
      right: { x: 250, y: 0 },
    };

    const handleMap = {
      top: { source: "target-top", target: "source-bottom" },
      bottom: { source: "source-bottom", target: "target-top" },
      left: { source: "target-left", target: "source-right" },
      right: { source: "source-right", target: "target-left" },
    };

    const offset = offsets[direction];
    const handles = handleMap[direction];
    const newNodeId = crypto.randomUUID();

    console.log("[QuickAdd] Adding node and edge", { sourceNodeId, newNodeId, direction });

    // Add new node
    store.addNode({
      id: newNodeId,
      type: "techNode",
      position: {
        x: sourceNode.position.x + offset.x,
        y: sourceNode.position.y + offset.y,
      },
      data: { label: "Microservice", category: "backend", tech: "service" },
    });

    // Add edge connection using onConnect
    store.onConnect({
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: handles.source,
      targetHandle: handles.target,
    });

    sendUpdateImmediate();
  }, [sendUpdateImmediate]);

  // Wrapper for onConnect that sends WS update
  const handleConnect = useCallback((connection: Connection) => {
    store.onConnect(connection);
    if (!isApplyingRemoteChangeRef.current) {
      if (!wsConnected) {
        offlineChangesRef.current = true;
      }
      sendUpdate();
    }
  }, [sendUpdate, wsConnected]);

  // Autosave
  useEffect(() => {
    if (!store.isDirty || !diagramId) return;
    const t = setTimeout(() => save(), 2000);
    return () => clearTimeout(t);
  }, [store.nodes, store.edges, store.isDirty]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!diagramId) {
        // Create new diagram
        const res = await fetch("/api/diagrams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: store.diagramName || "Untitled Diagram",
            data: { nodes: store.nodes, edges: store.edges, macros: store.macros },
          }),
        });
        if (res.ok) {
          const newDiagram = await res.json();
          // Update URL to include diagram ID
          window.history.replaceState({}, "", `/editor/${newDiagram.id}`);
          store.markSaved();
        }
      } else {
        // Update existing diagram
        const res = await fetch(`/api/diagrams/${diagramId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: store.diagramName,
            data: { nodes: store.nodes, edges: store.edges, macros: store.macros },
          }),
        });
        if (res.ok) {
          store.markSaved();
        }
      }
    } catch {
      // Network error — keep isDirty so autosave retries
    } finally {
      setSaving(false);
    }
  };

  // Nodes with highlight + z-index
  const displayNodes = useMemo(() => {
    const hasHighlight = store.highlightedNodeIds.size > 0;
    return store.nodes.map((n) => ({
      ...n,
      zIndex: n.type === "regionGroup" ? 0 : (n.data?.zIndex ?? 10),
      data: {
        ...n.data,
        _highlighted: hasHighlight && store.highlightedNodeIds.has(n.id),
        _dimmed: hasHighlight && !store.highlightedNodeIds.has(n.id),
        onQuickAdd: n.type === "techNode" && !store.viewMode ? handleQuickAdd : undefined,
      },
      draggable: !store.viewMode,
    }));
  }, [store.nodes, store.highlightedNodeIds, store.viewMode, handleQuickAdd]);

  // Edges with highlight
  const displayEdges = useMemo(() => {
    const hasHighlight = store.highlightedEdgeIds.size > 0;
    return store.edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        highlighted: hasHighlight && store.highlightedEdgeIds.has(e.id),
        dimmed: hasHighlight && !store.highlightedEdgeIds.has(e.id),
      },
    }));
  }, [store.edges, store.highlightedEdgeIds]);

  // Multi-selection tracking — must use stable action ref, NOT `store`,
  // because `store` changes reference on every state update and would
  // cause ReactFlow to re-fire onSelectionChange → infinite loop.
  const onSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
    setSelectedNodeIds(nodes.map((n) => n.id));
  }, [setSelectedNodeIds]);

  // Node click
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    const state = useDiagramStore.getState();

    if (state.viewMode) {
      if (state.selectedNodeId === node.id) {
        state.clearHighlight();
        state.setSelectedNodeId(null);
      } else {
        state.setSelectedNodeId(node.id);
        state.highlightPath(node.id);
      }
    } else if (state.tool === "comment") {
      state.setSelectedNodeId(node.id);
      state.setTool("select");
    } else {
      state.clearHighlight();
      state.setSelectedNodeId(node.id);
    }
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    const state = useDiagramStore.getState();
    if (!state.viewMode) {
      state.setSelectedEdgeId(edge.id);
    }
  }, []);

  // Canvas click — place tool node or deselect
  const onPaneClick = useCallback((e: React.MouseEvent) => {
    const state = useDiagramStore.getState();

    if (!rfInstance || state.viewMode) {
      state.setSelectedNodeId(null);
      state.setSelectedEdgeId(null);
      state.clearHighlight();
      return;
    }

    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (state.tool === "sticky") {
      state.addNode({
        id: `sticky-${Date.now()}`,
        type: "stickyNote",
        position: pos,
        style: { width: 200, height: 160 },
        data: { text: "", colorName: "yellow", fontSize: 14 } as StickyNoteData,
      });
      state.setTool("select");
      sendUpdateImmediate();
      return;
    }

    if (state.tool === "text") {
      state.addNode({
        id: `text-${Date.now()}`,
        type: "textAnnotation",
        position: pos,
        style: { width: 200, height: 40 },
        data: { text: "", fontSize: 16, fontWeight: "normal", color: "#e2e8f0", textAlign: "left" } as TextAnnotationData,
      });
      state.setTool("select");
      sendUpdateImmediate();
      return;
    }

    if (state.tool === "comment") {
      // Standalone comment sticky
      state.addNode({
        id: `cmt-${Date.now()}`,
        type: "stickyNote",
        position: pos,
        style: { width: 200, height: 120 },
        data: { text: "", colorName: "blue", fontSize: 13, author: localStorage.getItem("tf_author") || "" } as StickyNoteData,
      });
      state.setTool("select");
      sendUpdateImmediate();
      return;
    }

    // Default: deselect
    state.setSelectedNodeId(null);
    state.setSelectedEdgeId(null);
    state.clearHighlight();
  }, [rfInstance, sendUpdateImmediate]);

  // Drag from panel
  const onDragStart = useCallback((e: React.DragEvent, template: NodeTemplate) => {
    e.dataTransfer.setData("application/techflow-node", JSON.stringify(template));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const state = useDiagramStore.getState();
    if (!rfInstance || state.viewMode) return;
    const raw = e.dataTransfer.getData("application/techflow-node");
    if (!raw) return;
    const template: NodeTemplate = JSON.parse(raw);
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (template.category === "region") {
      const regionColors: Record<string, string> = {
        "us-east-1": "#3b82f6", "us-west-2": "#06b6d4",
        "eu-central-1": "#8b5cf6", "eu-west-1": "#a855f7",
        "ap-southeast-1": "#f97316", custom: "#22c55e",
      };
      state.addNode({
        id: `region-${Date.now()}`,
        type: "regionGroup",
        position: pos,
        style: { width: 400, height: 300 },
        data: {
          label: template.label, category: "region",
          regionName: template.label,
          regionColor: regionColors[template.tech || "custom"] || "#3b82f6",
          icon: "🌍", description: template.description,
        } as TechNodeData,
      });
    } else {
      state.addNode({
        id: `${template.id}-${Date.now()}`,
        type: "techNode",
        position: pos,
        data: {
          label: template.label, category: template.category,
          tech: template.tech, description: template.description,
          customIcon: template.customIcon, customColor: template.customColor,
          isCustom: template.isCustom,
        } as TechNodeData,
      });
    }

    // After adding node, sync immediately
    sendUpdateImmediate();
  }, [rfInstance, sendUpdateImmediate]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
  }, []);

  const handleAutoLayout = useCallback(() => {
    const state = useDiagramStore.getState();
    state.autoLayout();
    setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 50);
  }, [rfInstance]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    const state = useDiagramStore.getState();
    if (state.viewMode) return;
    if (!state.selectedNodeIds.includes(node.id)) {
      state.setSelectedNodeIds([node.id]);
      state.setSelectedNodeId(node.id);
    }
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, []);

  // Guest name handler
  const handleGuestNameSubmit = (name: string) => {
    localStorage.setItem("tf_author", name);
    setShowGuestNameModal(false);

    // Load diagram after name is set
    if (diagramId) {
      fetch(`/api/diagrams/${diagramId}`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((d) => {
          store.setDiagramId(diagramId);
          store.setDiagramName(d.name);
          store.loadDiagram(d.data);
        })
        .catch(() => {
          store.setDiagramName("Failed to load");
        });
    }
  };

  // Selected items for panels
  const selectedNode = store.selectedNodeId ? store.nodes.find((n) => n.id === store.selectedNodeId) : null;
  const selectedEdge = store.selectedEdgeId ? store.edges.find((e) => e.id === store.selectedEdgeId) : null;
  const multiCount = store.selectedNodeIds.length;

  // Cursor style based on tool
  const cursorStyle: React.CSSProperties = {
    cursor: store.tool === "sticky" ? "cell"
          : store.tool === "text"   ? "text"
          : store.tool === "comment"? "crosshair"
          : "default",
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f1117]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[#2d3148] flex items-center px-3 gap-2 flex-shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors p-1">
          <ArrowLeft size={18} />
        </button>

        <input
          value={store.diagramName}
          onChange={(e) => store.setDiagramName(e.target.value)}
          disabled={store.viewMode}
          className="bg-transparent text-white font-medium text-sm focus:outline-none border-b border-transparent focus:border-indigo-500 px-1 py-0.5 w-44 disabled:opacity-70"
        />

        {/* Tool palette */}
        {!store.viewMode && (
          <>
            <div className="w-px h-5 bg-[#2d3148] mx-1" />
            <div className="flex items-center gap-0.5">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => store.setTool(t.id)}
                  title={t.label}
                  className="p-1.5 rounded-lg transition-all"
                  style={
                    store.tool === t.id
                      ? { background: "#4f46e530", color: "#818cf8", outline: "1px solid #4f46e544" }
                      : { color: "#64748b" }
                  }
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </>
        )}

        {!store.viewMode && (
          <>
            <div className="w-px h-5 bg-[#2d3148] mx-1" />
            <button
              onClick={handleAutoLayout}
              title="Auto Layout (Dagre LR)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2130] text-slate-400 text-sm border border-[#2d3148] hover:text-white transition-colors"
            >
              <LayoutGrid size={14} /> Auto Layout
            </button>

            {/* Delete button */}
            {(store.selectedNodeId || store.selectedEdgeId || store.selectedNodeIds.length > 0) && (
              <button
                onClick={() => {
                  if (store.selectedNodeIds.length > 0) {
                    store.selectedNodeIds.forEach(id => store.deleteNode(id));
                    store.setSelectedNodeIds([]);
                  } else if (store.selectedNodeId) {
                    store.deleteNode(store.selectedNodeId);
                    store.setSelectedNodeId(null);
                  } else if (store.selectedEdgeId) {
                    store.deleteEdge(store.selectedEdgeId);
                    store.setSelectedEdgeId(null);
                  }
                  sendUpdateImmediate();
                }}
                title="Delete (Del)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 border border-[#2d3148] rounded-lg overflow-hidden">
              <button
                onClick={() => rfInstance?.zoomIn()}
                title="Zoom In"
                className="px-2 py-1.5 bg-[#1e2130] text-slate-400 hover:text-white hover:bg-[#252836] transition-colors"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => rfInstance?.zoomOut()}
                title="Zoom Out"
                className="px-2 py-1.5 bg-[#1e2130] text-slate-400 hover:text-white hover:bg-[#252836] transition-colors border-l border-[#2d3148]"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => rfInstance?.fitView({ padding: 0.2 })}
                title="Fit View"
                className="px-2 py-1.5 bg-[#1e2130] text-slate-400 hover:text-white hover:bg-[#252836] transition-colors border-l border-[#2d3148]"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Tool hint */}
        {!store.viewMode && store.tool !== "select" && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
            {store.tool === "sticky" ? "Click canvas to place sticky note" :
             store.tool === "text"   ? "Click canvas to place text" :
             store.tool === "comment"? "Click canvas or node to add comment" : ""}
          </span>
        )}

        {/* View mode */}
        {store.viewMode && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Eye size={12} /> View mode — click nodes to trace paths
          </div>
        )}

        {/* WS status */}
        {wsConnected
          ? <span className="flex items-center gap-1 text-xs text-green-400"><Wifi size={12} /> Live</span>
          : <span className="flex items-center gap-1 text-xs text-slate-500"><WifiOff size={12} /></span>
        }
        {store.isDirty && !store.viewMode && <span className="text-xs text-slate-500">Unsaved</span>}

        {/* View/Edit toggle */}
        <button
          onClick={() => store.setViewMode(!store.viewMode)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={
            store.viewMode
              ? { background: "#f59e0b20", color: "#fbbf24", border: "1px solid #f59e0b33" }
              : { background: "#1e2130", color: "#94a3b8", border: "1px solid #2d3148" }
          }
        >
          {store.viewMode ? <><Eye size={14} /> View</> : <><EyeOff size={14} /> Edit</>}
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
              className="absolute right-0 top-10 bg-[#1a1d2e] border border-[#2d3148] rounded-xl shadow-xl overflow-hidden z-50 min-w-[150px]"
              onMouseLeave={() => setShowExportMenu(false)}
            >
              {[
                { label: "PNG image",   action: exportPng },
                { label: "SVG image",   action: exportSvg },
                { label: "JSON",        action: () => exportJson(store.nodes, store.edges) },
                { label: "Mermaid .md", action: () => exportMermaid(store.nodes as Node<TechNodeData>[], store.edges as Edge<FlowEdgeData>[]) },
                { label: "draw.io XML", action: () => exportDrawio(store.nodes as Node<TechNodeData>[], store.edges as Edge<FlowEdgeData>[]) },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => { action(); setShowExportMenu(false); }}
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
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-slate-300 text-sm border border-[#2d3148] hover:text-white transition-colors"
          >
            <Users size={14} /> Share
          </button>
        )}

        {/* Comments */}
        {diagramId && (
          <button
            onClick={() => setShowCommentsPanel(!showCommentsPanel)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2130] text-slate-300 text-sm border border-[#2d3148] hover:text-white transition-colors"
          >
            <MessageSquare size={14} /> Comments
          </button>
        )}

        {/* Save */}
        {!store.viewMode && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {!store.viewMode && (
          <NodePanel
            onDragStart={onDragStart}
            onCreateCustom={() => setShowCustomNodeModal(true)}
            rfInstance={rfInstance}
          />
        )}

        {/* Canvas */}
        <div className="flex-1 relative" style={cursorStyle} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={store.viewMode ? undefined : handleNodesChange}
            onEdgesChange={store.viewMode ? undefined : handleEdgesChange}
            onConnect={store.viewMode ? undefined : handleConnect}
            onInit={setRfInstance}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid={!store.viewMode}
            snapGrid={[16, 16]}
            nodesDraggable={!store.viewMode}
            nodesConnectable={!store.viewMode && store.tool === "select"}
            elementsSelectable={!store.viewMode}
            deleteKeyCode={store.viewMode ? null : ["Delete", "Backspace"]}
            defaultEdgeOptions={{ type: "animatedFlow" }}
            panOnDrag={store.viewMode ? true : false}
            selectionOnDrag={!store.viewMode && store.tool === "select"}
            panOnScroll={true}
            connectionMode={ConnectionMode.Loose}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} color="#2d3148" size={1} />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as TechNodeData;
                if (d?.customColor) return d.customColor;
                const colors: Record<string, string> = {
                  network: "#3b82f6", backend: "#22c55e", database: "#eab308",
                  queue: "#ef4444", devops: "#f97316", frontend: "#a855f7", region: "#64748b",
                };
                return colors[d?.category || ""] || "#94a3b8";
              }}
              maskColor="#0f111788"
            />

            {/* Alignment toolbar — floating above canvas when multi-selected */}
            {!store.viewMode && multiCount >= 2 && (
              <Panel position="top-center">
                <AlignmentToolbar count={multiCount} onSaveMacro={() => setShowSaveMacroModal(true)} />
              </Panel>
            )}

            {/* Floating Add button */}
            {!store.viewMode && (
              <Panel position="bottom-right">
                <button
                  onClick={() => {
                    const center = rfInstance?.getViewport();
                    const pos = center ? rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 200, y: 200 };
                    store.addNode({
                      id: crypto.randomUUID(),
                      type: "techNode",
                      position: pos,
                      data: { label: "Microservice", category: "backend", tech: "service" },
                    });
                    sendUpdateImmediate();
                  }}
                  className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                  title="Add Node (default: Microservice)"
                >
                  <Plus size={24} />
                </button>
              </Panel>
            )}

            {store.viewMode && (
              <Panel position="bottom-center">
                <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-full px-4 py-1.5 text-xs text-slate-400">
                  Click a node to highlight its full path • Click again or canvas to clear
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right panels */}
        {!store.viewMode && selectedNode && selectedNode.type === "techNode" && (
          <NodePropertiesPanel
            node={selectedNode as Node<TechNodeData>}
            onClose={() => store.setSelectedNodeId(null)}
          />
        )}
        {!store.viewMode && selectedNode && selectedNode.type === "stickyNote" && (
          <StickyNotePanel
            node={selectedNode as Node<StickyNoteData>}
            onClose={() => store.setSelectedNodeId(null)}
          />
        )}
        {!store.viewMode && selectedNode && selectedNode.type === "textAnnotation" && (
          <TextAnnotationPanel
            node={selectedNode as Node<TextAnnotationData>}
            onClose={() => store.setSelectedNodeId(null)}
          />
        )}
        {!store.viewMode && selectedEdge && (
          <EdgePropertiesPanel
            edge={selectedEdge as Edge<FlowEdgeData>}
            onClose={() => store.setSelectedEdgeId(null)}
          />
        )}

        {/* View mode detail */}
        {store.viewMode && selectedNode && selectedNode.type === "techNode" && (
          <ViewNodeDetail
            node={selectedNode as Node<TechNodeData>}
            connectedCount={store.highlightedNodeIds.size - 1}
            onClose={() => { store.setSelectedNodeId(null); store.clearHighlight(); }}
          />
        )}

        {/* Comments panel */}
        {showCommentsPanel && diagramId && (
          <CommentsPanel
            diagramId={diagramId}
            currentUserId={currentUser?.id}
            onClose={() => setShowCommentsPanel(false)}
          />
        )}
      </div>

      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onSaveMacro={() => { setContextMenu(null); setShowSaveMacroModal(true); }}
        />
      )}
      {showSaveMacroModal && (
        <SaveMacroModal onClose={() => setShowSaveMacroModal(false)} />
      )}
      {showCustomNodeModal && <CustomNodeModal onClose={() => setShowCustomNodeModal(false)} />}
      {showShareModal && diagramId && (
        <ShareModal
          diagramId={diagramId}
          diagramName={store.diagramName}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Guest name prompt */}
      {showGuestNameModal && (
        <GuestNameModal onSubmit={handleGuestNameSubmit} />
      )}

      {/* User presence indicators */}
      {diagramId && (
        <UserPresence
          diagramId={diagramId}
          currentUserName={
            currentUser?.name ||
            localStorage.getItem("tf_author") ||
            "Anonymous"
          }
        />
      )}
    </div>
  );
}

// ── View mode node detail ─────────────────────────────────────────────────────
function ViewNodeDetail({ node, connectedCount, onClose }: { node: Node<TechNodeData>; connectedCount: number; onClose: () => void }) {
  const data = node.data;
  const icon = data.customIcon || (data.tech ? `${data.tech}` : "⬡");
  const color = data.customColor || "#3b82f6";
  const METHOD_COLORS: Record<string, string> = {
    GET: "#34d399", POST: "#60a5fa", PUT: "#fbbf24", PATCH: "#fb923c", DELETE: "#f87171", gRPC: "#a78bfa", WS: "#38bdf8",
  };
  const DIR_COLORS: Record<string, string> = { in: "#34d399", out: "#f87171", both: "#fbbf24" };
  const openComments = (data.comments || []).filter((c) => !c.resolved);

  return (
    <div className="w-72 bg-[#13151f] border-l border-[#2d3148] flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2d3148]">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <div className="text-white font-semibold">{data.label}</div>
          {data.tech && <div className="text-xs" style={{ color }}>{data.tech}</div>}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-lg">✕</button>
      </div>

      <div className="p-4 space-y-4 text-sm">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {connectedCount} node{connectedCount !== 1 ? "s" : ""} in path
        </div>

        {data.description && <p className="text-slate-300 leading-relaxed">{data.description}</p>}

        {data.endpoints && data.endpoints.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Endpoints</div>
            <div className="space-y-1.5">
              {data.endpoints.map((ep) => (
                <div key={ep.id} className="rounded-lg bg-[#0f1117] p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: (METHOD_COLORS[ep.method] || "#94a3b8") + "22", color: METHOD_COLORS[ep.method] || "#94a3b8" }}>{ep.method}</span>
                    <span className="text-white text-xs font-mono">{ep.path}</span>
                  </div>
                  {ep.description && <p className="text-slate-500 text-xs mt-1">{ep.description}</p>}
                  {ep.requestBody && <p className="text-slate-600 text-xs mt-0.5">↑ {ep.requestBody}</p>}
                  {ep.responseBody && <p className="text-slate-600 text-xs mt-0.5">↓ {ep.responseBody}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.topics && data.topics.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Topics</div>
            <div className="space-y-1.5">
              {data.topics.map((t) => (
                <div key={t.id} className="rounded-lg bg-[#0f1117] p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: (DIR_COLORS[t.direction] || "#94a3b8") + "22", color: DIR_COLORS[t.direction] || "#94a3b8" }}>{t.direction.toUpperCase()}</span>
                    <span className="text-white text-xs font-mono">{t.name}</span>
                  </div>
                  {t.messageType && <p className="text-slate-400 text-xs mt-1">type: {t.messageType}</p>}
                  {t.description && <p className="text-slate-500 text-xs mt-0.5">{t.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {openComments.length > 0 && (
          <div>
            <div className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">💬 Comments ({openComments.length})</div>
            <div className="space-y-2">
              {openComments.map((c) => (
                <div key={c.id} className="rounded-lg bg-[#0f1117] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{c.author}</span>
                    <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-snug whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
