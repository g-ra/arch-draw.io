# WebSocket Real-Time Synchronization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement reliable real-time synchronization of diagram changes across up to 3 concurrent users using WebSocket with full state sync and versioning.

**Architecture:** Full state sync with client-side versioning. Each client maintains a version number and unique sender ID. On change, client sends full state (nodes + edges) with incremented version. Other clients apply updates only if version is newer. Throttling (150ms) prevents spam during drag operations. Exponential backoff handles reconnections.

**Tech Stack:** TypeScript, React, Fastify WebSocket, Zustand

---

## Task 1: Fix Blob Parsing Error (Critical)

**Priority:** P0 - Blocks all other work
**Time:** 30 minutes
**Dependencies:** None

**Files:**
- Modify: `apps/api/src/routes/ws.ts:31-39`
- Modify: `apps/web/src/components/DiagramEditor.tsx:127-131`

### Step 1: Fix backend to send JSON strings

**File:** `apps/api/src/routes/ws.ts`

**Change lines 31-39 from:**
```typescript
socket.on("message", (raw: Buffer) => {
  const room = rooms.get(diagramId);
  if (!room) return;
  // Рассылаем всем кроме отправителя
  for (const client of room) {
    if (client !== socket && client.readyState === 1) {
      client.send(raw);
    }
  }
});
```

**To:**
```typescript
socket.on("message", (raw: Buffer) => {
  const room = rooms.get(diagramId);
  if (!room) return;

  // Parse and re-stringify to ensure JSON format
  try {
    const msg = JSON.parse(raw.toString());
    const jsonString = JSON.stringify(msg);

    // Broadcast to all except sender
    for (const client of room) {
      if (client !== socket && client.readyState === 1) {
        client.send(jsonString);
      }
    }
  } catch (err) {
    console.error("WS message parse error:", err);
  }
});
```

### Step 2: Fix frontend to handle string messages

**File:** `apps/web/src/components/DiagramEditor.tsx`

**Change lines 127-131 from:**
```typescript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "nodes") store.setNodes(msg.payload);
  if (msg.type === "edges") store.setEdges(msg.payload);
};
```

**To:**
```typescript
ws.onmessage = async (e) => {
  try {
    // Handle both string and Blob
    let data = e.data;
    if (data instanceof Blob) {
      data = await data.text();
    }

    const msg = JSON.parse(data);
    if (msg.type === "nodes") store.setNodes(msg.payload);
    if (msg.type === "edges") store.setEdges(msg.payload);
  } catch (err) {
    console.error("WS message parse error:", err);
  }
};
```

### Step 3: Build and test

**Backend:**
```bash
cd apps/api
npm run build
```
Expected: Build succeeds

**Frontend:**
```bash
cd apps/web
npm run build
```
Expected: Build succeeds

### Step 4: Manual test

