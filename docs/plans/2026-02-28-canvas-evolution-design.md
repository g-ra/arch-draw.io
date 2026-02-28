# TechFlow — Canvas Evolution Design

**Date:** 2026-02-28
**Status:** Approved
**Target users:** Software architects and engineers

---

## Context

TechFlow is an architecture diagram editor with animated data flows, 35+ tech nodes, real-time WebSocket sync, and export to PNG/SVG/Mermaid/draw.io. The next development phase focuses on power-user UX, reusability, and review workflows.

---

## Scope: Three Waves

### Wave 1 — UX Fundamentals (independent, fast wins)
1. Z-order management
2. Auto-layout (Dagre)
3. Macros / Snippet library

### Wave 2 — Canvas Evolution
4. Multi-page diagrams (tabs)

### Wave 3 — Review Workflow
5. Threaded comments
6. Presentation mode

---

## Wave 1: UX Fundamentals

### 1. Z-order Management

**Goal:** Let users control layering of nodes — push behind region groups, bring annotations in front of other nodes.

**UX:** Right-click context menu on any node with four actions:
- Bring to Front
- Bring Forward
- Send Backward
- Send to Back

**Data model:** `zIndex` field added to `TechNodeData`. Default: `10` (current hardcoded value). `regionGroup` stays at `0`. User-set values range `1–999`.

**Implementation:** `DiagramEditor` already computes `zIndex` per node in `displayNodes` memo — extend this to read `data.zIndex` when present. Store `zIndex` in Zustand node data and persist with diagram.

**Multi-select:** When 2+ nodes selected, AlignmentToolbar gets Z-order buttons.

---

### 2. Auto-layout (Dagre)

**Goal:** One-click to automatically arrange nodes into a readable left-to-right graph.

**Algorithm:** Dagre (directed acyclic graph layout). Already in ReactFlow ecosystem — add `dagre` npm package.

**UX:** "Auto Layout" button in the toolbar (between alignment and export). On click:
1. Run Dagre on current nodes + edges
2. Apply computed positions to all non-region nodes
3. Call `fitView()` to center result
4. Mark diagram as dirty (triggers autosave)

**Options:** Direction LR (left-to-right) — standard for architecture diagrams. No UI for direction in MVP.

