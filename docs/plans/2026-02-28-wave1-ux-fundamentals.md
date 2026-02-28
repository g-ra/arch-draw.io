# Wave 1 — UX Fundamentals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Z-order control, one-click auto-layout (Dagre), and a reusable macro/snippet library to TechFlow.

**Architecture:** Three independent features that only touch the frontend store + components, plus one backend addition (personal macro library DB table + API). No breaking changes to existing data.

**Tech Stack:** React 19, ReactFlow 11, Zustand 5, Tailwind, Fastify 5, Prisma, PostgreSQL. New dep: `@dagrejs/dagre`.

---

## Overview of tasks

| # | Feature | What |
|---|---------|------|
| 1 | Infra | Install Vitest for store unit tests |
| 2 | Z-order | Types + store action + fix displayNodes |
| 3 | Z-order | NodeContextMenu component |
| 4 | Z-order | AlignmentToolbar Z-order section |
| 5 | Auto-layout | Install Dagre + store action |
| 6 | Auto-layout | Toolbar button + fitView |
| 7 | Macros | Types |
| 8 | Macros | Store actions (save / delete / insert) |
| 9 | Macros | Backend: Prisma schema + migration |
| 10 | Macros | Backend: API routes |
| 11 | Macros | Diagram persistence (save + load macros) |
| 12 | Macros | Save as Macro UI (context menu + modal) |
| 13 | Macros | Snippets tab in NodePanel |

---

## Task 1: Install Vitest

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`

**Step 1: Install Vitest dev dependencies**

```bash
cd apps/web
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

**Step 2: Create vitest config**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

**Step 3: Create test setup**

Create `apps/web/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

**Step 4: Add test script to package.json**

In `apps/web/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Verify vitest works**

```bash
cd apps/web
pnpm test
```
Expected: "No test files found" (zero failures, exits 0).

**Step 6: Commit**

```bash
cd ../..
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/test/setup.ts apps/web/pnpm-lock.yaml
git commit -m "chore: add Vitest test infrastructure to web app"
```

---

## Task 2: Z-order — types + store action + displayNodes fix

**Files:**
- Modify: `apps/web/src/types/diagram.ts`
- Modify: `apps/web/src/stores/diagramStore.ts`
- Modify: `apps/web/src/components/DiagramEditor.tsx:132-144`
- Create: `apps/web/src/stores/__tests__/zorder.test.ts`

**Step 1: Add `zIndex` to TechNodeData**

In `apps/web/src/types/diagram.ts`, add `zIndex?: number;` to `TechNodeData` after `_dimmed`:

```ts
export interface TechNodeData {
  label: string;
  category: NodeCategory;
  icon?: string;
  description?: string;
  tech?: string;
  endpoints?: Endpoint[];
  topics?: BrokerTopic[];
  comments?: NodeComment[];
  isCustom?: boolean;
  customColor?: string;
  customIcon?: string;
  regionName?: string;
  regionColor?: string;
  zIndex?: number;       // ← add this
  _highlighted?: boolean;
  _dimmed?: boolean;
}
```

**Step 2: Write failing test**

Create `apps/web/src/stores/__tests__/zorder.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node } from "reactflow";

function makeNode(id: string, zIndex?: number): Node {
  return {
    id,
    type: "techNode",
    position: { x: 0, y: 0 },
    data: { label: id, category: "backend", zIndex },
  };
}

describe("setNodeZIndex", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 10), makeNode("b", 20), makeNode("c")],
      edges: [],
    });
  });

  it("sets zIndex on a specific node", () => {
    useDiagramStore.getState().setNodeZIndex("a", 50);
    const node = useDiagramStore.getState().nodes.find((n) => n.id === "a");
    expect(node?.data.zIndex).toBe(50);
  });

  it("does not affect other nodes", () => {
    useDiagramStore.getState().setNodeZIndex("a", 50);
    const b = useDiagramStore.getState().nodes.find((n) => n.id === "b");
    expect(b?.data.zIndex).toBe(20);
  });

  it("marks diagram as dirty", () => {
    useDiagramStore.setState({ isDirty: false });
    useDiagramStore.getState().setNodeZIndex("a", 50);
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });
});
```

**Step 3: Run test — expect FAIL**

```bash
cd apps/web && pnpm test
```
Expected: FAIL — "setNodeZIndex is not a function"

**Step 4: Add `setNodeZIndex` to the store interface and implementation**

In `apps/web/src/stores/diagramStore.ts`:

Add to the `DiagramStore` interface (after `deleteEdge`):
```ts
  setNodeZIndex: (nodeId: string, zIndex: number) => void;
```