1. Start backend: `cd apps/api && npm run dev`
2. Start frontend: `cd apps/web && npm run dev`
3. Open two browser tabs with same diagram
4. Move a block in one tab
5. Verify: No "Unexpected token 'o'" errors in console
6. Verify: Block moves in other tab (may have infinite loop - that's OK for now)

### Step 5: Commit

```bash
git add apps/api/src/routes/ws.ts apps/web/src/components/DiagramEditor.tsx
git commit -m "fix: resolve WebSocket Blob parsing error

- Backend: parse and re-stringify messages as JSON strings
- Frontend: handle both string and Blob message types
- Fixes 'Unexpected token o' JSON parse errors"
```

---

## Task 2: Implement Versioning System

**Priority:** P1 - Prevents infinite loops
**Time:** 2-3 hours
**Dependencies:** Task 1 must be complete

**Files:**
- Modify: `apps/web/src/components/DiagramEditor.tsx:120-180`

### Step 6: Add version and sender ID refs

**File:** `apps/web/src/components/DiagramEditor.tsx`

**Add after line 73 (after `wsRef` declaration):**
```typescript
const versionRef = useRef(0);
const senderIdRef = useRef(crypto.randomUUID());
const isApplyingRemoteChangeRef = useRef(false);
```

### Step 7: Update WebSocket message handler with versioning

**Replace the ws.onmessage handler (around line 127) with:**
```typescript
ws.onmessage = async (e) => {
  try {
    // Handle both string and Blob
    let data = e.data;
    if (data instanceof Blob) {
      data = await data.text();
    }

    const msg = JSON.parse(data);

    // Handle sync messages with versioning
    if (msg.type === "sync") {
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
      setTimeout(() => {
        isApplyingRemoteChangeRef.current = false;
      }, 0);
    }

    // Legacy support (remove after migration)
    if (msg.type === "nodes") store.setNodes(msg.payload);
    if (msg.type === "edges") store.setEdges(msg.payload);
  } catch (err) {
    console.error("WS message parse error:", err);
  }
};
```

### Step 8: Create sendUpdate function

**Add after the WebSocket useEffect (around line 133):**
```typescript
// Send versioned update to other clients
const sendUpdate = useCallback(() => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
    console.log("[WS] Cannot send: socket not open");
    return;
  }

  // Don't send if we're applying a remote change
  if (isApplyingRemoteChangeRef.current) {
    console.log("[WS] Skipping send: applying remote change");
    return;
  }

  versionRef.current++;
  const message = {
    type: "sync",
    version: versionRef.current,
    senderId: senderIdRef.current,
    timestamp: Date.now(),
    data: {
      nodes: store.nodes,
      edges: store.edges,
    },
  };

  console.log(`[WS] Sending version ${versionRef.current}`);
  wsRef.current.send(JSON.stringify(message));
}, [store.nodes, store.edges]);
```

### Step 9: Update existing wrapper functions to use sendUpdate

**Find the existing `handleNodesChange`, `handleEdgesChange`, `handleConnect` functions (around lines 160-180).**

**Replace them with:**
```typescript
// Wrapper for onNodesChange that sends WS update
const handleNodesChange = useCallback((changes: any) => {
  store.onNodesChange(changes);
  if (!isApplyingRemoteChangeRef.current) {
    sendUpdate();
  }
}, [sendUpdate]);

// Wrapper for onEdgesChange that sends WS update
const handleEdgesChange = useCallback((changes: any) => {
  store.onEdgesChange(changes);
  if (!isApplyingRemoteChangeRef.current) {
    sendUpdate();
  }
}, [sendUpdate]);

// Wrapper for onConnect that sends WS update
const handleConnect = useCallback((connection: any) => {
  store.onConnect(connection);
  if (!isApplyingRemoteChangeRef.current) {
    sendUpdate();
  }
}, [sendUpdate]);
```

### Step 10: Build and test versioning

**Build:**
```bash
cd apps/web
npm run build
```
Expected: Build succeeds

**Manual test:**
1. Open two tabs with same diagram
2. Open browser console in both tabs
3. Move a block in tab 1
4. Verify in tab 1 console: `[WS] Sending version 1`
5. Verify in tab 2 console: `[WS] Applying version 1 from [sender-id]`
6. Verify in tab 1 console: `[WS] Ignoring own message`
7. Verify: Block moves in tab 2
8. Verify: NO infinite loop (block doesn't keep moving)

### Step 11: Commit versioning

```bash
git add apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add WebSocket versioning to prevent infinite loops

- Add versionRef and senderIdRef for tracking state
- Implement version checking in message handler
- Ignore own messages and old versions
- Add isApplyingRemoteChangeRef flag to prevent echo
- Update change handlers to use versioned sendUpdate"
```

---

## Task 3: Implement Throttling and Reconnection

**Priority:** P1 - Performance and reliability
**Time:** 2-3 hours
**Dependencies:** Task 2 must be complete

**Files:**
- Modify: `apps/web/src/components/DiagramEditor.tsx:135-180`

### Step 12: Add throttling to sendUpdate

**Replace the `sendUpdate` function created in Step 8 with throttled version:**

```typescript
// Throttle refs
const throttleTimerRef = useRef<number | null>(null);
const pendingUpdateRef = useRef(false);

// Send versioned update to other clients (immediate)
const sendUpdateImmediate = useCallback(() => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
    console.log("[WS] Cannot send: socket not open");
    return;
  }

  if (isApplyingRemoteChangeRef.current) {
    console.log("[WS] Skipping send: applying remote change");
    return;
  }

  versionRef.current++;
  const message = {
    type: "sync",
    version: versionRef.current,
    senderId: senderIdRef.current,
    timestamp: Date.now(),
    data: {
      nodes: store.nodes,
      edges: store.edges,
    },
  };

  console.log(`[WS] Sending version ${versionRef.current}`);
  wsRef.current.send(JSON.stringify(message));
  pendingUpdateRef.current = false;
}, [store.nodes, store.edges]);

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
    }
    throttleTimerRef.current = null;
  }, 150);
}, [sendUpdateImmediate]);
```

### Step 13: Add reconnection logic with exponential backoff

**Replace the WebSocket useEffect (around line 120) with:**

```typescript
// Reconnection state
const reconnectAttemptsRef = useRef(0);
const offlineChangesRef = useRef(false);

// WebSocket connection with auto-reconnect
useEffect(() => {
  if (!diagramId) return;

  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;

  const connect = () => {
    console.log("[WS] Connecting...");
    ws = new WebSocket(`ws://${location.host}/ws/diagram/${diagramId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Send current state if we made offline changes
      if (offlineChangesRef.current) {
        console.log("[WS] Syncing offline changes");
        sendUpdateImmediate();
        offlineChangesRef.current = false;
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setWsConnected(false);
      wsRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        30000
      );
      reconnectAttemptsRef.current++;

      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
      reconnectTimeout = window.setTimeout(() => connect(), delay);
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      ws?.close();
    };

    ws.onmessage = async (e) => {
      try {
        let data = e.data;
        if (data instanceof Blob) {
          data = await data.text();
        }

        const msg = JSON.parse(data);

        if (msg.type === "sync") {
          if (msg.senderId === senderIdRef.current) {
            console.log("[WS] Ignoring own message");
            return;
          }

          if (msg.version <= versionRef.current) {
            console.log(`[WS] Ignoring old version ${msg.version}, current: ${versionRef.current}`);
            return;
          }

          console.log(`[WS] Applying version ${msg.version} from ${msg.senderId}`);
          isApplyingRemoteChangeRef.current = true;
          versionRef.current = msg.version;

          if (msg.data.nodes) store.setNodes(msg.data.nodes);
          if (msg.data.edges) store.setEdges(msg.data.edges);

          setTimeout(() => {
            isApplyingRemoteChangeRef.current = false;
          }, 0);
        }

        // Legacy support
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
    if (ws) ws.close();
  };
}, [diagramId, sendUpdateImmediate]);
```

### Step 14: Track offline changes

**Update the wrapper functions to track offline changes:**

```typescript
const handleNodesChange = useCallback((changes: any) => {
  store.onNodesChange(changes);
  if (!isApplyingRemoteChangeRef.current) {
    if (!wsConnected) {
      offlineChangesRef.current = true;
    }
    sendUpdate();
  }
}, [sendUpdate, wsConnected]);

