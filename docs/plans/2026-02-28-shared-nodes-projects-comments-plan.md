# Shared Node Library + Projects Tab + Comments System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement collaborative features: shared node library, projects browser, and discussion system with voice/text comments.

**Architecture:** Database-backed node types (append-only), server-side filtered projects list, threaded comments with reactions, audio upload for voice comments, WebSocket sync for real-time updates.

**Tech Stack:** Prisma, PostgreSQL, Fastify, React, Zustand, WebRTC MediaRecorder API

---

## Task 1: Database Schema - Add New Tables

**Priority:** P0 - Foundation for all features
**Time:** 1 hour
**Dependencies:** None

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

### Step 1: Add NodeType model

**File:** `apps/api/prisma/schema.prisma`

Add after the `UserMacro` model:

```prisma
model NodeType {
  id          String   @id @default(cuid())
  label       String
  category    String
  tech        String?
  description String?
  icon        String?
  color       String?
  createdById String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")

  createdBy   User     @relation(fields: [createdById], references: [id])

  @@map("node_types")
}
```

### Step 2: Add Comment model

Add after `NodeType`:

```prisma
model Comment {
  id          String   @id @default(cuid())
  diagramId   String   @map("diagram_id")
  authorId    String   @map("author_id")
  content     String?
  audioUrl    String?  @map("audio_url")
  type        String
  nodeId      String?  @map("node_id")
  posX        Float?   @map("pos_x")
  posY        Float?   @map("pos_y")
  parentId    String?  @map("parent_id")
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

### Step 3: Add CommentReaction model

Add after `Comment`:

```prisma
model CommentReaction {
  id         String   @id @default(cuid())
  commentId  String   @map("comment_id")
  userId     String   @map("user_id")
  emoji      String
  createdAt  DateTime @default(now()) @map("created_at")

  comment    Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@map("comment_reactions")
}
```

### Step 4: Update User model

Find the `User` model and add these relations:

```prisma
model User {
  // ... existing fields
  nodeTypes         NodeType[]
  comments          Comment[]
  commentReactions  CommentReaction[]
}
```

### Step 5: Update Diagram model

Find the `Diagram` model and add:

```prisma
model Diagram {
  // ... existing fields
  comments    Comment[]
}
```

### Step 6: Generate migration

```bash
cd apps/api
npx prisma migrate dev --name add_node_types_and_comments
```

Expected: Migration created successfully

### Step 7: Verify migration

```bash
npx prisma migrate status
```

Expected: All migrations applied

### Step 8: Commit

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add NodeType, Comment, CommentReaction tables

- NodeType: shared library of node types (append-only)
- Comment: threaded comments with voice/text support
- CommentReaction: emoji reactions (+, -, ?)
- Relations: User, Diagram"
```

---

## Task 2: Seed Existing Node Types

**Priority:** P0 - Required for migration
**Time:** 30 minutes
**Dependencies:** Task 1

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`

### Step 1: Create seed script

**File:** `apps/api/prisma/seed.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NODE_LIBRARY = [
  // Network
  { id: "load-balancer", label: "Load Balancer", category: "network", tech: "nginx", description: "L7 балансировщик" },
  { id: "api-gateway", label: "API Gateway", category: "network", tech: "api-gateway", description: "Точка входа API" },
  { id: "firewall", label: "Firewall", category: "network", tech: "firewall", description: "WAF / Сетевой экран" },
  { id: "cdn", label: "CDN", category: "network", tech: "cdn", description: "Раздача статики" },
  { id: "dns", label: "DNS", category: "network", tech: "dns", description: "DNS резолвер" },
  { id: "vpn", label: "VPN Gateway", category: "network", tech: "vpn", description: "Туннель / VPN" },
  { id: "proxy", label: "Reverse Proxy", category: "network", tech: "nginx", description: "Nginx / HAProxy" },

  // Backend
  { id: "service-node", label: "Microservice", category: "backend", tech: "service", description: "Бизнес-логика" },
  { id: "rest-api", label: "REST API", category: "backend", tech: "rest", description: "HTTP/JSON API" },
  { id: "graphql", label: "GraphQL", category: "backend", tech: "graphql", description: "GraphQL сервер" },
  { id: "grpc-service", label: "gRPC Service", category: "backend", tech: "grpc", description: "Protobuf / gRPC" },
  { id: "auth-service", label: "Auth Service", category: "backend", tech: "service", description: "JWT / OAuth2" },
  { id: "nodejs", label: "Node.js", category: "backend", tech: "node.js" },
  { id: "go-service", label: "Go Service", category: "backend", tech: "go" },
  { id: "python-service", label: "Python Service", category: "backend", tech: "python" },

  // Database
  { id: "postgres", label: "PostgreSQL", category: "database", tech: "postgres", description: "Реляционная БД" },
  { id: "mongodb", label: "MongoDB", category: "database", tech: "mongodb", description: "Документальная БД" },
  { id: "redis", label: "Redis", category: "database", tech: "redis", description: "Кэш / сессии" },
  { id: "elasticsearch", label: "Elasticsearch", category: "database", tech: "elasticsearch", description: "Полнотекстовый поиск" },
  { id: "clickhouse", label: "ClickHouse", category: "database", tech: "clickhouse", description: "Аналитика / OLAP" },
  { id: "mysql", label: "MySQL", category: "database", tech: "mysql" },

  // Queue
  { id: "kafka", label: "Kafka", category: "queue", tech: "kafka", description: "Event streaming" },
  { id: "rabbitmq", label: "RabbitMQ", category: "queue", tech: "rabbitmq", description: "Message broker" },
  { id: "nats", label: "NATS", category: "queue", tech: "nats", description: "Легковесный MQ" },
  { id: "sqs", label: "AWS SQS", category: "queue", tech: "sqs", description: "Managed очередь" },

  // DevOps
  { id: "docker", label: "Docker", category: "devops", tech: "docker", description: "Контейнер" },
  { id: "k8s-pod", label: "K8s Pod", category: "devops", tech: "kubernetes", description: "Kubernetes Pod" },
  { id: "k8s-service", label: "K8s Service", category: "devops", tech: "k8s", description: "ClusterIP / NodePort" },
  { id: "ci-cd", label: "CI/CD", category: "devops", tech: "github-actions", description: "Pipeline" },
  { id: "prometheus", label: "Prometheus", category: "devops", tech: "prometheus", description: "Метрики" },
  { id: "grafana", label: "Grafana", category: "devops", tech: "grafana", description: "Дашборды" },
  { id: "sentry", label: "Sentry", category: "devops", tech: "sentry", description: "Error tracking" },

  // Frontend
  { id: "browser", label: "Browser", category: "frontend", tech: "browser", description: "Web клиент" },
  { id: "mobile-app", label: "Mobile App", category: "frontend", tech: "mobile", description: "iOS / Android" },
  { id: "react-app", label: "React App", category: "frontend", tech: "react", description: "SPA" },
];

