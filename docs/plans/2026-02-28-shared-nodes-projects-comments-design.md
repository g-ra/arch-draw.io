# Shared Node Library + Projects Tab + Comments System Design

**Date:** 2026-02-28
**Status:** Approved

## Overview

Implement four major features to enhance collaboration and usability:

1. **Shared Node Library** - Move hardcoded node types to database, allow any user to add new types (append-only)
2. **Projects Tab** - Show all diagrams with server-side filtering by author/name
3. **Comments System** - Voice and text comments with reactions, attachable to nodes/positions/global
4. **Streamlined UX** - Remove Dashboard, open editor directly after login, consolidate controls in top toolbar

## Goals

- Enable collaborative node type creation (shared library)
- Provide visibility into all projects across users
- Add discussion/feedback mechanism via comments
- Simplify navigation (skip Dashboard)
- Consolidate UI controls into unified toolbar

## Database Schema

### New Table: NodeType

```prisma
model NodeType {
  id          String   @id @default(cuid())
  label       String
  category    String   // network, backend, database, queue, devops, frontend, region, custom
  tech        String?  // nginx, postgres, kafka, etc.
  description String?
  icon        String?  // emoji or unicode
  color       String?  // hex color
  createdById String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")

  createdBy   User     @relation(fields: [createdById], references: [id])

  @@map("node_types")
}
```

**Characteristics:**
- Append-only (no delete endpoint)
- Shared across all users
- Created by any authenticated user
- Replaces hardcoded `nodeLibrary.ts`

### New Table: Comment

```prisma
model Comment {
  id          String   @id @default(cuid())
  diagramId   String   @map("diagram_id")
  authorId    String   @map("author_id")
  content     String?  // text content (optional)
  audioUrl    String?  @map("audio_url") // audio file URL
  type        String   // "node" | "position" | "global"
  nodeId      String?  @map("node_id") // node ID (if type="node")
  posX        Float?   @map("pos_x") // X coordinate (if type="position")
  posY        Float?   @map("pos_y") // Y coordinate (if type="position")
  parentId    String?  @map("parent_id") // for threads (replies)
  resolved    Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")

  diagram     Diagram  @relation(fields: [diagramId], references: [id], onDelete: Cascade)
  author      User     @relation(fields: [authorId], references: [id])
  parent      Comment? @relation("CommentThread", fields: [parentId], references: [id])
  replies     Comment[] @relation("CommentThread")
  reactions   CommentReaction[]

  @@map("comments")
}
```

**Comment Types:**
- **node**: Attached to specific node (nodeId required)
- **position**: Attached to canvas coordinates (posX, posY required)
- **global**: General discussion (no attachment)

**Threading:**
- `parentId` creates reply chains
- Top-level comments have `parentId = null`

### New Table: CommentReaction

```prisma
model CommentReaction {
  id         String   @id @default(cuid())
  commentId  String   @map("comment_id")
  userId     String   @map("user_id")
  emoji      String   // "+", "-", "?"
  createdAt  DateTime @default(now()) @map("created_at")

  comment    Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@map("comment_reactions")
}
```

**Reaction Logic:**
- Three emoji types: `+` (agree), `-` (disagree), `?` (question)
- Toggle behavior: click again to remove
- One user can add multiple different emojis to same comment
- Unique constraint prevents duplicate emoji from same user

### Updates to Existing Models

```prisma
model User {
  // ... existing fields
  nodeTypes         NodeType[]
  comments          Comment[]
  commentReactions  CommentReaction[]
}

model Diagram {
  // ... existing fields
  comments    Comment[]
}
```

## API Endpoints

### 1. Node Types API

**GET /api/node-types**
- Returns all node types
- No auth required (public library)
- Response: `NodeType[]`

**POST /api/node-types**
- Create new node type
- Auth: required
- Body: `{ label, category, tech?, description?, icon?, color? }`
- Response: `NodeType`
- Validation: label required, category must be valid enum

### 2. Diagrams API

**GET /api/diagrams/all**
- List all diagrams with server-side filtering
- No auth required
- Query params:
  - `author`: string (partial match on User.name)
  - `name`: string (partial match on Diagram.name)
  - `limit`: number (default 50, max 100)
  - `offset`: number (default 0)
