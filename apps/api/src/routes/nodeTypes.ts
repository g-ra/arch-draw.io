import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const nodeTypeBodySchema = z.object({
  label: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  tech: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
});

export async function nodeTypeRoutes(app: FastifyInstance) {
  // List all node types (public - no auth required)
  app.get("/", async () => {
    return prisma.nodeType.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  });

  // Create new node type (authenticated)
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = nodeTypeBodySchema.parse(req.body);

    const nodeType = await prisma.nodeType.create({
      data: {
        label: body.label,
        category: body.category,
        tech: body.tech,
        description: body.description,
        icon: body.icon,
        color: body.color,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return reply.code(201).send(nodeType);
  });
}