**Region handling:** `regionGroup` nodes are excluded from Dagre layout (they're containers, not graph nodes). Their children are laid out independently within the region bounds, or user repositions manually.

**Edge cases:** Disconnected subgraphs (islands) — Dagre handles them; isolated nodes get stacked on the left.

---

### 3. Macros / Snippet Library

**Goal:** Save a selection of nodes + edges as a named reusable template. Paste as an independent copy (not a live component).

#### Saving a macro
- Select 2+ nodes → right-click → "Save as Macro..."
- Modal: enter name, optional tags (e.g. `auth`, `kafka-pattern`)
- Captured: all selected nodes, all edges where both source and target are in selection
- External edges (connecting to non-selected nodes) are excluded

#### Inserting a macro
- `NodePanel` gets a new tab: **Snippets**
- Each macro shown as a card with name + node count
- Drag onto canvas or click to place at canvas center
- On insert: deep clone all nodes + edges, generate new UUIDs, offset positions by +20px to avoid exact overlap

#### Storage: two levels

**Local (per-diagram):**
- Field `macros: MacroDefinition[]` added to diagram JSON
- Stored in `data` column of `diagrams` table — no schema migration needed
- Available only within that diagram

**Personal library (global per-user):**
- New DB table: `user_macros (id, userId, name, tags[], data jsonb, createdAt)`
- API endpoints: `GET /api/macros`, `POST /api/macros`, `DELETE /api/macros/:id`
- "Publish to My Library" button on local macro → copies to user_macros
- Snippets tab shows both local and library macros with visual distinction

#### MacroDefinition type
```typescript
interface MacroDefinition {
  id: string;
  name: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
}
```

---

## Wave 2: Multi-page Diagrams

**Goal:** Support multiple named pages (views) within a single diagram — e.g. C4 levels: Context → Container → Component → Code.

### Data model change
Diagram `data` changes from `{ nodes, edges }` to:
```typescript
{
  pages: [
    { id: string; name: string; nodes: Node[]; edges: Edge[] },
    ...
  ],
  activePage: string; // page id
}
```

Backward compatible: migration reads `data.nodes` — if present (old format), wraps in `pages[0]` named "Main".

### UX
- Tab bar at the **bottom** of the canvas (draw.io style)
- "+" button to add page, double-click tab to rename, right-click to delete (with confirmation if non-empty)
- Active page indicator
- MiniMap and autosave operate per active page

### Real-time sync
WebSocket messages include `pageId`. Each user's active page is independent — users can be on different pages simultaneously.

### Versioning
Version snapshots store the full `{ pages }` object. Version history restore replaces all pages.

### Constraints (MVP)
- No cross-page edges
- No page thumbnails in tab bar (text only)
- Max 20 pages per diagram

---

## Wave 3: Review Workflow

### 5. Threaded Comments

**Goal:** Upgrade the existing basic comment system to support reply threads and resolution workflow.

**Current state:** Comments are stored as `StickyNoteData` with `author` field. Basic, no replies.

**New comment model:**
```typescript
interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  replies: CommentReply[];
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  // Anchor: either canvas position or nodeId
  position?: { x: number; y: number };
  nodeId?: string;
}
interface CommentReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
```

**UX:**
- Comment tool (C) places a comment pin on canvas or attaches to node
- Click pin → side panel opens showing thread
- Reply input at bottom of thread
- "Resolve" button — collapses thread, marks green
- Filter bar: All / Open / Resolved
- Comment count badge in toolbar

**Storage:** Comments stored in diagram `data` alongside pages. Synced via WebSocket.

---

### 6. Presentation Mode

**Goal:** Walk through an architecture diagram as a sequence of "frames" (saved viewport positions + zoom) — like slides, but on the live canvas.

**Frames:** A frame = `{ id, name, viewport: { x, y, zoom }, pageId }`.
Stored in diagram data as `frames: Frame[]`.

**UX:**
- "Present" button in toolbar → enters presentation mode (fullscreen, hides panels)
- Frame management panel (edit mode): "Add Frame" saves current viewport, drag to reorder
- In presentation mode: Left/Right arrows or clicking to advance
- ESC to exit
- Each frame can point to any page (cross-page presentation)

**Use case:** Architecture review session — walk team through Context diagram → Container diagram → zoom into critical service → show data flow animation.

---

## Technical Notes

### Packages to add
- `dagre` — graph layout algorithm
- `@dagrejs/dagre` (typed version) — for auto-layout

### Files most affected
| File | Changes |
|------|---------|
| `types/diagram.ts` | New types: MacroDefinition, Comment, Frame, Page |
| `stores/diagramStore.ts` | Multi-page state, macro CRUD, z-order actions |
| `components/DiagramEditor.tsx` | Tab bar, presentation mode, auto-layout button |
| `components/NodePanel.tsx` | Snippets tab |
| `apps/api/prisma/schema.prisma` | `user_macros` table |
| `apps/api/src/routes/` | Macros API endpoints |

### No breaking changes in Wave 1
Wave 1 (z-order, auto-layout, macros) has no schema migrations and no data format changes. Safe to ship independently.

Wave 2 requires diagram data migration (old format → pages format). Migration is backward-compatible read with forward-compatible write.

---

## Success Criteria

| Feature | Done when |
|---------|-----------|
| Z-order | Right-click menu works, zIndex persists, regions stay behind |
| Auto-layout | Dagre positions all nodes, fitView called, works on disconnected graphs |
| Macros | Save → appears in Snippets tab → drag to canvas → independent copy |
| Personal library | Publish → available across all diagrams → survives page refresh |
| Multi-page | Add/rename/delete pages, switch pages, autosave per page, WS sync |
| Threaded comments | Reply, resolve, filter, pin on canvas |
| Presentation | Add frames, navigate with arrows, fullscreen |
