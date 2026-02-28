import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const diagramBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    macros: z.array(z.any()).optional(),
  }),
  isPublic: z.boolean().optional(),
  teamId: z.string().optional(),
});

export async function diagramRoutes(app: FastifyInstance) {
  // Список диаграмм пользователя
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const { id: userId } = req.user as { id: string };
    return prisma.diagram.findMany({
      where: { createdById: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true,
        thumbnail: true, isPublic: true, createdAt: true, updatedAt: true,
      },
    });
  });

  // Получить одну диаграмму (доступно для гостей)
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    // Проверяем авторизацию, но не требуем её
    let userId: string | null = null;
    try {
      await req.jwtVerify();
      userId = (req.user as { id: string }).id;
    } catch {
      // Гость - продолжаем без userId
    }

    const diagram = await prisma.diagram.findFirst({
      where: {
        id: req.params.id,
        ...(userId
          ? {
              OR: [
                { createdById: userId },
                { isPublic: true },
                { shares: { some: { userId } } },
              ],
            }
          : { id: req.params.id }), // Гости могут открыть любую диаграмму по прямой ссылке
      },
    });
    if (!diagram) return reply.code(404).send({ error: "Diagram not found" });
    return diagram;
  });

  // Создать диаграмму
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = diagramBodySchema.parse(req.body);
    const diagram = await prisma.diagram.create({
      data: { ...body, createdById: userId },
    });
    return reply.code(201).send(diagram);
  });

  // Обновить диаграмму (доступно для гостей)
  app.put<{ Params: { id: string } }>("/:id", async (req, reply) => {
    // Проверяем авторизацию, но не требуем её
    let userId: string | null = null;
    try {
      await req.jwtVerify();
      userId = (req.user as { id: string }).id;
    } catch {
      // Гость - продолжаем без userId
    }

    const body = diagramBodySchema.partial().parse(req.body);

    const existing = await prisma.diagram.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return reply.code(404).send({ error: "Diagram not found" });

    // Если пользователь авторизован, проверяем права
    if (userId && existing.createdById !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    // Сохраняем версию перед обновлением (только если есть изменения в data)
    if (body.data) {
      const lastVersion = await prisma.diagramVersion.count({ where: { diagramId: existing.id } });
      await prisma.diagramVersion.create({
        data: { diagramId: existing.id, data: existing.data as any, version: lastVersion + 1 },
      });
    }

    const updated = await prisma.diagram.update({
      where: { id: req.params.id },
      data: body,
    });
    return updated;
  });

  // Удалить диаграмму
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const existing = await prisma.diagram.findFirst({
      where: { id: req.params.id, createdById: userId },
    });
    if (!existing) return reply.code(403).send({ error: "Forbidden" });
    await prisma.diagram.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // История версий
  app.get<{ Params: { id: string } }>("/:id/versions", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const diagram = await prisma.diagram.findFirst({ where: { id: req.params.id, createdById: userId } });
    if (!diagram) return reply.code(403).send({ error: "Forbidden" });
    return prisma.diagramVersion.findMany({
      where: { diagramId: req.params.id },
      orderBy: { version: "desc" },
      take: 50,
    });
  });

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
}
