import { FastifyInstance } from "fastify";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { requireAuth } from "../middleware/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "audio");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

export async function uploadRoutes(app: FastifyInstance) {
  // Upload audio file
  app.post("/audio", { preHandler: requireAuth }, async (req, reply) => {
    try {
      const data = await req.file();

      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({
          error: "Invalid file type. Only audio files are allowed.",
        });
      }

      // Validate file size
      const fileSize = parseInt(req.headers["content-length"] || "0");
      if (fileSize > MAX_FILE_SIZE) {
        return reply.code(400).send({
          error: "File too large. Maximum size is 10MB.",
        });
      }

      // Generate unique filename
      const ext = path.extname(data.filename);
      const filename = `${randomUUID()}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Save file
      await pipeline(data.file, createWriteStream(filepath));

      // Return public URL
      const url = `/uploads/audio/${filename}`;
      return reply.code(201).send({ url });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "Upload failed" });
    }
  });
}