async function main() {
  console.log("Starting seed...");

  // Create system user
  const systemUser = await prisma.user.upsert({
    where: { email: "system@techflow.local" },
    update: {},
    create: {
      email: "system@techflow.local",
      name: "System",
      oauthProvider: "system",
    },
  });

  console.log("System user:", systemUser.id);

  // Seed node types
  let created = 0;
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
    created++;
  }

  console.log(`Seeded ${created} node types`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Step 2: Add seed script to package.json

**File:** `apps/api/package.json`

Add to `"scripts"`:

```json
"seed": "tsx prisma/seed.ts"
```

### Step 3: Run seed

```bash
cd apps/api
npm run seed
```

Expected: "Seeded 36 node types"

### Step 4: Verify in database

```bash
npx prisma studio
```

Open browser → check `node_types` table has 36 rows

### Step 5: Commit

```bash
git add apps/api/prisma/seed.ts apps/api/package.json
git commit -m "feat: seed existing node types into database

- Migrates 36 hardcoded node types from nodeLibrary.ts
- Creates system user as creator
- Upsert logic prevents duplicates"
```

---

## Task 3: Backend API - Node Types Endpoints

**Priority:** P1
**Time:** 1 hour
**Dependencies:** Task 1, Task 2

**Files:**
- Create: `apps/api/src/routes/node-types.ts`
- Modify: `apps/api/src/index.ts`

### Step 1: Create node-types route file

**File:** `apps/api/src/routes/node-types.ts`

```typescript
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const createNodeTypeSchema = z.object({
  label: z.string().min(1),
  category: z.enum(["network", "backend", "database", "queue", "devops", "frontend", "region", "custom"]),
  tech: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function nodeTypeRoutes(app: FastifyInstance) {
  // Get all node types
  app.get("/", async () => {
    return prisma.nodeType.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
  });

  // Create node type
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = createNodeTypeSchema.parse(req.body);

    const nodeType = await prisma.nodeType.create({
      data: {
        ...body,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return reply.code(201).send(nodeType);
  });
}
```

### Step 2: Register route in main app

**File:** `apps/api/src/index.ts`

Find the routes registration section and add:

```typescript
import { nodeTypeRoutes } from "./routes/node-types";

// ... existing code ...

app.register(nodeTypeRoutes, { prefix: "/api/node-types" });
```

### Step 3: Test GET endpoint

```bash
cd apps/api
npm run dev
```

In another terminal:

```bash
curl http://localhost:3000/api/node-types
```

Expected: JSON array with 36 node types

### Step 4: Test POST endpoint (requires auth)

First, login to get cookie, then:

```bash
curl -X POST http://localhost:3000/api/node-types \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{"label":"Test Node","category":"custom","tech":"test"}'
```

Expected: 201 Created with new node type

### Step 5: Commit

```bash
git add apps/api/src/routes/node-types.ts apps/api/src/index.ts
git commit -m "feat: add node types API endpoints

- GET /api/node-types - list all node types
- POST /api/node-types - create new node type (auth required)
- Validation with Zod schema
- Include creator info in response"
```

---
## Task 4: Backend API - Projects List Endpoint

**Priority:** P1
**Time:** 1 hour
**Dependencies:** Task 1

**Files:**
- Modify: `apps/api/src/routes/diagrams.ts`

### Step 1: Add /all endpoint

**File:** `apps/api/src/routes/diagrams.ts`

Add after the existing routes:

```typescript
// Get all diagrams with filtering
app.get("/all", async (req, reply) => {
  const { author, name, limit = "50", offset = "0" } = req.query as {
    author?: string;
    name?: string;
    limit?: string;
    offset?: string;
  };

  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
  const offsetNum = parseInt(offset, 10) || 0;

  const where: any = {};

  if (author) {
    where.createdBy = {
      name: { contains: author, mode: "insensitive" },
    };
  }

  if (name) {
    where.name = { contains: name, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.diagram.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: offsetNum,
      take: limitNum,
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    }),
    prisma.diagram.count({ where }),
  ]);

  return { items, total };
});
```

### Step 2: Test endpoint without filters

```bash
curl http://localhost:3000/api/diagrams/all
```

Expected: JSON with `{ items: [...], total: N }`

### Step 3: Test with name filter

```bash
curl "http://localhost:3000/api/diagrams/all?name=system"
```

Expected: Only diagrams with "system" in name

### Step 4: Test with author filter

```bash
curl "http://localhost:3000/api/diagrams/all?author=john"
```

Expected: Only diagrams by authors with "john" in name

### Step 5: Test pagination

```bash
curl "http://localhost:3000/api/diagrams/all?limit=10&offset=0"
curl "http://localhost:3000/api/diagrams/all?limit=10&offset=10"
```

Expected: Different sets of 10 diagrams

### Step 6: Commit

```bash
git add apps/api/src/routes/diagrams.ts
git commit -m "feat: add projects list endpoint with filtering

- GET /api/diagrams/all with query params
- Server-side filtering by author and name
- Pagination with limit/offset
- Returns total count for UI"
```

---

## Task 5: Backend API - Comments Endpoints

**Priority:** P1
**Time:** 2 hours
**Dependencies:** Task 1

**Files:**
- Create: `apps/api/src/routes/comments.ts`
- Modify: `apps/api/src/index.ts`

### Step 1: Create comments route file

**File:** `apps/api/src/routes/comments.ts`

```typescript
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const createCommentSchema = z.object({
  content: z.string().optional(),
  audioUrl: z.string().url().optional(),
  type: z.enum(["node", "position", "global"]),
  nodeId: z.string().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  parentId: z.string().optional(),
}).refine(
  (data) => data.content || data.audioUrl,
  { message: "Either content or audioUrl must be provided" }
).refine(
  (data) => data.type !== "node" || data.nodeId,
  { message: "nodeId required for type=node" }
).refine(
  (data) => data.type !== "position" || (data.posX !== undefined && data.posY !== undefined),
  { message: "posX and posY required for type=position" }
);

const updateCommentSchema = z.object({
  resolved: z.boolean().optional(),
  content: z.string().optional(),
});

export async function commentRoutes(app: FastifyInstance) {
  // Get all comments for diagram
  app.get<{ Params: { diagramId: string } }>(
    "/diagrams/:diagramId/comments",
    async (req) => {
      const comments = await prisma.comment.findMany({
        where: { diagramId: req.params.diagramId },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
          reactions: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
          replies: {
            include: {
              author: {
                select: { id: true, name: true, avatar: true },
              },
              reactions: {
                include: {
                  user: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      });

      // Filter to only top-level comments (replies are nested)
      return comments.filter((c) => !c.parentId);
    }
  );

  // Create comment
  app.post<{ Params: { diagramId: string } }>(
    "/diagrams/:diagramId/comments",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };
      const body = createCommentSchema.parse(req.body);

      const comment = await prisma.comment.create({
        data: {
          ...body,
          diagramId: req.params.diagramId,
          authorId: userId,
        },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
          reactions: true,
          replies: true,
        },
      });

      return reply.code(201).send(comment);
    }
  );

  // Update comment
  app.patch<{ Params: { id: string } }>(
    "/comments/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };
      const body = updateCommentSchema.parse(req.body);

      const existing = await prisma.comment.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Comment not found" });
      }

      if (existing.authorId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const updated = await prisma.comment.update({
        where: { id: req.params.id },
        data: body,
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
          reactions: true,
          replies: true,
        },
      });

      return updated;
    }
  );

  // Delete comment
  app.delete<{ Params: { id: string } }>(
    "/comments/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };

      const existing = await prisma.comment.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Comment not found" });
      }

      if (existing.authorId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      await prisma.comment.delete({
        where: { id: req.params.id },
      });

      return { ok: true };
    }
  );

  // Toggle reaction
  app.post<{ Params: { commentId: string } }>(
    "/comments/:commentId/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };
      const { emoji } = z.object({ emoji: z.enum(["+", "-", "?"]) }).parse(req.body);

      const existing = await prisma.commentReaction.findUnique({
        where: {
          commentId_userId_emoji: {
            commentId: req.params.commentId,
            userId,
            emoji,
          },
        },
      });

      if (existing) {
        // Remove reaction
        await prisma.commentReaction.delete({
          where: { id: existing.id },
        });
        return { deleted: true };
      } else {
        // Add reaction
        const reaction = await prisma.commentReaction.create({
          data: {
            commentId: req.params.commentId,
            userId,
            emoji,
          },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        });
        return reply.code(201).send(reaction);
      }
    }
  );
}
```

### Step 2: Register route in main app

**File:** `apps/api/src/index.ts`

Add:

```typescript
import { commentRoutes } from "./routes/comments";

// ... existing code ...

app.register(commentRoutes, { prefix: "/api" });
```

### Step 3: Test create comment

```bash
curl -X POST http://localhost:3000/api/diagrams/DIAGRAM_ID/comments \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{"content":"Test comment","type":"global"}'
```

Expected: 201 Created with comment object

### Step 4: Test get comments

```bash
curl http://localhost:3000/api/diagrams/DIAGRAM_ID/comments
```

Expected: Array of comments with nested replies and reactions

### Step 5: Test toggle reaction

```bash
curl -X POST http://localhost:3000/api/comments/COMMENT_ID/reactions \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{"emoji":"+"}'
```

Expected: 201 Created (first time), then `{"deleted":true}` (second time)

### Step 6: Commit

```bash
git add apps/api/src/routes/comments.ts apps/api/src/index.ts
git commit -m "feat: add comments API endpoints

- GET /api/diagrams/:id/comments - list with nested replies
- POST /api/diagrams/:id/comments - create comment
- PATCH /api/comments/:id - update (resolve, edit)
- DELETE /api/comments/:id - delete (author only)
- POST /api/comments/:id/reactions - toggle reaction
- Validation for comment types (node, position, global)"
```

---

## Task 6: Backend API - Audio Upload Endpoint

**Priority:** P1
**Time:** 1 hour
**Dependencies:** None

**Files:**
- Create: `apps/api/src/routes/upload.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/package.json`

### Step 1: Install dependencies

```bash
cd apps/api
npm install @fastify/multipart
```

### Step 2: Create upload route

**File:** `apps/api/src/routes/upload.ts`

```typescript
import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import fs from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import crypto from "crypto";

export async function uploadRoutes(app: FastifyInstance) {
  // Upload audio file
  app.post("/audio", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };

    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    // Validate file type
    const allowedMimes = ["audio/webm", "audio/mpeg", "audio/wav", "audio/mp4"];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: "Invalid file type. Allowed: webm, mp3, wav, m4a" });
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
      const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
      if (totalSize > MAX_SIZE) {
        return reply.code(400).send({ error: "File too large. Max 10MB" });
      }
    }

    const buffer = Buffer.concat(chunks);

    // Generate filename
    const ext = data.mimetype.split("/")[1];
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const filename = `${timestamp}-${random}.${ext}`;

    // Create directory
    const uploadDir = path.join(process.cwd(), "uploads", "audio", userId);
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);

    // Return public URL
    const url = `/uploads/audio/${userId}/${filename}`;
    return { url };
  });
}
```

### Step 3: Serve static files

**File:** `apps/api/src/index.ts`

Add after other imports:

```typescript
import fastifyStatic from "@fastify/static";
import path from "path";
```

Add before routes registration:

```typescript
// Serve uploaded files
app.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
});
```

### Step 4: Register upload route

```typescript
import { uploadRoutes } from "./routes/upload";

// ... existing code ...

app.register(uploadRoutes, { prefix: "/api/upload" });
```

### Step 5: Install @fastify/static

```bash
npm install @fastify/static
```

### Step 6: Test upload

```bash
# Create test audio file
echo "test" > test.webm

curl -X POST http://localhost:3000/api/upload/audio \
  -H "Cookie: token=YOUR_TOKEN" \
  -F "file=@test.webm"
```

Expected: `{"url":"/uploads/audio/USER_ID/TIMESTAMP-HASH.webm"}`

### Step 7: Test file access

```bash
curl http://localhost:3000/uploads/audio/USER_ID/FILENAME.webm
```

Expected: File content

### Step 8: Commit

```bash
git add apps/api/src/routes/upload.ts apps/api/src/index.ts apps/api/package.json
git commit -m "feat: add audio upload endpoint

- POST /api/upload/audio - upload audio file
- Validates file type (webm, mp3, wav, m4a)
- Max size 10MB
- Stores in /uploads/audio/:userId/
- Returns public URL
- Serves files via @fastify/static"
```

---
## Task 7: Frontend - Remove Dashboard and Update Routing

**Priority:** P1
**Time:** 30 minutes
**Dependencies:** None

**Files:**
- Delete: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/DiagramEditor.tsx`

### Step 1: Delete Dashboard component

```bash
rm apps/web/src/components/Dashboard.tsx
```

### Step 2: Update App.tsx routing

**File:** `apps/web/src/App.tsx`

Remove Dashboard import and type:

```typescript
// DELETE these lines:
import { Dashboard } from "./components/Dashboard";
type Page = "login" | "dashboard" | "editor";
```

Change to:

```typescript
type Page = "login" | "editor";
```

Update login handler (line 48):

```typescript
// Before:
if (page === "login") return <LoginPage onLogin={(u) => { setUser(u); setPage("dashboard"); }} />;

// After:
if (page === "login") return <LoginPage onLogin={(u) => { setUser(u); setPage("editor"); setActiveDiagramId(null); }} />;
```

Update auth check (line 44):

```typescript
// Before:
if (u) { setUser(u); setPage("dashboard"); }

// After:
if (u) { setUser(u); setPage("editor"); setActiveDiagramId(null); }
```

Remove Dashboard render:

```typescript
// DELETE this entire block:
return (
  <Dashboard
    user={user!}
    onOpenDiagram={(id) => { setActiveDiagramId(id); setPage("editor"); }}
    onLogout={() => { setUser(null); setPage("login"); }}
  />
);
```

### Step 3: Update DiagramEditor onBack handler

**File:** `apps/web/src/components/DiagramEditor.tsx`

Find the "Back" button handler and change it to create new project:

```typescript
// Before:
<button onClick={onBack} ...>

// After:
<button onClick={() => {
  // Create new empty project
  window.location.href = "/";
}} ...>
```

Or update the button text to "New Project" instead of "Back".

### Step 4: Test routing

```bash
cd apps/web
npm run dev
```

1. Open http://localhost:5174
2. Login
3. Verify: Opens editor with empty canvas (no diagramId)
4. Verify: No Dashboard appears

### Step 5: Commit

```bash
git add apps/web/src/App.tsx apps/web/src/components/DiagramEditor.tsx
git rm apps/web/src/components/Dashboard.tsx
git commit -m "feat: remove Dashboard, open editor directly after login

- Delete Dashboard.tsx
- Update App.tsx to skip dashboard page
- After login: open editor with diagramId=null (unsaved state)
- Back button creates new project instead of returning to dashboard"
```

---

## Task 8: Frontend - Fetch Node Types from API

**Priority:** P1
**Time:** 1 hour
**Dependencies:** Task 3

**Files:**
- Modify: `apps/web/src/components/NodePanel.tsx`
- Modify: `apps/web/src/stores/diagramStore.ts`

### Step 1: Add node types to store

**File:** `apps/web/src/stores/diagramStore.ts`

Add to store state:

```typescript
interface DiagramStore {
  // ... existing fields
  nodeTypes: NodeType[];
  loadNodeTypes: () => Promise<void>;
  addNodeType: (nodeType: NodeType) => void;
}

// Add interface
interface NodeType {
  id: string;
  label: string;
  category: string;
  tech?: string;
  description?: string;
  icon?: string;
  color?: string;
  createdBy: { id: string; name: string; avatar?: string };
  createdAt: string;
}
```

Add to store implementation:

```typescript
nodeTypes: [],

loadNodeTypes: async () => {
  const res = await fetch("/api/node-types");
  if (res.ok) {
    const types = await res.json();
    set({ nodeTypes: types });
  }
},

addNodeType: (nodeType) => {
  set((state) => ({
    nodeTypes: [...state.nodeTypes, nodeType],
  }));
},
```

### Step 2: Update NodePanel to use API

**File:** `apps/web/src/components/NodePanel.tsx`

Remove hardcoded import:

```typescript
// DELETE:
import { NODE_LIBRARY, CATEGORIES, REGION_TEMPLATES, NodeTemplate } from "../lib/nodeLibrary";
```

Add:

```typescript
import { CATEGORIES, REGION_TEMPLATES } from "../lib/nodeLibrary";
```

Update component to fetch from store:

```typescript
export function NodePanel({ onDragStart, onCreateCustom, rfInstance }: Props) {
  const { nodeTypes, loadNodeTypes } = useDiagramStore();
  
  useEffect(() => {
    loadNodeTypes();
  }, [loadNodeTypes]);

  // ... rest of component

  // Replace NODE_LIBRARY with nodeTypes
  const allTemplates = [...nodeTypes, ...customTemplates];
```

### Step 3: Test node types loading

```bash
npm run dev
```

1. Open app
2. Check Network tab: GET /api/node-types
3. Verify: Nodes tab shows all 36 node types
4. Verify: Can drag nodes to canvas

### Step 4: Commit

```bash
git add apps/web/src/components/NodePanel.tsx apps/web/src/stores/diagramStore.ts
git commit -m "feat: fetch node types from API instead of hardcoded

- Add nodeTypes to Zustand store
- Load from GET /api/node-types on mount
- Remove dependency on hardcoded NODE_LIBRARY
- Keep CATEGORIES for UI (still needed for filters)"
```

---

## Task 9: Frontend - Add Projects Tab to NodePanel

**Priority:** P1
**Time:** 2 hours
**Dependencies:** Task 4

**Files:**
- Modify: `apps/web/src/components/NodePanel.tsx`

### Step 1: Update tab type

**File:** `apps/web/src/components/NodePanel.tsx`

Change:

```typescript
// Before:
type PanelTab = "nodes" | "snippets";

// After:
type PanelTab = "nodes" | "snippets" | "projects";
```

### Step 2: Add Projects tab button

Find the tab bar (around line 96) and add:

```typescript
<button
  onClick={() => setActiveTab("projects")}
  className={`flex-1 py-2 text-xs font-medium transition-colors ${
    activeTab === "projects"
      ? "text-white border-b-2 border-indigo-500"
      : "text-slate-500 hover:text-slate-300"
  }`}
>
  Projects
</button>
```

### Step 3: Add Projects tab content

Add after Snippets tab content (around line 272):

```typescript
{/* PROJECTS TAB */}
{activeTab === "projects" && <ProjectsTab />}
```

### Step 4: Create ProjectsTab component

Add at the end of the file:

```typescript
function ProjectsTab() {
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const loadProjects = useCallback(async (reset = false) => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: "50",
      offset: reset ? "0" : offset.toString(),
    });
    if (nameFilter) params.set("name", nameFilter);
    if (authorFilter) params.set("author", authorFilter);

    const res = await fetch(`/api/diagrams/all?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProjects(reset ? data.items : [...projects, ...data.items]);
      setTotal(data.total);
      if (reset) setOffset(0);
    }
    setLoading(false);
  }, [nameFilter, authorFilter, offset, projects]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [nameFilter, authorFilter]);

  const loadMore = () => {
    setOffset(offset + 50);
    loadProjects(false);
  };

  const openProject = (id: string) => {
    window.location.href = `/editor/${id}`;
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="p-2 space-y-2 border-b border-[#2d3148]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="🔍 Search by name..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="relative">
          <input
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            placeholder="👤 Filter by author..."
            className="w-full px-3 py-2 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && projects.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">Loading...</p>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => openProject(project.id)}
            className="p-2.5 rounded-lg hover:bg-[#1e2130] cursor-pointer transition-colors mb-1"
          >
            <div className="text-sm text-white truncate">{project.name}</div>
            <div className="text-xs text-slate-500 truncate">
              by {project.createdBy.name}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {new Date(project.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {projects.length < total && (
        <div className="p-2 border-t border-[#2d3148]">
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {loading ? "Loading..." : `Load More (${projects.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 5: Test Projects tab

```bash
npm run dev
```

1. Open app
2. Click "Projects" tab
3. Verify: Shows list of all diagrams
4. Type in search: verify filtering works
5. Click "Load More": verify pagination
6. Click project: verify opens in editor

### Step 6: Commit

```bash
git add apps/web/src/components/NodePanel.tsx
git commit -m "feat: add Projects tab to left panel

- Third tab showing all diagrams
- Server-side filtering by name and author
- Debounced search (300ms)
- Pagination with Load More button
- Click to open project in editor"
```

---
## Task 10: Frontend - Add Node Type Modal

**Priority:** P2
**Time:** 1 hour
**Dependencies:** Task 8

**Files:**
- Create: `apps/web/src/components/modals/AddNodeTypeModal.tsx`
- Modify: `apps/web/src/components/NodePanel.tsx`

### Step 1: Create AddNodeTypeModal component

**File:** `apps/web/src/components/modals/AddNodeTypeModal.tsx`

```typescript
import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (data: {
    label: string;
    category: string;
    tech?: string;
    description?: string;
    icon?: string;
    color?: string;
  }) => void;
}

const CATEGORIES = [
  { id: "network", label: "Network", color: "#3b82f6" },
  { id: "backend", label: "Backend", color: "#22c55e" },
  { id: "database", label: "Database", color: "#eab308" },
  { id: "queue", label: "Queue", color: "#ef4444" },
  { id: "devops", label: "DevOps", color: "#f97316" },
  { id: "frontend", label: "Frontend", color: "#a855f7" },
  { id: "custom", label: "Custom", color: "#64748b" },
];

export function AddNodeTypeModal({ onClose, onSubmit }: Props) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("custom");
  const [tech, setTech] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#64748b");

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSubmit({
      label: label.trim(),
      category,
      tech: tech.trim() || undefined,
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      color: color || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Add Node Type</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Label *</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Redis Cache"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                const cat = CATEGORIES.find((c) => c.id === e.target.value);
                if (cat) setColor(cat.color);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tech</label>
            <input
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              placeholder="e.g., redis"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., In-memory cache"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Icon (emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g., 🗄️"
              className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#64748b"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Integrate modal into NodePanel

**File:** `apps/web/src/components/NodePanel.tsx`

Add import:

```typescript
import { AddNodeTypeModal } from "./modals/AddNodeTypeModal";
```

Add state:

```typescript
const [showAddModal, setShowAddModal] = useState(false);
```

Update the "[+ Add Node Type]" button:

```typescript
<button
  onClick={() => setShowAddModal(true)}
  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#2d3148] text-slate-500 hover:text-indigo-400 hover:border-indigo-500 text-xs transition-colors"
>
  <Plus size={12} /> Add Node Type
</button>
```

Add modal render and handler:

```typescript
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

// At the end of component return:
{showAddModal && (
  <AddNodeTypeModal
    onClose={() => setShowAddModal(false)}
    onSubmit={handleAddNodeType}
  />
)}
```

### Step 3: Test modal

```bash
npm run dev
```

1. Click "[+ Add Node Type]" button
2. Fill in form: Label="Test Node", Category="Custom"
3. Click "Add to Library"
4. Verify: Modal closes, new node appears in list
5. Verify: Node persists after refresh

### Step 4: Commit

```bash
git add apps/web/src/components/modals/AddNodeTypeModal.tsx apps/web/src/components/NodePanel.tsx
git commit -m "feat: add node type creation modal

- Modal with form for label, category, tech, description, icon, color
- POST to /api/node-types on submit
- Optimistic UI update
- Validates required fields
- Color picker with hex input"
```

---

## Task 11: Frontend - Consolidate Toolbar

**Priority:** P1
**Time:** 2 hours
**Dependencies:** None

**Files:**
- Modify: `apps/web/src/components/DiagramEditor.tsx`
- Modify: `apps/web/src/components/AlignmentToolbar.tsx` (or delete if merged)

### Step 1: Remove bottom-left zoom controls

**File:** `apps/web/src/components/DiagramEditor.tsx`

Find and remove the zoom controls (usually around line 600-650):

```typescript
// DELETE this entire block:
<div className="absolute bottom-4 left-4 flex gap-2">
  <button onClick={...}>Zoom In</button>
  <button onClick={...}>Zoom Out</button>
  <button onClick={...}>Fit View</button>
</div>
```

### Step 2: Create top toolbar component

Add after imports:

```typescript
function TopToolbar({
  onAddNode,
  onDelete,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onAutoLayout,
  onToggleComments,
  commentCount,
  canUndo,
  canRedo,
  hasSelection,
}: {
  onAddNode: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  onToggleComments: () => void;
  commentCount: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#1a1d2e] border border-[#2d3148] rounded-lg px-3 py-2 shadow-lg">
      <button
        onClick={onAddNode}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white hover:bg-[#2d3148] rounded transition-colors"
        title="Add Node (default)"
      >
        <Plus size={16} /> Add
      </button>

      <div className="w-px h-6 bg-[#2d3148]" />

      <button
        onClick={onDelete}
        disabled={!hasSelection}
        className="p-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Delete (Del)"
      >
        <Trash2 size={16} />
      </button>

      <div className="w-px h-6 bg-[#2d3148]" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo (Cmd+Z)"
      >
        ↶
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Redo (Cmd+Shift+Z)"
      >
        ↷
      </button>

      <div className="w-px h-6 bg-[#2d3148]" />

      <div className="relative group">
        <button className="p-1.5 text-slate-400 hover:text-white transition-colors" title="Zoom">
          🔍
        </button>
        <div className="absolute top-full mt-1 left-0 bg-[#1a1d2e] border border-[#2d3148] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
          <button onClick={onZoomIn} className="block w-full px-4 py-2 text-sm text-white hover:bg-[#2d3148] text-left">
            Zoom In
          </button>
          <button onClick={onZoomOut} className="block w-full px-4 py-2 text-sm text-white hover:bg-[#2d3148] text-left">
            Zoom Out
          </button>
          <button onClick={onFitView} className="block w-full px-4 py-2 text-sm text-white hover:bg-[#2d3148] text-left">
            Fit View
          </button>
        </div>
      </div>

      <button
        onClick={onAutoLayout}
        className="p-1.5 text-slate-400 hover:text-white transition-colors"
        title="Auto Layout"
      >
        📐
      </button>

      <div className="w-px h-6 bg-[#2d3148]" />

      <button
        onClick={onToggleComments}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        title="Comments"
      >
        💬 {commentCount > 0 && <span className="text-xs">({commentCount})</span>}
      </button>
    </div>
  );
}
```

### Step 3: Add toolbar to DiagramEditor

In the main component, add state:

```typescript
const [showComments, setShowComments] = useState(false);
const [commentCount, setCommentCount] = useState(0);
```

Add handlers:

```typescript
const handleAddNode = () => {
  const center = rfInstance?.getViewport();
  const pos = center ? { x: center.x + 200, y: center.y + 200 } : { x: 200, y: 200 };
  store.addNode({
    id: crypto.randomUUID(),
    type: "techNode",
    position: pos,
    data: { label: "Microservice", category: "backend", tech: "service" },
  });
};

const handleDelete = () => {
  const selected = store.nodes.filter((n) => n.selected);
  selected.forEach((n) => store.deleteNode(n.id));
};

const handleZoomIn = () => rfInstance?.zoomIn();
const handleZoomOut = () => rfInstance?.zoomOut();
const handleFitView = () => rfInstance?.fitView();
```

Render toolbar:

```typescript
<TopToolbar
  onAddNode={handleAddNode}
  onDelete={handleDelete}
  onUndo={() => {/* TODO: implement undo */}}
  onRedo={() => {/* TODO: implement redo */}}
  onZoomIn={handleZoomIn}
  onZoomOut={handleZoomOut}
  onFitView={handleFitView}
  onAutoLayout={() => {/* existing auto layout logic */}}
  onToggleComments={() => setShowComments(!showComments)}
  commentCount={commentCount}
  canUndo={false}
  canRedo={false}
  hasSelection={store.nodes.some((n) => n.selected)}
/>
```

### Step 4: Remove AlignmentToolbar if it exists

If there's a separate AlignmentToolbar component that shows on selection, either:
- Merge its functionality into TopToolbar
- Or keep it but remove duplicate buttons

### Step 5: Test toolbar

```bash
npm run dev
```

1. Verify: Top toolbar appears centered
2. Click "Add": creates default node
3. Select node, click Delete: removes node
4. Click Zoom dropdown: shows options
5. Click Comments: toggles panel (placeholder for now)

### Step 6: Commit

```bash
git add apps/web/src/components/DiagramEditor.tsx
git commit -m "feat: consolidate controls into top toolbar

- Remove bottom-left zoom controls
- Add centered top toolbar with all actions
- Buttons: Add, Delete, Undo/Redo, Zoom, Layout, Comments
- Zoom as dropdown menu
- Comments button shows count badge
- Keyboard shortcuts still work"
```

---
## Task 12: Frontend - Comments Panel UI

**Priority:** P1
**Time:** 3 hours
**Dependencies:** Task 5

**Files:**
- Create: `apps/web/src/components/CommentsPanel.tsx`
- Modify: `apps/web/src/components/DiagramEditor.tsx`
- Modify: `apps/web/src/stores/diagramStore.ts`

### Step 1: Add comments to store

**File:** `apps/web/src/stores/diagramStore.ts`

Add interfaces:

```typescript
interface Comment {
  id: string;
  diagramId: string;
  author: { id: string; name: string; avatar?: string };
  content?: string;
  audioUrl?: string;
  type: "node" | "position" | "global";
  nodeId?: string;
  posX?: number;
  posY?: number;
  parentId?: string;
  resolved: boolean;
  createdAt: string;
  reactions: CommentReaction[];
  replies: Comment[];
}

interface CommentReaction {
  id: string;
  emoji: string;
  user: { id: string; name: string };
}
```

Add to store:

```typescript
comments: [] as Comment[],

loadComments: async (diagramId: string) => {
  const res = await fetch(`/api/diagrams/${diagramId}/comments`);
  if (res.ok) {
    const comments = await res.json();
    set({ comments });
  }
},

addComment: (comment: Comment) => {
  set((state) => ({
    comments: [...state.comments, comment],
  }));
},

updateComment: (id: string, updates: Partial<Comment>) => {
  set((state) => ({
    comments: state.comments.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
  }));
},

deleteComment: (id: string) => {
  set((state) => ({
    comments: state.comments.filter((c) => c.id !== id),
  }));
},

toggleReaction: (commentId: string, emoji: string, userId: string, userName: string) => {
  set((state) => ({
    comments: state.comments.map((c) => {
      if (c.id !== commentId) return c;
      
      const existing = c.reactions.find((r) => r.emoji === emoji && r.user.id === userId);
      if (existing) {
        return {
          ...c,
          reactions: c.reactions.filter((r) => r.id !== existing.id),
        };
      } else {
        return {
          ...c,
          reactions: [
            ...c.reactions,
            { id: crypto.randomUUID(), emoji, user: { id: userId, name: userName } },
          ],
        };
      }
    }),
  }));
},
```

### Step 2: Create CommentsPanel component

**File:** `apps/web/src/components/CommentsPanel.tsx`

```typescript
import { useState } from "react";
import { X, MessageSquare, Mic, MapPin, Play, Pause } from "lucide-react";
import { useDiagramStore } from "../stores/diagramStore";

interface Props {
  diagramId: string;
  currentUser: { id: string; name: string } | null;
  onClose: () => void;
}

export function CommentsPanel({ diagramId, currentUser, onClose }: Props) {
  const { comments, addComment, updateComment, deleteComment, toggleReaction } = useDiagramStore();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const handleAddTextComment = async (content: string, parentId?: string) => {
    if (!currentUser || !content.trim()) return;

    const res = await fetch(`/api/diagrams/${diagramId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        content: content.trim(),
        type: "global",
        parentId,
      }),
    });

    if (res.ok) {
      const comment = await res.json();
      addComment(comment);
      setReplyText("");
      setReplyTo(null);
    }
  };

  const handleResolve = async (commentId: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resolved: true }),
    });

    if (res.ok) {
      updateComment(commentId, { resolved: true });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;

    const res = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      deleteComment(commentId);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    if (!currentUser) return;

    const res = await fetch(`/api/comments/${commentId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ emoji }),
    });

    if (res.ok) {
      toggleReaction(commentId, emoji, currentUser.id, currentUser.name);
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[#13151f] border-l border-[#2d3148] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2d3148]">
        <h3 className="text-white font-semibold">
          Comments ({comments.length})
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3 border-b border-[#2d3148]">
        <button
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3148] hover:border-indigo-500 transition-colors text-sm"
          title="Record voice comment"
        >
          <Mic size={14} /> Record
        </button>
        <button
          onClick={() => {
            const text = prompt("Enter comment:");
            if (text) handleAddTextComment(text);
          }}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3148] hover:border-indigo-500 transition-colors text-sm"
          title="Add text comment"
        >
          <MessageSquare size={14} /> Text
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3148] hover:border-indigo-500 transition-colors text-sm"
          title="Pin to canvas"
        >
          <MapPin size={14} /> Pin
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-8">
            No comments yet. Add the first one!
          </p>
        )}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUser={currentUser}
            onReply={(id) => setReplyTo(id)}
            onResolve={handleResolve}
            onDelete={handleDelete}
            onReaction={handleReaction}
          />
        ))}
      </div>

      {/* Reply input */}
      {replyTo && (
        <div className="p-3 border-t border-[#2d3148]">
          <div className="flex gap-2">
            <input
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddTextComment(replyText, replyTo);
                }
              }}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setReplyTo(null)}
              className="px-3 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  currentUser,
  onReply,
  onResolve,
  onDelete,
  onReaction,
}: {
  comment: any;
  currentUser: { id: string; name: string } | null;
  onReply: (id: string) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onReaction: (id: string, emoji: string) => void;
}) {
  const [playing, setPlaying] = useState(false);

  const isAuthor = currentUser?.id === comment.author.id;

  const getReactionCount = (emoji: string) => {
    return comment.reactions.filter((r: any) => r.emoji === emoji).length;
  };

  const hasReacted = (emoji: string) => {
    return comment.reactions.some((r: any) => r.emoji === emoji && r.user.id === currentUser?.id);
  };

  return (
    <div className={`rounded-lg p-3 ${comment.resolved ? "opacity-50" : ""} bg-[#1a1d2e]`}>
      <div className="flex items-start gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">
          {comment.author.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">{comment.author.name}</span>
            <span className="text-xs text-slate-600">
              {new Date(comment.createdAt).toLocaleTimeString()}
            </span>
          </div>
          {comment.type === "node" && (
            <div className="text-xs text-slate-500">on node</div>
          )}
        </div>
      </div>

      {comment.audioUrl && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <span className="text-xs text-slate-400">0:15</span>
        </div>
      )}

      {comment.content && (
        <p className="text-sm text-slate-300 mb-2">{comment.content}</p>
      )}

      {/* Reactions */}
      <div className="flex items-center gap-2 mb-2">
        {["+", "-", "?"].map((emoji) => {
          const count = getReactionCount(emoji);
          const reacted = hasReacted(emoji);
          return (
            <button
              key={emoji}
              onClick={() => onReaction(comment.id, emoji)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                reacted
                  ? "bg-indigo-600 text-white"
                  : "bg-[#0f1117] text-slate-400 hover:text-white"
              }`}
            >
              {emoji === "+" ? "👍" : emoji === "-" ? "👎" : "❓"} {count > 0 && count}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => onReply(comment.id)}
          className="text-slate-500 hover:text-white"
        >
          Reply
        </button>
        {isAuthor && !comment.resolved && (
          <button
            onClick={() => onResolve(comment.id)}
            className="text-slate-500 hover:text-green-400"
          >
            Resolve
          </button>
        )}
        {isAuthor && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-slate-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-[#2d3148] space-y-2">
          {comment.replies.map((reply: any) => (
            <div key={reply.id} className="text-sm">
              <span className="text-white font-medium">{reply.author.name}:</span>{" "}
              <span className="text-slate-300">{reply.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Integrate panel into DiagramEditor

**File:** `apps/web/src/components/DiagramEditor.tsx`

Add import:

```typescript
import { CommentsPanel } from "./CommentsPanel";
```

Load comments on mount:

```typescript
useEffect(() => {
  if (diagramId) {
    store.loadComments(diagramId);
  }
}, [diagramId]);
```

Update comment count:

```typescript
useEffect(() => {
  setCommentCount(store.comments.length);
}, [store.comments]);
```

Render panel:

```typescript
{showComments && diagramId && (
  <CommentsPanel
    diagramId={diagramId}
    currentUser={currentUser}
    onClose={() => setShowComments(false)}
  />
)}
```

### Step 4: Test comments panel

```bash
npm run dev
```

1. Click Comments button in toolbar
2. Verify: Panel slides in from right
3. Click "Text" button, add comment
4. Verify: Comment appears in list
5. Click reaction buttons: verify toggle
6. Click "Reply": verify reply input appears
7. Click "Resolve": verify comment grays out

### Step 5: Commit

```bash
git add apps/web/src/components/CommentsPanel.tsx apps/web/src/components/DiagramEditor.tsx apps/web/src/stores/diagramStore.ts
git commit -m "feat: add comments panel UI

- Right sidebar with comments list
- Action buttons: Record, Text, Pin
- Comment items with author, timestamp, content
- Reactions with toggle (+, -, ?)
- Reply functionality
- Resolve and delete actions
- Nested replies display
- Loads comments from API on mount"
```

---

## Task 13: Frontend - Voice Recording

**Priority:** P2
**Time:** 2 hours
**Dependencies:** Task 6, Task 12

**Files:**
- Create: `apps/web/src/components/modals/VoiceRecorderModal.tsx`
- Modify: `apps/web/src/components/CommentsPanel.tsx`

### Step 1: Create VoiceRecorderModal

**File:** `apps/web/src/components/modals/VoiceRecorderModal.tsx`

```typescript
import { useState, useRef, useEffect } from "react";
import { X, Mic, Square, Play, Pause } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (audioUrl: string) => void;
}

export function VoiceRecorderModal({ onClose, onSubmit }: Props) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl!);
      audioRef.current.onended = () => setPlaying(false);
    }

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    try {
      const res = await fetch("/api/upload/audio", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const { url } = await res.json();
        onSubmit(url);
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Voice Comment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          {!recording && !audioBlob && (
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
            >
              <Mic size={32} />
            </button>
          )}

          {recording && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-600 animate-pulse flex items-center justify-center text-white">
                <Mic size={32} />
              </div>
              <div className="text-2xl text-white font-mono">{formatTime(duration)}</div>
              <button
                onClick={stopRecording}
                className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2"
              >
                <Square size={16} /> Stop
              </button>
            </>
          )}

          {audioBlob && (
            <>
              <div className="text-lg text-white">{formatTime(duration)}</div>
              <button
                onClick={togglePlayback}
                className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white"
              >
                {playing ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setAudioBlob(null);
                    setAudioUrl(null);
                    setDuration(0);
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Re-record
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Add Comment"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-slate-500 text-center">
          Max duration: 2 minutes
        </p>
      </div>
    </div>
  );
}
```

### Step 2: Integrate into CommentsPanel

**File:** `apps/web/src/components/CommentsPanel.tsx`

Add import:

```typescript
import { VoiceRecorderModal } from "./modals/VoiceRecorderModal";
```

Add state:

```typescript
const [showRecorder, setShowRecorder] = useState(false);
```

Update Record button:

```typescript
<button
  onClick={() => setShowRecorder(true)}
  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#1a1d2e] text-slate-400 hover:text-white border border-[#2d3148] hover:border-indigo-500 transition-colors text-sm"
  title="Record voice comment"
>
  <Mic size={14} /> Record
</button>
```

Add handler:

```typescript
const handleAddVoiceComment = async (audioUrl: string) => {
  if (!currentUser) return;

  const res = await fetch(`/api/diagrams/${diagramId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      audioUrl,
      type: "global",
    }),
  });

  if (res.ok) {
    const comment = await res.json();
    addComment(comment);
    setShowRecorder(false);
  }
};
```

Render modal:

```typescript
{showRecorder && (
  <VoiceRecorderModal
    onClose={() => setShowRecorder(false)}
    onSubmit={handleAddVoiceComment}
  />
)}
```

### Step 3: Test voice recording

```bash
npm run dev
```

1. Click "Record" button
2. Allow microphone access
3. Verify: Recording starts, timer counts
4. Click "Stop"
5. Click "Play": verify playback works
6. Click "Add Comment": verify uploads and creates comment
7. Verify: Comment appears with play button

### Step 4: Commit

```bash
git add apps/web/src/components/modals/VoiceRecorderModal.tsx apps/web/src/components/CommentsPanel.tsx
git commit -m "feat: add voice recording for comments

- Modal with record/stop/play controls
- Uses MediaRecorder API (WebRTC)
- Records in webm format
- Shows duration timer
- Playback preview before upload
- Uploads to /api/upload/audio
- Creates comment with audioUrl"
```

---
## Task 14: WebSocket Sync for Comments

**Priority:** P1
**Time:** 1 hour
**Dependencies:** Task 5, Task 12

**Files:**
- Modify: `apps/api/src/routes/ws.ts`
- Modify: `apps/web/src/components/DiagramEditor.tsx`

### Step 1: Add comment broadcast to WebSocket

**File:** `apps/api/src/routes/ws.ts`

The existing WebSocket already broadcasts all messages. We just need to ensure comments are sent through it.

No changes needed to backend - existing broadcast logic handles it.

### Step 2: Add comment sync to frontend WebSocket

**File:** `apps/web/src/components/DiagramEditor.tsx`

Find the `ws.onmessage` handler and add comment handling:

```typescript
ws.onmessage = async (e) => {
  try {
    let data = e.data;
    if (data instanceof Blob) {
      data = await data.text();
    }

    const msg = JSON.parse(data);

    // Existing sync logic for nodes/edges
    if (msg.type === "sync") {
      // ... existing code
    }

    // Add comment sync
    if (msg.type === "comment_added") {
      store.addComment(msg.comment);
    }

    if (msg.type === "comment_updated") {
      store.updateComment(msg.commentId, msg.updates);
    }

    if (msg.type === "comment_deleted") {
      store.deleteComment(msg.commentId);
    }

    if (msg.type === "reaction_toggled") {
      store.toggleReaction(
        msg.commentId,
        msg.emoji,
        msg.userId,
        msg.userName
      );
    }
  } catch (err) {
    console.error("WS message parse error:", err);
  }
};
```

### Step 3: Broadcast comment actions

**File:** `apps/web/src/components/CommentsPanel.tsx`

Update handlers to broadcast via WebSocket:

```typescript
const handleAddTextComment = async (content: string, parentId?: string) => {
  if (!currentUser || !content.trim()) return;

  const res = await fetch(`/api/diagrams/${diagramId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      content: content.trim(),
      type: "global",
      parentId,
    }),
  });

  if (res.ok) {
    const comment = await res.json();
    addComment(comment);
    
    // Broadcast to other clients
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "comment_added",
        comment,
      }));
    }
    
    setReplyText("");
    setReplyTo(null);
  }
};
```

Similar updates for resolve, delete, and reaction handlers.

### Step 4: Test real-time sync

```bash
npm run dev
```

1. Open two browser tabs with same diagram
2. Add comment in tab 1
3. Verify: Comment appears in tab 2 immediately
4. Add reaction in tab 2
5. Verify: Reaction count updates in tab 1
6. Resolve comment in tab 1
7. Verify: Comment grays out in tab 2

### Step 5: Commit

```bash
git add apps/web/src/components/DiagramEditor.tsx apps/web/src/components/CommentsPanel.tsx
git commit -m "feat: add WebSocket sync for comments