Add to the `create()` implementation (after `deleteEdge`):
```ts
  setNodeZIndex: (nodeId, zIndex) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, zIndex } } : n
      ),
      isDirty: true,
    })),
```

**Step 5: Run test — expect PASS**

```bash
cd apps/web && pnpm test
```
Expected: PASS — 3 passing.

**Step 6: Fix displayNodes in DiagramEditor to use dynamic zIndex**

In `apps/web/src/components/DiagramEditor.tsx`, replace the `displayNodes` useMemo (lines 132–144):

Old:
```ts
  const displayNodes = useMemo(() => {
    const hasHighlight = store.highlightedNodeIds.size > 0;
    return store.nodes.map((n) => ({
      ...n,
      zIndex: n.type === "regionGroup" ? 0 : 10,
```

New:
```ts
  const displayNodes = useMemo(() => {
    const hasHighlight = store.highlightedNodeIds.size > 0;
    return store.nodes.map((n) => ({
      ...n,
      zIndex: n.type === "regionGroup" ? 0 : (n.data?.zIndex ?? 10),
```

**Step 7: Commit**

```bash
cd ../..
git add apps/web/src/types/diagram.ts apps/web/src/stores/diagramStore.ts apps/web/src/components/DiagramEditor.tsx apps/web/src/stores/__tests__/zorder.test.ts
git commit -m "feat: add zIndex field to nodes with setNodeZIndex store action"
```

---

## Task 3: Z-order — NodeContextMenu component

**Files:**
- Create: `apps/web/src/components/NodeContextMenu.tsx`
- Modify: `apps/web/src/components/DiagramEditor.tsx`

**Step 1: Create NodeContextMenu component**

Create `apps/web/src/components/NodeContextMenu.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { useDiagramStore } from "../stores/diagramStore";

interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeContextMenu({ nodeId, x, y, onClose }: Props) {
  const { nodes, setNodeZIndex } = useDiagramStore();
  const ref = useRef<HTMLDivElement>(null);

  const currentZ = (nodes.find((n) => n.id === nodeId)?.data?.zIndex ?? 10) as number;
  const techNodes = nodes.filter((n) => n.type !== "regionGroup");
  const maxZ = techNodes.length > 0
    ? Math.max(...techNodes.map((n) => n.data?.zIndex ?? 10))
    : 10;
  const minZ = 1;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const actions = [
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
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          disabled={a.disabled}
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-[#2d3148] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Wire context menu in DiagramEditor**

In `apps/web/src/components/DiagramEditor.tsx`:

Add import at top:
```tsx
import { NodeContextMenu } from "./NodeContextMenu";
```

Add state in `EditorInner` (after `showCustomNodeModal` state):
```tsx
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
```

Add handler (after `onPaneClick`):
```tsx
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    if (store.viewMode) return;
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, [store.viewMode]);
```

Add `onNodeContextMenu` prop to `<ReactFlow>`:
```tsx
  onNodeContextMenu={onNodeContextMenu}
```

Add context menu render before the closing `</div>` of the outer div (before `{showCustomNodeModal && ...}`):
```tsx
  {contextMenu && (
    <NodeContextMenu
      nodeId={contextMenu.nodeId}
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu(null)}
    />
  )}
```

**Step 3: Manual test**

```bash
pnpm dev
```
- Open a diagram, add 2 nodes
- Right-click a node → context menu appears with 4 layer actions
- "Bring to Front" on one node → it appears above the other
- Right-clicking canvas or other elements closes the menu

**Step 4: Commit**

```bash
git add apps/web/src/components/NodeContextMenu.tsx apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add z-order context menu (bring to front/back) for nodes"
```

---

## Task 4: Z-order — AlignmentToolbar Z section

**Files:**
- Modify: `apps/web/src/components/AlignmentToolbar.tsx`
- Modify: `apps/web/src/stores/diagramStore.ts`
- Create: `apps/web/src/stores/__tests__/zorder-bulk.test.ts`

**Step 1: Write failing test**

Create `apps/web/src/stores/__tests__/zorder-bulk.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node } from "reactflow";

function makeNode(id: string, zIndex: number): Node {
  return { id, type: "techNode", position: { x: 0, y: 0 }, data: { label: id, category: "backend", zIndex } };
}

describe("bringSelectionToFront", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 5), makeNode("b", 15), makeNode("c", 25)],
      edges: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("sets all selected nodes to maxZ + 1", () => {
    useDiagramStore.getState().bringSelectionToFront();
    const state = useDiagramStore.getState();
    const a = state.nodes.find((n) => n.id === "a")!;
    const b = state.nodes.find((n) => n.id === "b")!;
    expect(a.data.zIndex).toBe(26);
    expect(b.data.zIndex).toBe(26);
  });
});

