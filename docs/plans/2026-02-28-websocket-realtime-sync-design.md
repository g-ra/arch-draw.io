# WebSocket Real-Time Synchronization Design

**Date:** 2026-02-28
**Status:** Approved
**Approach:** Full State Sync with Versioning

## Overview

Design for reliable real-time synchronization of diagram changes across up to 3 concurrent users using WebSocket with full state sync and versioning.

## Requirements

- Synchronize all diagram changes in real-time (150-200ms latency)
- Support operations: move blocks, add/delete blocks and edges, edit properties (endpoints, topics, labels, colors)
- Work for both authenticated and guest users
- Handle disconnections gracefully with offline buffering
- Prevent infinite loops when broadcasting changes
- Conflict resolution: last write wins

## Architecture

### Approach: Full State Sync with Versioning

Each client maintains a local version number. On change, client sends full state (nodes + edges) with incremented version. Other clients apply updates only if version is newer than their current version.

**Why this approach:**
- Simple to implement and debug
- Versioning elegantly prevents infinite loops
- For 3 users, bandwidth is not a concern
- Easy to add offline buffering

## WebSocket Protocol

### Message Types

**1. Sync Message (client → server → other clients)**
```typescript
{
  type: "sync",
  version: number,        // Monotonically increasing
  senderId: string,       // Unique client ID
  timestamp: number,      // Unix timestamp
  data: {
    nodes: Node[],
    edges: Edge[]
  }
}
```

**2. Request Sync (client → server, on reconnect)**
```typescript
{
  type: "request_sync",
  clientVersion: number
}
```

**3. Full Sync Response (server → client)**
```typescript
{
  type: "full_sync",
  version: number,
  data: { nodes, edges }
}
```

## Versioning and Infinite Loop Prevention

### Client State
```typescript
const versionRef = useRef(0);                    // Current state version
const senderIdRef = useRef(crypto.randomUUID()); // Unique client ID
```

### Receiving Updates
```typescript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);

  // Ignore own messages
  if (msg.senderId === senderIdRef.current) return;

  // Ignore old versions
  if (msg.version <= versionRef.current) return;

  // Apply update
  versionRef.current = msg.version;
  store.setNodes(msg.data.nodes);
  store.setEdges(msg.data.edges);
};
```

### Sending Updates
```typescript
const sendUpdate = () => {
  versionRef.current++;
  ws.send(JSON.stringify({
    type: "sync",
    version: versionRef.current,
    senderId: senderIdRef.current,
    timestamp: Date.now(),
    data: { nodes: store.nodes, edges: store.edges }
  }));
};
```

## Throttling Strategy

**Throttle interval:** 150ms

Balances responsiveness (feels real-time) with load (prevents spam during drag operations).

### Implementation
```typescript
const throttleTimerRef = useRef<number | null>(null);
const pendingUpdateRef = useRef(false);

const scheduleSync = useCallback(() => {
  pendingUpdateRef.current = true;

  if (throttleTimerRef.current) return;

  throttleTimerRef.current = window.setTimeout(() => {
    if (pendingUpdateRef.current) {
      sendUpdate();
      pendingUpdateRef.current = false;
    }
    throttleTimerRef.current = null;
  }, 150);
}, []);
```

### When to Sync
- `onNodesChange` → scheduleSync()
- `onEdgesChange` → scheduleSync()
- `onConnect` → scheduleSync()
- Property updates (via store.updateNodeData) → scheduleSync()

### Immediate Sync (no throttle)
- Add new block (so others see it immediately)
- Delete block/edge (critical operation)

## Error Handling and Reconnection

### Reconnection Strategy

**Exponential backoff:** 1s, 2s, 4s, 8s, max 30s

```typescript
const reconnectAttemptsRef = useRef(0);
const offlineChangesRef = useRef<boolean>(false);

const connect = useCallback(() => {
  const ws = new WebSocket(`ws://${location.host}/ws/diagram/${diagramId}`);

  ws.onopen = () => {
    setWsConnected(true);
    reconnectAttemptsRef.current = 0;

    if (offlineChangesRef.current) {
      sendUpdate(); // Send current state
      offlineChangesRef.current = false;
    }
  };

  ws.onclose = () => {
    setWsConnected(false);
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;
    setTimeout(() => connect(), delay);
  };

  ws.onerror = () => ws.close();
}, [diagramId]);
```

### Offline Behavior
- Show "Disconnected" indicator (existing WS status)
- Continue working locally
- Track that changes were made offline
- On reconnect, send full state to sync

## Implementation Plan

### Critical Fixes (Priority 1)

**Frontend: Fix Blob Parsing**
- Check `e.data` type in `ws.onmessage`
- Convert Blob to text if needed

**Backend: Fix Message Sending**
- Use `JSON.stringify()` instead of sending raw Buffer
- Change: `client.send(JSON.stringify(msg))`

### Core Features (Priority 2)

**Versioning System**
- Add `versionRef`, `senderIdRef` refs
- Implement version checking logic
- Prevent infinite loops

**Throttled Sync**
- Implement `scheduleSync()` function
- Integrate with change handlers
- Add immediate sync for critical operations

**Reconnection Logic**
- Exponential backoff
- Offline changes tracking
- Auto-reconnect on disconnect

### Optional Enhancements

**Server-side Versioning**
- Store last version per room
- Handle `request_sync` messages
- Send full state on request

## Parallelization

Three independent tasks:

**Task 1: Fix Blob Parsing (30 min)**
- Frontend: type checking
- Backend: JSON.stringify

**Task 2: Versioning (2-3 hours)**
- Frontend: refs and version checks
- Backend: optional version storage

**Task 3: Throttling & Reconnection (2-3 hours)**
- Frontend: scheduleSync + backoff
- Independent of Task 2

## Testing Strategy

1. **Basic sync:** Two tabs, move block in one, verify appears in other
2. **Throttling:** Drag block rapidly, verify ~6-7 updates/sec
3. **Infinite loop:** Verify no echo of own changes
4. **Reconnection:** Disconnect network, make changes, reconnect, verify sync
5. **Concurrent edits:** Two users move same block, verify last write wins
6. **Property sync:** Edit endpoint in one tab, verify in other

## Success Criteria

- ✅ Block movements sync within 150-200ms
- ✅ No infinite loops or message echoes
- ✅ Graceful handling of disconnections
- ✅ Works for 3 concurrent users
- ✅ All operations sync (move, add, delete, edit properties)
- ✅ No Blob parsing errors
