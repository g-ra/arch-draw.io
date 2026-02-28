import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const createCommentSchema = z.object({
  diagramId: z.string(),
  content: z.string().optional(),
  audioUrl: z.string().min(1).optional().or(z.literal("")).transform(val => val || undefined),
  type: z.enum(["text", "voice", "node", "position", "global"]),
  nodeId: z.string().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  parentId: z.string().nullable().optional(),
}).refine(
  (data) => data.content || data.audioUrl,
  { message: "Either content or audioUrl must be provided" }
);

const updateCommentSchema = z.object({
  content: z.string().optional(),
  resolved: z.boolean().optional(),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export async function commentRoutes(app: FastifyInstance) {
  // List comments for a diagram
  app.get<{ Querystring: { diagramId: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { diagramId } = req.query;

      if (!diagramId) {
        return reply.code(400).send({ error: "diagramId is required" });
      }

      const comments = await prisma.comment.findMany({
        where: { diagramId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return comments;
    }
  );

  // Create comment
  app.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const { id: userId } = req.user as { id: string };
    const body = createCommentSchema.parse(req.body);

    // Verify diagram exists
    const diagram = await prisma.diagram.findUnique({
      where: { id: body.diagramId },
    });

    if (!diagram) {
      return reply.code(404).send({ error: "Diagram not found" });
    }

    // Verify parent comment exists if parentId provided
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: body.parentId },
      });
      if (!parent || parent.diagramId !== body.diagramId) {
        return reply.code(404).send({ error: "Parent comment not found" });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        diagramId: body.diagramId,
        authorId: userId,
        content: body.content,
        audioUrl: body.audioUrl,
        type: body.type,
        nodeId: body.nodeId,
        posX: body.posX,
        posY: body.posY,
        parentId: body.parentId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        reactions: true,
        replies: true,
      },
    });

    return reply.code(201).send(comment);
  });

  // Update comment
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };
      const body = updateCommentSchema.parse(req.body);

      const comment = await prisma.comment.findUnique({
        where: { id: req.params.id },
        include: {
          diagram: true,
        },
      });

      if (!comment) {
        return reply.code(404).send({ error: "Comment not found" });
      }

      // Only author or diagram owner can update
      if (comment.authorId !== userId && comment.diagram.createdById !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const updated = await prisma.comment.update({
        where: { id: req.params.id },
        data: body,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          replies: true,
        },
      });

      return updated;
    }
  );

  // Delete comment
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };

      const comment = await prisma.comment.findUnique({
        where: { id: req.params.id },
        include: {
          diagram: true,
        },
      });

      if (!comment) {
        return reply.code(404).send({ error: "Comment not found" });
      }

      // Only author or diagram owner can delete
      if (comment.authorId !== userId && comment.diagram.createdById !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      await prisma.comment.delete({
        where: { id: req.params.id },
      });

      return { ok: true };
    }
  );

  // Toggle reaction
  app.post<{ Params: { id: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id: userId } = req.user as { id: string };
      const { emoji } = reactionSchema.parse(req.body);

      const comment = await prisma.comment.findUnique({
        where: { id: req.params.id },
      });

      if (!comment) {
        return reply.code(404).send({ error: "Comment not found" });
      }

      // Check if reaction already exists
      const existing = await prisma.commentReaction.findUnique({
        where: {
          commentId_userId_emoji: {
            commentId: req.params.id,
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
        return { action: "removed", emoji };
      } else {
        // Add reaction
        await prisma.commentReaction.create({
          data: {
            commentId: req.params.id,
            userId,
            emoji,
          },
        });
        return { action: "added", emoji };
      }
    }
  );
}
