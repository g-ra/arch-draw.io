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