- Response:
```typescript
{
  items: Array<{
    id: string,
    name: string,
    description?: string,
    createdBy: { id: string, name: string, avatar?: string },
    updatedAt: string,
    thumbnail?: string
  }>,
  total: number
}
```

**Existing endpoints unchanged:**
- `GET /api/diagrams` - user's own diagrams
- `GET /api/diagrams/:id` - single diagram
- `POST /api/diagrams` - create
- `PUT /api/diagrams/:id` - update
- `DELETE /api/diagrams/:id` - delete

### 3. Comments API

**GET /api/diagrams/:diagramId/comments**
- Get all comments for diagram
- No auth required
- Response: `Comment[]` with nested `replies` and `reactions`
- Includes author info: `{ id, name, avatar }`

**POST /api/diagrams/:diagramId/comments**
- Create comment
- Auth: required
- Body:
```typescript
{
  content?: string,
  audioUrl?: string,
  type: "node" | "position" | "global",
  nodeId?: string,
  posX?: number,
  posY?: number,
  parentId?: string
}
```
- Validation:
  - `type="node"` requires `nodeId`
  - `type="position"` requires `posX` and `posY`
  - At least one of `content` or `audioUrl` required
- Response: `Comment`

**PATCH /api/comments/:id**
- Update comment
- Auth: required (only author)
- Body: `{ resolved?: boolean, content?: string }`
- Response: `Comment`

**DELETE /api/comments/:id**
- Delete comment
- Auth: required (only author)
- Response: `{ ok: true }`

### 4. Comment Reactions API

**POST /api/comments/:commentId/reactions**
- Toggle reaction
- Auth: required
- Body: `{ emoji: "+" | "-" | "?" }`
- Logic: If reaction exists, delete it; otherwise create it
- Response: `CommentReaction` or `{ deleted: true }`

### 5. Audio Upload API

**POST /api/upload/audio**
- Upload audio file for voice comments
- Auth: required
- Body: `multipart/form-data` with audio file
- Accepts: `.webm`, `.mp3`, `.wav`, `.m4a`
- Max size: 10MB
- Storage: `/uploads/audio/:userId/:timestamp-:random.ext`
- Response: `{ url: string }` (public URL)

## Frontend Changes

### 1. Remove Dashboard

**Files to delete:**
- `apps/web/src/components/Dashboard.tsx`

**Changes to App.tsx:**
```typescript
// Before:
onLogin={(u) => { setUser(u); setPage("dashboard"); }}

// After:
onLogin={(u) => {
  setUser(u);
  setPage("editor");
  setActiveDiagramId(null); // unsaved state
}}
```

**Navigation:**
- After login → Editor with empty canvas
- "Back" button → creates new empty project (resets diagramId to null)
- Access projects via "Projects" tab in left panel

### 2. Left Panel - 3 Tabs

**Tab Structure:**
```
┌─────────────────────────────┐
│ Nodes | Snippets | Projects │
└─────────────────────────────┘
```

**Nodes Tab:**
- Search input (filters by label/tech)
- Category filter buttons (All, Network, Backend, etc.)
- Scrollable list of node types (from API)
- "[+ Add Node Type]" button at bottom
- Drag-and-drop to canvas (existing behavior)

**Snippets Tab:**
- No changes (existing functionality)

**Projects Tab:**
- Search input: "�� Search by name..." (debounced 300ms)
- Filter input: "�� Filter by author..." (debounced 300ms)
- Scrollable list of diagrams
- Each item shows:
  - Diagram name
  - Author name
  - Last updated time
- "Load More" button for pagination (50 items per page)
- Click diagram → opens in editor

### 3. Top Toolbar on Canvas

**New unified toolbar replaces:**
- Existing context menu (Auto Layout, Delete, etc.)
- Bottom-left zoom controls
- Scattered action buttons

**Toolbar buttons (left to right):**
1. **[+ Add]** - Add default node (Microservice) to center of viewport
2. **[��️ Delete]** - Delete selected nodes/edges
3. **[↶ Undo]** - Undo last action
4. **[↷ Redo]** - Redo last action
5. **[�� Zoom]** - Dropdown: Zoom In, Zoom Out, Fit View, 100%
6. **[�� Layout]** - Auto Layout options (existing functionality)
7. **[�� Comments (3)]** - Toggle comments panel, badge shows count