const handleEdgesChange = useCallback((changes: any) => {
  store.onEdgesChange(changes);
  if (!isApplyingRemoteChangeRef.current) {
    if (!wsConnected) {
      offlineChangesRef.current = true;
    }
    sendUpdate();
  }
}, [sendUpdate, wsConnected]);

const handleConnect = useCallback((connection: any) => {
  store.onConnect(connection);
  if (!isApplyingRemoteChangeRef.current) {
    if (!wsConnected) {
      offlineChangesRef.current = true;
    }
    sendUpdate();
  }
}, [sendUpdate, wsConnected]);
```

### Step 15: Build and test throttling

**Build:**
```bash
cd apps/web
npm run build
```
Expected: Build succeeds

**Manual test - Throttling:**
1. Open two tabs
2. Open console in both
3. Drag a block rapidly in tab 1 for 3 seconds
4. Count console messages `[WS] Sending version X`
5. Verify: ~6-7 messages (not 60+)
6. Verify: Block moves smoothly in tab 2

**Manual test - Reconnection:**
1. Open two tabs
2. In browser DevTools Network tab, set throttling to "Offline"
3. Move a block in tab 1
4. Verify console: `[WS] Disconnected`
5. Verify console: `[WS] Reconnecting in 1000ms`
6. Set throttling back to "Online"
7. Verify console: `[WS] Connected` and `[WS] Syncing offline changes`
8. Verify: Block appears in tab 2

### Step 16: Commit throttling and reconnection

```bash
git add apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add throttling and auto-reconnection to WebSocket

