# TechFlow

Architecture diagrams & animated data flow editor for engineers.
Draw microservices, networks, DevOps pipelines — and animate the data flow between them.

## Stack

| Layer     | Tech                                      |
|-----------|-------------------------------------------|
| Frontend  | React 19, ReactFlow, Framer Motion, Zustand, Tailwind |
| Backend   | Fastify 5, TypeScript, Prisma ORM         |
| Database  | PostgreSQL 16                             |
| Auth      | JWT (cookie) + GitHub OAuth               |
| Realtime  | WebSocket (built-in Fastify)              |
| Monorepo  | Turborepo + pnpm workspaces               |

## Quick Start

### 1. Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker + Docker Compose

### 2. Clone & install

```bash
git clone <repo>
cd techflow
pnpm install
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` if needed (defaults work out of the box with docker-compose):

```env
DATABASE_URL="postgresql://techflow:techflow_secret@localhost:5432/techflow"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
GITHUB_CLIENT_ID=""      # optional — for GitHub OAuth
GITHUB_CLIENT_SECRET=""  # optional — for GitHub OAuth
FRONTEND_URL="http://localhost:5173"
PORT=3001
```

### 5. Apply database schema

```bash
cd apps/api
pnpm db:push     # push schema (dev)
# or
pnpm db:migrate  # create migration files (recommended for prod)
cd ../..
```

### 6. Run everything

```bash
pnpm dev
```

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173       |
| API       | http://localhost:3001       |
| Health    | http://localhost:3001/health|
| DB Studio | `pnpm db:studio`            |

## GitHub OAuth Setup (optional)

1. Go to https://github.com/settings/developers → New OAuth App
2. Set **Homepage URL**: `http://localhost:5173`
3. Set **Callback URL**: `http://localhost:3001/api/auth/github/callback`
4. Copy Client ID + Secret into `apps/api/.env`

Without GitHub OAuth, use the **Dev Login** form on the login page (development only).

## Features

- **35+ ready-made nodes**: Load Balancer, API Gateway, PostgreSQL, Kafka, Docker, K8s, Grafana, etc.
- **Animated data flow edges**: particles travel along connections with configurable speed & protocol labels
- **Auto-save**: diagrams save automatically 2s after changes
- **Version history**: every save snapshots the previous state
- **Real-time sync**: multiple users editing via WebSocket
- **Dark theme**: built for engineers, not designers

## Project Structure

```
techflow/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── prisma/
│   │   │   └── schema.prisma   # DB schema
│   │   └── src/
│   │       ├── index.ts        # entry point
│   │       ├── lib/prisma.ts   # Prisma client
│   │       ├── middleware/auth.ts
│   │       └── routes/
│   │           ├── auth.ts     # login, OAuth, /me
│   │           ├── diagrams.ts # CRUD + versions
│   │           └── ws.ts       # WebSocket rooms
│   └── web/                    # React frontend
│       └── src/
│           ├── App.tsx
│           ├── components/
│           │   ├── LoginPage.tsx
│           │   ├── Dashboard.tsx
│           │   ├── DiagramEditor.tsx
│           │   ├── NodePanel.tsx
│           │   └── nodes/
│           │       ├── TechNode.tsx          # custom node component
│           │       └── AnimatedFlowEdge.tsx  # animated edge
│           ├── stores/diagramStore.ts        # Zustand state
│           ├── lib/
│           │   ├── nodeLibrary.ts            # 35+ node templates
│           │   └── nodeIcons.ts              # emoji icon map
│           └── types/diagram.ts
├── packages/                   # shared packages (ui, nodes, types)
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Adding Custom Nodes

Edit `apps/web/src/lib/nodeLibrary.ts` to add new node templates:

```ts
{ id: "my-service", label: "My Service", category: "backend", tech: "go", description: "Custom service" }
```

Add the icon in `apps/web/src/lib/nodeIcons.ts`:

```ts
"my-service": "🚀"
```

## Database Management

```bash
# Open Prisma Studio (visual DB editor)
pnpm db:studio

# Create a migration
cd apps/api && pnpm db:migrate

# Reset database
cd apps/api && pnpm exec prisma migrate reset
```

## Roadmap

- [ ] Edge properties panel (change protocol, speed, color)
- [ ] Export to PNG / SVG
- [ ] Import from Mermaid / YAML
- [ ] Teams & shared workspaces
- [ ] Mermaid code generation
- [ ] Component marketplace
- [ ] Embed in Notion / Confluence