describe("sendSelectionToBack", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 5), makeNode("b", 15), makeNode("c", 25)],
      edges: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("sets all selected nodes to 1", () => {
    useDiagramStore.getState().sendSelectionToBack();
    const state = useDiagramStore.getState();
    const a = state.nodes.find((n) => n.id === "a")!;
    const b = state.nodes.find((n) => n.id === "b")!;
    expect(a.data.zIndex).toBe(1);
    expect(b.data.zIndex).toBe(1);
  });
});
```

**Step 2: Run — expect FAIL**

```bash
cd apps/web && pnpm test
```
Expected: FAIL

**Step 3: Add bulk z-order actions to store interface**

In `apps/web/src/stores/diagramStore.ts`, add to interface after `setNodeZIndex`:
```ts
  bringSelectionToFront: () => void;
  sendSelectionToBack: () => void;
```

Add to implementation:
```ts
  bringSelectionToFront: () =>
    set((s) => {
      const maxZ = Math.max(...s.nodes.map((n) => n.data?.zIndex ?? 10));
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
```

**Step 4: Run — expect PASS**

```bash
cd apps/web && pnpm test
```
Expected: all passing.

**Step 5: Add Z-order section to AlignmentToolbar**

In `apps/web/src/components/AlignmentToolbar.tsx`, replace the entire file:
```tsx
import { useDiagramStore } from "../stores/diagramStore";

const ALIGN_BUTTONS = [
  { key: "left",    title: "Align left",          label: "⇤" },
  { key: "centerH", title: "Center horizontally", label: "↔" },
  { key: "right",   title: "Align right",         label: "⇥" },
  { key: "top",     title: "Align top",           label: "⇡" },
  { key: "centerV", title: "Center vertically",   label: "↕" },
  { key: "bottom",  title: "Align bottom",        label: "⇣" },
] as const;

export function AlignmentToolbar({ count }: { count: number }) {
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
          <button onClick={() => distributeNodes("horizontal")} title="Distribute horizontally"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors font-mono text-sm">⇔</button>
          <button onClick={() => distributeNodes("vertical")} title="Distribute vertically"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-[#2d3148] hover:text-white transition-colors font-mono text-sm">⇕</button>
        </>
      )}

      {/* Z-order */}
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
    </div>
  );
}
```

**Step 6: Commit**

```bash
cd ../..
git add apps/web/src/components/AlignmentToolbar.tsx apps/web/src/stores/diagramStore.ts apps/web/src/stores/__tests__/zorder-bulk.test.ts
git commit -m "feat: bulk z-order (bring/send to front/back) in multi-select toolbar"
```

---

## Task 5: Auto-layout — install Dagre + store action

**Files:**
- Modify: `apps/web/package.json` (add dep)
- Modify: `apps/web/src/stores/diagramStore.ts`
- Create: `apps/web/src/stores/__tests__/autolayout.test.ts`

**Step 1: Install Dagre**

```bash
cd apps/web
pnpm add @dagrejs/dagre
pnpm add -D @types/dagre
```

**Step 2: Write failing test**

Create `apps/web/src/stores/__tests__/autolayout.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node, Edge } from "reactflow";

function makeNode(id: string, x = 0, y = 0): Node {
  return { id, type: "techNode", position: { x, y }, width: 150, height: 60, data: { label: id, category: "backend" } };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "animatedFlow", data: {} };
}

describe("autoLayout", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a", 0, 0), makeNode("b", 0, 0), makeNode("c", 0, 0)],
      edges: [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")],
    });
  });

  it("repositions nodes so they are no longer all at (0,0)", () => {
    useDiagramStore.getState().autoLayout();
    const positions = useDiagramStore.getState().nodes.map((n) => n.position);
    const allSame = positions.every((p) => p.x === 0 && p.y === 0);
    expect(allSame).toBe(false);
  });

  it("preserves all node ids", () => {
    useDiagramStore.getState().autoLayout();
    const ids = useDiagramStore.getState().nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("marks diagram dirty", () => {
    useDiagramStore.setState({ isDirty: false });
    useDiagramStore.getState().autoLayout();
    expect(useDiagramStore.getState().isDirty).toBe(true);
  });
});
```

**Step 3: Run — expect FAIL**

```bash
cd apps/web && pnpm test
```
Expected: FAIL — "autoLayout is not a function"

**Step 4: Add autoLayout to store interface**

In `apps/web/src/stores/diagramStore.ts`, add to interface:
```ts
  autoLayout: () => void;