**Behavior:**
- Toolbar always visible at top of canvas
- Buttons enable/disable based on context (e.g., Delete only when selection exists)
- Keyboard shortcuts still work (Cmd+Z, Delete, etc.)

### 4. Comments Panel (Right Sidebar)

**Trigger:**
- Click "[�� Comments]" button in top toolbar
- Panel slides in from right (300ms animation)

**Panel Structure:**
```
┌─────────────────────────────────┐
│ Comments (3)            [✕]     │ ← Header with close button
├─────────────────────────────────┤
│ [�� Record] [�� Text] [�� Pin]  │ ← Action buttons
├─────────────────────────────────┤
│ [Comment list - scrollable]     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ �� John Doe · 2h ago        │ │
│ │ [▶️ 0:15] Audio comment     │ │
│ │ �� 2  �� 1  ❓ 0            │ │ ← Reaction counts
│ │   └─ Reply...               │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ �� Jane · on "API Gateway"  │ │ ← Node-attached indicator
│ │ Should we add rate limit?   │ │
│ │ �� 5  �� 0  ❓ 1  [Resolve] │ │
│ │   └─ Alice: Good idea!      │ │ ← Reply
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Action Buttons:**
- **�� Record**: Opens voice recorder modal
  - Records audio (WebRTC MediaRecorder API)
  - Shows waveform visualization
  - Max duration: 2 minutes
  - Uploads to `/api/upload/audio`
  - Creates comment with audioUrl
- **�� Text**: Opens text input modal
  - Textarea for comment content
  - Optional: attach to selected node
  - Optional: pin to canvas position
- **�� Pin**: Click canvas to place position-attached comment
  - Shows crosshair cursor
  - Click location → opens text/record modal
  - Creates comment with posX, posY

**Comment Display:**
- Avatar + author name + timestamp
- Audio: Play button + duration
- Text: Rendered content
- Attachment indicator: "on [Node Name]" or "at (x, y)"
- Reactions: Emoji buttons with counts (�� 2, �� 1, ❓ 0)
- Reply button → expands reply input
- Resolve button (only for author)

**Canvas Indicators:**
- Node-attached: Badge �� on node (shows count)
- Position-attached: Floating icon �� at coordinates
- Click indicator → opens comments panel + scrolls to comment

### 5. Add Node Type Modal

**Trigger:** Click "[+ Add Node Type]" in Nodes tab

**Modal:**
```
┌──────────────────────────────┐
│ Add Node Type                │
├──────────────────────────────┤
│ Label: [_______________]     │ ← Required
│ Category: [dropdown ▼]       │ ← Required (network, backend, etc.)
│ Tech: [_______________]      │ ← Optional (e.g., "postgres")
│ Description: [_________]     │ ← Optional
│ Icon: [_] (emoji picker)     │ ← Optional (default: category icon)
│ Color: [#______] [��]        │ ← Optional (default: category color)
│                              │
│ [Cancel]  [Add to Library]   │
└──────────────────────────────┘
```

**Validation:**
- Label: required, min 1 char
- Category: required, must be valid enum
- Color: hex format validation

**After creation:**
- Node type appears immediately in Nodes tab (optimistic UI)
- Available to all users
- Cannot be deleted (append-only)

## Data Flow

### Node Types Flow

1. **Initial Load:**
   - App starts → fetch `GET /api/node-types`
   - Store in Zustand: `nodeTypes: NodeType[]`
   - Render in Nodes tab

2. **Add Node Type:**
   - User fills modal → clicks "Add to Library"
   - `POST /api/node-types` → returns new NodeType
   - Optimistic update: add to local state immediately
   - On success: keep in state
   - On error: remove from state + show error toast

3. **Real-time Sync:**
   - WebSocket message when new node type created
   - All connected clients receive update
   - Append to local `nodeTypes` array

### Projects Flow

1. **Load Projects:**
   - User opens Projects tab
   - Fetch `GET /api/diagrams/all?limit=50&offset=0`
   - Store in component state: `{ items, total, hasMore }`

2. **Filter/Search:**
   - User types in search/filter inputs
   - Debounce 300ms
   - Fetch `GET /api/diagrams/all?name=X&author=Y&limit=50&offset=0`
   - Replace items in state

3. **Pagination:**
   - User clicks "Load More"
   - Fetch `GET /api/diagrams/all?...&offset=50`
   - Append items to state

4. **Open Diagram:**
   - User clicks diagram card
   - `setActiveDiagramId(diagram.id)`
   - `setPage("editor")`
   - Editor loads diagram via existing `GET /api/diagrams/:id`

### Comments Flow

1. **Load Comments:**
   - Editor opens → fetch `GET /api/diagrams/:diagramId/comments`
   - Store in Zustand: `comments: Comment[]`
   - Render indicators on canvas
   - Populate comments panel

2. **Create Comment:**
   - User clicks "�� Record" or "�� Text"
   - If audio: record → upload → get URL
   - `POST /api/diagrams/:diagramId/comments` with data
   - Optimistic update: add to local state
   - WebSocket broadcast to other users

3. **Add Reaction:**
   - User clicks emoji button
   - `POST /api/comments/:id/reactions` with emoji
   - Toggle logic on backend
   - Update local state (increment/decrement count)
   - WebSocket broadcast

4. **Reply to Comment:**
   - User clicks "Reply" → expands input
   - Submits → `POST /api/diagrams/:diagramId/comments` with `parentId`
   - Nested under parent in UI

5. **Resolve Comment:**
   - User clicks "Resolve"
   - `PATCH /api/comments/:id` with `resolved: true`
   - Gray out comment in UI
   - Optional: hide resolved comments (filter toggle)

## Migration Strategy

### Existing Node Types

**Seed Script:** `apps/api/prisma/seed.ts`

```typescript
import { prisma } from '../src/lib/prisma';
import { NODE_LIBRARY } from '../../web/src/lib/nodeLibrary';

async function main() {
  // Create system user if not exists
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@techflow.local' },
    update: {},
    create: {
      email: 'system@techflow.local',
      name: 'System',
      oauthProvider: 'system',
    },
  });

  // Migrate existing nodes
  for (const node of NODE_LIBRARY) {
    await prisma.nodeType.upsert({
      where: { id: node.id },
      update: {},
      create: {
        id: node.id,
        label: node.label,
        category: node.category,
        tech: node.tech,
        description: node.description,
        createdById: systemUser.id,
      },
    });
  }

  console.log('Migrated', NODE_LIBRARY.length, 'node types');
}