- Broadcast comment_added, comment_updated, comment_deleted events
- Broadcast reaction_toggled events
- Handle incoming comment events in WebSocket handler
- Real-time updates across all connected clients
- Reuses existing WebSocket connection"
```

---

## Task 15: Canvas Comment Indicators

**Priority:** P2
**Time:** 2 hours
**Dependencies:** Task 12

**Files:**
- Modify: `apps/web/src/components/DiagramEditor.tsx`
- Create: `apps/web/src/components/CommentIndicator.tsx`

### Step 1: Create CommentIndicator component

**File:** `apps/web/src/components/CommentIndicator.tsx`

```typescript
import { MessageSquare } from "lucide-react";

interface Props {
  count: number;
  position: { x: number; y: number };
  onClick: () => void;
}

export function CommentIndicator({ count, position, onClick }: Props) {
  return (
    <div
      className="absolute z-20 cursor-pointer"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
      onClick={onClick}
    >
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg hover:bg-indigo-500 transition-colors">
          <MessageSquare size={16} />
        </div>
        {count > 1 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-xs text-white font-bold">
            {count}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Add indicators to DiagramEditor

**File:** `apps/web/src/components/DiagramEditor.tsx`

Add import:

```typescript
import { CommentIndicator } from "./CommentIndicator";
```

Add function to get comment positions:

```typescript
const getCommentIndicators = () => {
  const indicators: Array<{
    id: string;
    position: { x: number; y: number };
    count: number;
    comments: Comment[];
  }> = [];

  // Group position-attached comments
  const positionComments = store.comments.filter((c) => c.type === "position");
  const grouped = new Map<string, Comment[]>();
  
  positionComments.forEach((c) => {
    const key = `${c.posX},${c.posY}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  });

  grouped.forEach((comments, key) => {
    const [x, y] = key.split(",").map(Number);
    indicators.push({
      id: key,
      position: { x, y },
      count: comments.length,
      comments,
    });
  });

  return indicators;
};
```

Render indicators:

```typescript
{getCommentIndicators().map((indicator) => (
  <CommentIndicator
    key={indicator.id}
    count={indicator.count}
    position={indicator.position}
    onClick={() => {
      setShowComments(true);
      // TODO: scroll to first comment in list
    }}
  />
))}
```

### Step 3: Add badges to nodes

Update TechNode component to show comment badge:

```typescript
// In TechNode.tsx, add prop:
interface TechNodeProps {
  // ... existing props
  commentCount?: number;
}