```

**Step 5: Add autoLayout implementation**

Add import at top of `diagramStore.ts`:
```ts
import dagre from "@dagrejs/dagre";
```

Add to implementation (after `sendSelectionToBack`):
```ts
  autoLayout: () => {
    const { nodes, edges } = get();

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });

    // Only layout non-region nodes
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
```

**Step 6: Run — expect PASS**

```bash
cd apps/web && pnpm test
```
Expected: all passing.

**Step 7: Commit**

```bash
cd ../..
git add apps/web/package.json apps/web/src/stores/diagramStore.ts apps/web/src/stores/__tests__/autolayout.test.ts pnpm-lock.yaml
git commit -m "feat: add auto-layout (Dagre LR) action to diagram store"
```

---

## Task 6: Auto-layout — toolbar button

**Files:**
- Modify: `apps/web/src/components/DiagramEditor.tsx`

**Step 1: Add LayoutGrid import from lucide**

In `DiagramEditor.tsx`, add `LayoutGrid` to the lucide-react import:
```tsx
import {
  ArrowLeft, Save, Wifi, WifiOff, Eye, EyeOff,
  Download, ChevronDown, MousePointer2, StickyNote, Type, MessageSquare, LayoutGrid,
} from "lucide-react";
```

**Step 2: Get autoLayout from store and rfInstance from state**

`rfInstance` is already in state. `autoLayout` needs to be called then `fitView`. Add handler after `onDragOver`:
```tsx
  const handleAutoLayout = useCallback(() => {
    store.autoLayout();
    setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 50);
  }, [store, rfInstance]);
```

**Step 3: Add button to toolbar**

In the toolbar section, after the tool palette divider and before `<div className="flex-1" />`, add:
```tsx
        {!store.viewMode && (
          <>
            <div className="w-px h-5 bg-[#2d3148] mx-1" />
            <button
              onClick={handleAutoLayout}
              title="Auto Layout (Dagre)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2130] text-slate-400 text-sm border border-[#2d3148] hover:text-white transition-colors"
            >
              <LayoutGrid size={14} /> Auto Layout
            </button>
          </>
        )}
```

**Step 4: Manual test**

```bash
pnpm dev
```
- Create a diagram with 5+ nodes scattered randomly
- Click "Auto Layout" → nodes rearrange in a clean left-to-right graph
- Canvas auto-fits to show all nodes

**Step 5: Commit**

```bash
git add apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add Auto Layout button to toolbar"
```

---

## Task 7: Macros — types

**Files:**
- Modify: `apps/web/src/types/diagram.ts`

**Step 1: Add MacroDefinition type**

Append to `apps/web/src/types/diagram.ts`:
```ts
export interface MacroDefinition {
  id: string;
  name: string;
  tags: string[];
  nodes: import("reactflow").Node[];
  edges: import("reactflow").Edge[];
  createdAt: string;
  isLibrary?: boolean; // true = from personal library (server), false = local
  libraryId?: string;  // server-side id when published
}
```

**Step 2: Commit**

```bash
git add apps/web/src/types/diagram.ts
git commit -m "feat: add MacroDefinition type"
```

---

## Task 8: Macros — store actions

**Files:**
- Modify: `apps/web/src/stores/diagramStore.ts`
- Create: `apps/web/src/stores/__tests__/macros.test.ts`

**Step 1: Write failing tests**

Create `apps/web/src/stores/__tests__/macros.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDiagramStore } from "../diagramStore";
import { Node, Edge } from "reactflow";

function makeNode(id: string): Node {
  return { id, type: "techNode", position: { x: 10, y: 20 }, data: { label: id, category: "backend" } };
}
function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: "animatedFlow", data: {} };
}