main();
```

**Run:** `npx prisma db seed`

**Frontend Changes:**
- Remove `nodeLibrary.ts` imports
- Fetch from API instead
- Keep `CATEGORIES` constant (still needed for UI)

## Error Handling

### API Errors

- **400 Bad Request**: Validation errors → show field-specific messages
- **401 Unauthorized**: Redirect to login
- **403 Forbidden**: Show "You don't have permission" toast
- **404 Not Found**: Show "Resource not found" toast
- **500 Server Error**: Show "Something went wrong, try again" toast

### Audio Upload Errors

- **File too large**: "Audio file must be under 10MB"
- **Invalid format**: "Please upload .webm, .mp3, .wav, or .m4a"
- **Upload failed**: "Failed to upload audio, try again"

### WebSocket Errors

- **Connection lost**: Show "Disconnected" indicator in header
- **Reconnection**: Auto-reconnect with exponential backoff (existing)
- **Sync conflict**: Last write wins (existing behavior)

## Testing Strategy

### Unit Tests

- API endpoints: request/response validation
- Comment threading logic
- Reaction toggle logic
- Audio upload validation

### Integration Tests

- Create node type → appears in all clients
- Create comment → appears in panel + canvas indicator
- Add reaction → updates count
- Filter projects → correct results

### Manual Testing

- Voice recording in different browsers (Chrome, Firefox, Safari)
- Audio playback
- Comment threading (nested replies)
- Real-time sync with 2-3 users
- Mobile responsiveness

## Success Criteria

- ✅ Any user can add node types, visible to all
- ✅ Projects tab shows all diagrams with working filters
- ✅ Voice comments record and playback correctly
- ✅ Text comments attach to nodes/positions/global
- ✅ Reactions toggle correctly (�� �� ❓)
- ✅ Comment threads work (replies)
- ✅ Dashboard removed, editor opens directly after login
- ✅ Top toolbar consolidates all controls
- ✅ No regressions in existing features (WebSocket sync, snippets, etc.)
