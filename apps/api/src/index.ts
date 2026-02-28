import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { authRoutes } from "./routes/auth";
import { diagramRoutes } from "./routes/diagrams";
import { wsRoutes } from "./routes/ws";
import { macroRoutes } from "./routes/macros";
import { nodeTypeRoutes } from "./routes/nodeTypes";
import { commentRoutes } from "./routes/comments";
import { uploadRoutes } from "./routes/upload";

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function bootstrap() {
  await app.register(cors, {
    origin: FRONTEND_URL,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    cookie: { cookieName: "token", signed: false },
  });

  await app.register(websocket);

  // File upload support
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Serve uploaded files
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
  });

  // Routes
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(diagramRoutes, { prefix: "/api/diagrams" });
  await app.register(macroRoutes, { prefix: "/api/macros" });
  await app.register(nodeTypeRoutes, { prefix: "/api/node-types" });
  await app.register(commentRoutes, { prefix: "/api/comments" });
  await app.register(uploadRoutes, { prefix: "/api/upload" });
  await app.register(wsRoutes, { prefix: "/ws" });

  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${PORT}`);
}

bootstrap().catch(console.error);