describe("saveMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [makeNode("a"), makeNode("b"), makeNode("c")],
      edges: [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c"), makeEdge("e3", "a", "c")],
      macros: [],
      selectedNodeIds: ["a", "b"],
    });
  });

  it("saves a macro with selected nodes", () => {
    useDiagramStore.getState().saveMacro("My Pattern", ["auth"]);
    const macros = useDiagramStore.getState().macros;
    expect(macros).toHaveLength(1);
    expect(macros[0].name).toBe("My Pattern");
    expect(macros[0].nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("only includes edges where both endpoints are in selection", () => {
    useDiagramStore.getState().saveMacro("My Pattern", []);
    const macro = useDiagramStore.getState().macros[0];
    // e1 (a→b) is internal, e2 (b→c) and e3 (a→c) cross boundary
    expect(macro.edges.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("deleteMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [], edges: [],
      macros: [{ id: "m1", name: "Test", tags: [], nodes: [], edges: [], createdAt: "" }],
    });
  });

  it("removes macro by id", () => {
    useDiagramStore.getState().deleteMacro("m1");
    expect(useDiagramStore.getState().macros).toHaveLength(0);
  });
});

describe("insertMacro", () => {
  beforeEach(() => {
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      macros: [],
    });
  });

  it("adds cloned nodes at offset position", () => {
    const macro = {
      id: "m1", name: "Test", tags: [], createdAt: "",
      nodes: [makeNode("orig-a")],
      edges: [],
    };
    useDiagramStore.getState().insertMacro(macro, { x: 100, y: 200 });
    const nodes = useDiagramStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).not.toBe("orig-a"); // new UUID
    expect(nodes[0].position.x).toBe(100);
    expect(nodes[0].position.y).toBe(200);
  });

  it("remaps edge source/target to new node ids", () => {
    const macro = {
      id: "m1", name: "Test", tags: [], createdAt: "",
      nodes: [makeNode("orig-a"), makeNode("orig-b")],
      edges: [makeEdge("orig-e1", "orig-a", "orig-b")],
    };
    useDiagramStore.getState().insertMacro(macro, { x: 0, y: 0 });
    const { nodes, edges } = useDiagramStore.getState();
    expect(edges).toHaveLength(1);
    const [newA, newB] = nodes;
    expect(edges[0].source).toBe(newA.id);
    expect(edges[0].target).toBe(newB.id);
  });
});
```

**Step 2: Run — expect FAIL**

```bash
cd apps/web && pnpm test
```

**Step 3: Add macros state + actions to store**

In `apps/web/src/stores/diagramStore.ts`:

Add import:
```ts
import { MacroDefinition } from "../types/diagram";
```

Add to `DiagramStore` interface:
```ts
  macros: MacroDefinition[];
  saveMacro: (name: string, tags: string[]) => void;
  deleteMacro: (id: string) => void;
  insertMacro: (macro: MacroDefinition, position: { x: number; y: number }) => void;
  setMacros: (macros: MacroDefinition[]) => void;
```

Add to initial state:
```ts
  macros: [],
```

Add to implementation (after `sendSelectionToBack`):
```ts
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
    // Build id remap: original id → new id
    const idMap = new Map<string, string>();
    for (const n of macro.nodes) {
      idMap.set(n.id, crypto.randomUUID());
    }

    // Compute bounding box top-left of original nodes
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
```

**Step 4: Run — expect PASS**

```bash
cd apps/web && pnpm test
```
Expected: all passing.

**Step 5: Commit**

```bash
cd ../..
git add apps/web/src/stores/diagramStore.ts apps/web/src/stores/__tests__/macros.test.ts
git commit -m "feat: add macros state with saveMacro / deleteMacro / insertMacro actions"
```

---

## Task 9: Macros — backend Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Step 1: Add UserMacro model**

Append to `apps/api/prisma/schema.prisma`:
```prisma
model UserMacro {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  tags      String[] @default([])
  data      Json     // { nodes: Node[], edges: Edge[] }
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_macros")
}
```

Also add `macros UserMacro[]` to the `User` model relation list (after `sharedWith DiagramShare[]`):
```prisma
  macros        UserMacro[]
```

**Step 2: Push schema to database**

```bash
cd apps/api
pnpm db:push
```
Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Commit**

```bash
cd ../..
git add apps/api/prisma/schema.prisma
git commit -m "feat: add UserMacro table to Prisma schema"
```

---

## Task 10: Macros — backend API routes

**Files:**
- Create: `apps/api/src/routes/macros.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create macros route file**

Create `apps/api/src/routes/macros.ts`:
```ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const macroBodySchema = z.object({
  name: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  data: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
});

export async function macroRoutes(app: FastifyInstance) {
  // List user's macros
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const { id: userId } = req.user as { id: string };
    return prisma.userMacro.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  });

  // Create macro
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = macroBodySchema.parse(req.body);
    const macro = await prisma.userMacro.create({
      data: { userId, name: body.name, tags: body.tags, data: body.data },
    });
    return reply.code(201).send(macro);
  });

  // Delete macro
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const existing = await prisma.userMacro.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    await prisma.userMacro.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
}
```

**Step 2: Register routes in index.ts**