// In render:
{commentCount > 0 && (
  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-bold">
    💬
  </div>
)}
```

Pass comment count from DiagramEditor:

```typescript
const getNodeCommentCount = (nodeId: string) => {
  return store.comments.filter((c) => c.type === "node" && c.nodeId === nodeId).length;
};

// When rendering nodes, pass commentCount prop
```

### Step 4: Test indicators

```bash
npm run dev
```

1. Add position-attached comment (Pin button)
2. Verify: Blue indicator appears on canvas
3. Click indicator: verify opens comments panel
4. Add comment to node
5. Verify: Badge appears on node
6. Add multiple comments to same position
7. Verify: Count badge shows correct number

### Step 5: Commit

```bash
git add apps/web/src/components/CommentIndicator.tsx apps/web/src/components/DiagramEditor.tsx apps/web/src/components/nodes/TechNode.tsx
git commit -m "feat: add canvas indicators for comments

- Blue pin indicators for position-attached comments
- Badge on nodes showing comment count
- Click indicator to open comments panel
- Count badge for multiple comments at same position
- Hover effects and transitions"
```

---

## Task 16: Final Integration and Testing

**Priority:** P0
**Time:** 2 hours
**Dependencies:** All previous tasks

**Files:**
- None (testing only)

### Step 1: Build all packages

```bash
# Root
npm run build