- Throttle updates to 150ms to prevent spam during drag
- Implement exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
- Track offline changes and sync on reconnect
- Add comprehensive console logging for debugging"
```

---

## Task 4: Add Immediate Sync for Critical Operations

**Priority:** P2 - UX improvement
**Time:** 30 minutes
**Dependencies:** Task 3 must be complete

**Files:**
- Modify: `apps/web/src/stores/diagramStore.ts:121-191`
- Modify: `apps/web/src/components/DiagramEditor.tsx:250-350`

### Step 17: Expose immediate sync function

**In DiagramEditor.tsx, add after sendUpdateImmediate definition:**

```typescript
// Make immediate sync available to other components
useEffect(() => {
  // Store reference for immediate sync operations
  (window as any).__techflowImmediateSync = sendUpdateImmediate;
  return () => {
    delete (window as any).__techflowImmediateSync;
  };
}, [sendUpdateImmediate]);
```

### Step 18: Use immediate sync for add/delete operations

**Find the `onDrop` callback (around line 257) and add at the end:**

```typescript
const onDrop = useCallback((e: React.DragEvent) => {
  // ... existing code ...

  // After adding node, sync immediately
  if ((window as any).__techflowImmediateSync) {
    (window as any).__techflowImmediateSync();
  }
}, [rfInstance]);
```

**Find the `onPaneClick` callback (around line 202) and add immediate sync after each `store.addNode` call:**

```typescript
if (state.tool === "sticky") {
  state.addNode({
    // ... existing code ...
  });
  state.setTool("select");
  if ((window as any).__techflowImmediateSync) {
    (window as any).__techflowImmediateSync();
  }
  return;
}
```

Repeat for "text" and "comment" tools.

### Step 19: Test immediate sync

**Manual test:**
1. Open two tabs
2. Add a new block in tab 1
3. Verify: Block appears in tab 2 within ~50ms (not 150ms)
4. Move the block
5. Verify: Movement is throttled to 150ms

### Step 20: Commit immediate sync

```bash
git add apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: add immediate sync for add/delete operations

- New blocks sync immediately (no throttle delay)
- Improves perceived responsiveness for critical operations
- Movement still throttled to 150ms"
```

---

## Testing Checklist

After completing all tasks, verify:

### Basic Sync
- [ ] Open two tabs, move block in one, appears in other within 200ms
- [ ] Add new block, appears immediately in other tab
- [ ] Delete block, disappears in other tab
- [ ] Create edge, appears in other tab
- [ ] Delete edge, disappears in other tab

### Versioning
- [ ] No "Unexpected token 'o'" errors in console
- [ ] No infinite loops (block doesn't keep moving after you stop)
- [ ] Console shows "Ignoring own message" for sender
- [ ] Console shows "Applying version X" for receiver

### Throttling
- [ ] Drag block rapidly, console shows ~6-7 updates/sec (not 60+)
- [ ] Block movement feels smooth in other tab
- [ ] Add block syncs immediately (no 150ms delay)

### Reconnection
- [ ] Set network to offline, make changes, go online
- [ ] Console shows reconnection attempts with increasing delays
- [ ] Changes sync after reconnection
- [ ] Multiple reconnect attempts work (test 3-4 times)

### Edge Cases
- [ ] Three tabs open, all sync correctly
- [ ] Close one tab, others continue working
- [ ] Refresh page, reconnects and syncs
- [ ] Edit node properties (endpoints, topics), syncs to other tabs

---

## Rollback Plan

If issues occur:

**Rollback Task 4:**
```bash
git revert HEAD
```

**Rollback Task 3:**
```bash
git revert HEAD~1
```

**Rollback Task 2:**
```bash
git revert HEAD~2
```

**Rollback Task 1:**
```bash
git revert HEAD~3
```

---

## Success Criteria

- ✅ No Blob parsing errors
- ✅ Block movements sync within 150-200ms
- ✅ No infinite loops or message echoes
- ✅ Graceful handling of disconnections with auto-reconnect
- ✅ Works for 3 concurrent users
- ✅ All operations sync (move, add, delete, edit properties)
- ✅ Throttling prevents spam (~6-7 updates/sec during drag)
- ✅ Critical operations (add/delete) sync immediately
