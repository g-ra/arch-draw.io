import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { authRoutes } from "./routes/auth";
import { diagramRoutes } from "./routes/diagrams";
import { wsRoutes } from "./routes/ws";
import { macroRoutes } from "./routes/macros";
import { nodeTypeRoutes } from "./routes/nodeTypes";

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

  // Routes
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(diagramRoutes, { prefix: "/api/diagrams" });
  await app.register(macroRoutes, { prefix: "/api/macros" });
  await app.register(nodeTypeRoutes, { prefix: "/api/node-types" });
  await app.register(wsRoutes, { prefix: "/ws" });

  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${PORT}`);
}

bootstrap().catch(console.error);