# API
cd apps/api
npm run build

# Web
cd apps/web
npm run build
```

Expected: All builds succeed with no errors

### Step 2: Run database migrations

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

Expected: All migrations applied, 36 node types seeded

### Step 3: Start production servers

```bash
# Terminal 1 - API
cd apps/api
npm start

# Terminal 2 - Web
cd apps/web
npm run preview
```

### Step 4: Manual testing checklist

**Node Types:**
- [ ] Nodes tab shows all 36 node types
- [ ] Can drag nodes to canvas
- [ ] Click "+ Add Node Type" opens modal
- [ ] Create new node type, appears in list
- [ ] New node type persists after refresh
- [ ] New node type visible to other users

**Projects Tab:**
- [ ] Projects tab shows all diagrams
- [ ] Search by name filters correctly
- [ ] Filter by author works
- [ ] Pagination loads more items
- [ ] Click project opens in editor
- [ ] Shows correct author and date

**Routing:**
- [ ] After login, opens editor with empty canvas
- [ ] No Dashboard appears
- [ ] Can create new project from editor
- [ ] URL updates when opening project

**Toolbar:**
- [ ] Top toolbar appears centered
- [ ] Add button creates default node
- [ ] Delete button removes selected nodes
- [ ] Zoom dropdown shows options
- [ ] Layout button works
- [ ] Comments button toggles panel

**Comments:**
- [ ] Comments panel slides in from right
- [ ] Can add text comment
- [ ] Can record voice comment (2 min max)
- [ ] Voice playback works
- [ ] Reactions toggle correctly (+, -, ?)
- [ ] Reply functionality works
- [ ] Resolve grays out comment
- [ ] Delete removes comment
- [ ] Comments sync in real-time (2 tabs)

**Canvas Indicators:**
- [ ] Position-attached comments show pin
- [ ] Node-attached comments show badge
- [ ] Click indicator opens panel
- [ ] Count badge shows correct number

**WebSocket Sync:**
- [ ] Open 2 tabs with same diagram
- [ ] Add comment in tab 1 → appears in tab 2
- [ ] Add reaction in tab 2 → updates in tab 1
- [ ] Resolve in tab 1 → grays out in tab 2
- [ ] Add node type in tab 1 → appears in tab 2

### Step 5: Performance testing

- [ ] Load diagram with 100+ nodes: smooth
- [ ] Add 50 comments: panel scrolls smoothly
- [ ] Filter 500 projects: results in <1s
- [ ] Voice recording: no lag or glitches
- [ ] WebSocket reconnection works after network drop

### Step 6: Browser compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Step 7: Document issues

Create GitHub issues for any bugs found during testing.

### Step 8: Final commit

```bash
git add .
git commit -m "chore: final integration and testing