In `apps/api/src/index.ts`, find where other routes are registered (look for `app.register(diagramRoutes` or similar) and add:
```ts
import { macroRoutes } from "./routes/macros";
// ...
app.register(macroRoutes, { prefix: "/api/macros" });
```

**Step 3: Manual test**

```bash
pnpm dev
# In another terminal:
curl -s http://localhost:3001/api/macros -H "Cookie: <your-session-cookie>"
```
Expected: `[]` (empty array, authenticated).

**Step 4: Commit**

```bash
git add apps/api/src/routes/macros.ts apps/api/src/index.ts
git commit -m "feat: add macros CRUD API endpoints"
```

---

## Task 11: Macros — diagram persistence (save + load)

**Files:**
- Modify: `apps/api/src/routes/diagrams.ts`
- Modify: `apps/web/src/stores/diagramStore.ts`
- Modify: `apps/web/src/components/DiagramEditor.tsx`

**Step 1: Relax diagramBodySchema to allow macros**

In `apps/api/src/routes/diagrams.ts`, replace `diagramBodySchema`:
```ts
const diagramBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    macros: z.array(z.any()).optional(),
  }),
  isPublic: z.boolean().optional(),
  teamId: z.string().optional(),
});
```

**Step 2: Update loadDiagram in store to load macros**

In `apps/web/src/stores/diagramStore.ts`, update the `loadDiagram` signature and implementation:

Interface change:
```ts
  loadDiagram: (data: { nodes: Node[]; edges: Edge[]; macros?: MacroDefinition[] }) => void;
```

Implementation change:
```ts
  loadDiagram: (data) => set({
    nodes: data.nodes,
    edges: data.edges,
    macros: data.macros ?? [],
    isDirty: false,
  }),
```

**Step 3: Update save payload in DiagramEditor to include macros**

In `apps/web/src/components/DiagramEditor.tsx`, find the `save` function and update the body:
```ts
      body: JSON.stringify({
        name: store.diagramName,
        data: { nodes: store.nodes, edges: store.edges, macros: store.macros },
      }),
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/diagrams.ts apps/web/src/stores/diagramStore.ts apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: persist macros in diagram data (save + load)"
```

---

## Task 12: Macros — Save as Macro UI

**Files:**
- Create: `apps/web/src/components/modals/SaveMacroModal.tsx`
- Modify: `apps/web/src/components/NodeContextMenu.tsx`
- Modify: `apps/web/src/components/DiagramEditor.tsx`

**Step 1: Create SaveMacroModal**

Create `apps/web/src/components/modals/SaveMacroModal.tsx`:
```tsx
import { useState } from "react";
import { useDiagramStore } from "../../stores/diagramStore";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function SaveMacroModal({ onClose }: Props) {
  const [name, setName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const { saveMacro, selectedNodeIds } = useDiagramStore();

  const handleSave = () => {
    if (!name.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    saveMacro(name.trim(), tags);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-2xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Save as Macro</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Saving {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? "s" : ""} as a reusable snippet.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="e.g. Auth Service Pattern"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="auth, backend, kafka"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            Save Macro
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add "Save as Macro" to NodeContextMenu**

In `apps/web/src/components/NodeContextMenu.tsx`, add a prop `onSaveMacro` and a button:

Update Props interface:
```tsx
interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
  onSaveMacro: () => void;
}
```

Add `onSaveMacro` param to component signature.

Add a separator and button after the z-order actions:
```tsx
      <div className="border-t border-[#2d3148] mt-1 pt-1">
        <button
          onClick={() => { onSaveMacro(); onClose(); }}
          className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-[#2d3148] hover:text-indigo-300 transition-colors"
        >
          Save as Macro...
        </button>
      </div>
```

**Step 3: Wire SaveMacroModal in DiagramEditor**

Add import:
```tsx
import { SaveMacroModal } from "./modals/SaveMacroModal";
```

Add state:
```tsx
  const [showSaveMacroModal, setShowSaveMacroModal] = useState(false);
```

Before opening SaveMacroModal, ensure the node being right-clicked is selected. Update `onNodeContextMenu`:
```tsx
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    if (store.viewMode) return;
    // Select the right-clicked node if not already in selection
    if (!store.selectedNodeIds.includes(node.id)) {
      store.setSelectedNodeIds([node.id]);
      store.setSelectedNodeId(node.id);
    }
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, [store]);
```

Pass `onSaveMacro` to NodeContextMenu:
```tsx
  {contextMenu && (
    <NodeContextMenu
      nodeId={contextMenu.nodeId}
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu(null)}
      onSaveMacro={() => setShowSaveMacroModal(true)}
    />
  )}