- All features tested and working
- Performance validated
- Browser compatibility confirmed
- Ready for deployment"
```

---

## Deployment Notes

### Environment Variables

**Backend (.env):**
```
DATABASE_URL=postgresql://user:pass@host:5432/techflow
JWT_SECRET=your-secret-key
NODE_ENV=production
```

**Frontend:**
- Update API URL if backend is on different domain
- Configure CORS in backend for production domain

### Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### File Storage

Ensure `/uploads` directory is writable:
```bash
mkdir -p uploads/audio
chmod 755 uploads
```

For production, consider using S3 or similar for audio files.

### WebSocket Configuration

If using reverse proxy (nginx), configure WebSocket upgrade:
```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## Success Criteria

- ✅ All 36 node types migrated to database
- ✅ Users can add new node types (append-only)
- ✅ Projects tab shows all diagrams with filtering
- ✅ Dashboard removed, editor opens directly
- ✅ Top toolbar consolidates all controls
- ✅ Comments panel with text and voice
- ✅ Reactions work (+, -, ?)
- ✅ Real-time sync via WebSocket
- ✅ Canvas indicators for comments
- ✅ All tests passing
- ✅ No regressions in existing features

---

## Rollback Plan

If critical issues occur:

**Rollback database:**
```bash
npx prisma migrate reset
# Re-run previous migrations
```

**Rollback code:**
```bash
git revert HEAD~N  # N = number of commits to revert
```

**Restore from backup:**
- Database backup before migration
- Code backup before deployment

---