```

Add modal render:
```tsx
  {showSaveMacroModal && <SaveMacroModal onClose={() => setShowSaveMacroModal(false)} />}
```

**Step 4: Add "Save selection as Macro" to AlignmentToolbar**

In `apps/web/src/components/AlignmentToolbar.tsx`, add prop and button:

```tsx
interface Props {
  count: number;
  onSaveMacro: () => void;
}

export function AlignmentToolbar({ count, onSaveMacro }: Props) {
```

Add button after the Layer section:
```tsx
      <div className="w-px h-4 bg-[#2d3148] mx-0.5" />
      <button
        onClick={onSaveMacro}
        title="Save selection as Macro"
        className="px-2.5 h-7 rounded-lg flex items-center text-indigo-400 hover:bg-[#2d3148] hover:text-indigo-300 transition-colors text-xs"
      >
        + Macro
      </button>
```

In `DiagramEditor.tsx`, update the AlignmentToolbar usage to pass `onSaveMacro`:
```tsx
  <AlignmentToolbar count={multiCount} onSaveMacro={() => setShowSaveMacroModal(true)} />
```

**Step 5: Commit**

```bash
git add apps/web/src/components/modals/SaveMacroModal.tsx apps/web/src/components/NodeContextMenu.tsx apps/web/src/components/AlignmentToolbar.tsx apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add Save as Macro UI (context menu, multi-select toolbar, modal)"
```

---

## Task 13: Macros — Snippets tab in NodePanel

**Files:**
- Modify: `apps/web/src/components/NodePanel.tsx`

**Step 1: Add Snippets tab to NodePanel**

Replace the full `NodePanel.tsx` with the updated version that adds a Snippets tab:

```tsx
import { useState, useEffect } from "react";
import { NODE_LIBRARY, CATEGORIES, REGION_TEMPLATES, NodeTemplate } from "../lib/nodeLibrary";
import { NodeCategory, MacroDefinition } from "../types/diagram";
import { NODE_ICONS } from "../lib/nodeIcons";
import { Search, Plus, Map, Blocks, Trash2, Upload } from "lucide-react";
import { useDiagramStore } from "../stores/diagramStore";

interface Props {
  onDragStart: (e: React.DragEvent, template: NodeTemplate) => void;
  onCreateCustom: () => void;
  rfInstance: import("reactflow").ReactFlowInstance | null;
}

type PanelTab = "nodes" | "snippets";

export function NodePanel({ onDragStart, onCreateCustom, rfInstance }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("nodes");
  const [activeCategory, setActiveCategory] = useState<NodeCategory | "all" | "regions">("all");
  const [search, setSearch] = useState("");
  const { customTemplates, macros, deleteMacro, insertMacro, setMacros } = useDiagramStore();
  const [libraryMacros, setLibraryMacros] = useState<(MacroDefinition & { libraryId: string })[]>([]);

  // Fetch personal library macros from API
  useEffect(() => {
    if (activeTab !== "snippets") return;
    fetch("/api/macros", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
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
      .catch(() => {});
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
      setLibraryMacros((prev) => [...prev, { ...macro, libraryId: created.id, isLibrary: true }]);
    }
  };

  const deleteLibraryMacro = async (libraryId: string) => {
    await fetch(`/api/macros/${libraryId}`, { method: "DELETE", credentials: "include" });
    setLibraryMacros((prev) => prev.filter((m) => m.libraryId !== libraryId));
  };

  const handleInsertMacro = (macro: MacroDefinition) => {
    const center = rfInstance?.getViewport()
      ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      : { x: 200, y: 200 };
    const pos = rfInstance?.screenToFlowPosition(center) ?? { x: 200, y: 200 };
    insertMacro(macro, pos);
  };

  const allTemplates = [...NODE_LIBRARY, ...customTemplates];
  const filtered = allTemplates.filter((n) => {
    if (activeCategory === "regions") return false;
    const matchCat = activeCategory === "all" || n.category === activeCategory;
    const matchSearch = !search || n.label.toLowerCase().includes(search.toLowerCase()) || (n.tech || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const showRegions = activeCategory === "regions" || (activeCategory === "all" && !search);

  return (
    <div className="w-56 flex-shrink-0 border-r border-[#2d3148] bg-[#13151f] flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#2d3148]">
        <button
          onClick={() => setActiveTab("nodes")}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === "nodes" ? "text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
        >
          Nodes
        </button>
        <button
          onClick={() => setActiveTab("snippets")}
          className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${activeTab === "snippets" ? "text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300"}`}
        >
          <Blocks size={11} /> Snippets
          {macros.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 leading-tight">{macros.length}</span>
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
            <button onClick={() => setActiveCategory("all")}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${activeCategory === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
              All
            </button>
            {CATEGORIES.filter(c => c.id !== "region" && c.id !== "custom").map((c) => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className="px-2 py-0.5 rounded text-xs transition-colors"
                style={activeCategory === c.id ? { background: c.color + "33", color: c.color } : { color: "#64748b" }}>
                {c.label}
              </button>
            ))}
            <button onClick={() => setActiveCategory("regions")}
              className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${activeCategory === "regions" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
              <Map size={10} /> Regions
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {activeCategory === "regions" && (
              <>
                <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">Drag to canvas</div>
                {REGION_TEMPLATES.map((template) => (
                  <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                ))}
              </>
            )}
            {activeCategory !== "regions" && (
              <>
                {customTemplates.length > 0 && (activeCategory === "all" || activeCategory === "custom") && (
                  <>
                    <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider mt-1">Custom</div>
                    {customTemplates.map((template) => (
                      <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                    ))}
                    <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider mt-1">Library</div>
                  </>
                )}
                {filtered.map((template) => (
                  <NodeItem key={template.id} template={template} onDragStart={onDragStart} />
                ))}
              </>
            )}
          </div>

          <div className="p-2 border-t border-[#2d3148]">
            <button onClick={onCreateCustom}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-indigo-400 hover:border-indigo-500 text-xs transition-colors">
              <Plus size={12} /> Create custom node
            </button>
          </div>
        </>
      )}

      {/* SNIPPETS TAB */}
      {activeTab === "snippets" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Local macros */}
          {macros.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">This diagram</div>
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

          {/* Library macros */}
          <div className="p-2 border-t border-[#2d3148]">
            <div className="text-xs text-slate-600 px-2 py-1 font-medium uppercase tracking-wider">My Library</div>
            {libraryMacros.length === 0 && (
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
                Select nodes and right-click → "Save as Macro" to create reusable snippets
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NodeItem({ template, onDragStart }: { template: NodeTemplate; onDragStart: (e: React.DragEvent, t: NodeTemplate) => void }) {
  const icon = template.customIcon || NODE_ICONS[template.tech || ""] || NODE_ICONS[template.category] || "⬡";
  const cat = CATEGORIES.find((c) => c.id === template.category);
  const color = template.customColor || cat?.color || "#64748b";
  return (
    <div draggable onDragStart={(e) => onDragStart(e, template)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-[#1e2130] transition-colors">
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate leading-tight">{template.label}</div>
        {template.description && <div className="text-xs text-slate-500 truncate">{template.description}</div>}
      </div>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
    </div>
  );
}

function MacroItem({ macro, onInsert, onDelete, onPublish, showPublish }: {
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
        <div className="text-xs text-slate-500">{macro.nodes.length} nodes · {macro.edges.length} edges</div>
        {macro.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {macro.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2d3148] text-slate-400">{tag}</span>
            ))}
          </div>
        )}
      </button>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        {showPublish && onPublish && (
          <button onClick={onPublish} title="Publish to My Library"
            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors">
            <Upload size={12} />
          </button>
        )}
        <button onClick={onDelete} title="Delete macro"
          className="p-1 text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update DiagramEditor to pass rfInstance to NodePanel**

In `DiagramEditor.tsx`, find the `<NodePanel>` usage and add `rfInstance`:
```tsx
  <NodePanel
    onDragStart={onDragStart}
    onCreateCustom={() => setShowCustomNodeModal(true)}
    rfInstance={rfInstance}
  />
```

**Step 3: Manual test**

```bash
pnpm dev
```
- Open a diagram
- Add several nodes, select 3, right-click → "Save as Macro..." → enter name → Save
- NodePanel shows "Snippets" tab with badge "1"
- Click Snippets → see your macro with node/edge count
- Click macro name → nodes appear on canvas at current viewport center
- Click Upload icon → macro moves to "My Library"
- Open another diagram → Snippets tab → My Library has the macro

**Step 4: Commit**

```bash
cd ../..
git add apps/web/src/components/NodePanel.tsx apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: Snippets tab in NodePanel with local macros and personal library"
```

---

## Done — Wave 1 Complete

Run full test suite:
```bash
cd apps/web && pnpm test
```

All features shipped:
- **Z-order:** right-click context menu + multi-select bulk layer control
- **Auto-layout:** Dagre LR with fitView
- **Macros:** save selection → Snippets tab → insert as copy → publish to personal library
