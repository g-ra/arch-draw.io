import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateTOTPSecret, generateQRCode, verifyTOTPCode } from "../lib/totp";
import { rateLimiter } from "../lib/rate-limiter";

const totpLoginSchema = z.object({
  email: z.string().email(),
  code: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // TOTP Login
  app.post("/login", async (req, reply) => {
    const body = totpLoginSchema.parse(req.body);
    const { email, code } = body;
    const isDevMode = process.env.NODE_ENV !== "production";

    // Check rate limiting (skip in dev mode)
    if (!isDevMode && rateLimiter.isBlocked(email)) {
      const remainingTime = rateLimiter.getRemainingBlockTime(email);
      return reply.code(429).send({
        error: "Too many attempts",
        retryAfter: Math.ceil(remainingTime / 1000),
      });
    }

    // Find or create user
    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Auto-generate name from email
        const name = email.split("@")[0];
        user = await prisma.user.create({
          data: {
            email,
            name,
            isActive: false,
          },
        });
      }
    } catch (error) {
      return reply.code(500).send({ error: "Database error" });
    }

    // Case 1: User has no TOTP secret (first time setup)
    if (!user.totpSecret) {
      const secret = generateTOTPSecret();
      const qrCode = await generateQRCode(secret, email);

      // Save secret immediately (before verification)
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { totpSecret: secret },
        });
      } catch (error) {
        return reply.code(500).send({ error: "Database error" });
      }

      // If code provided, verify it
      if (code) {
        const isValid = verifyTOTPCode(secret, code, isDevMode);

        if (!isValid) {
          if (!isDevMode) {
            const allowed = rateLimiter.check(email);
            if (!allowed) {
              const remainingTime = rateLimiter.getRemainingBlockTime(email);
              return reply.code(429).send({
                error: "Too many attempts",
                retryAfter: Math.ceil(remainingTime / 1000),
              });
            }
          }
          return reply.code(401).send({ error: "Invalid TOTP code" });
        }

        // Reset rate limiter on success
        if (!isDevMode) {
          rateLimiter.reset(email);
        }

        // Check activation status
        if (!user.isActive && !isDevMode) {
          return reply.code(403).send({ error: "Account pending activation" });
        }

        // Return JWT
        const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" });
        reply.setCookie("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });

        return { user: { id: user.id, email: user.email, name: user.name } };
      }

      // No code provided, return QR code for setup
      return { needsSetup: true, qrCode, secret };
    }

    // Case 2: User has TOTP secret (existing user)
    if (!code) {
      return reply.code(400).send({ error: "Code required" });
    }

    // Verify code
    const isValid = verifyTOTPCode(user.totpSecret, code, isDevMode);

    if (!isValid) {
      if (!isDevMode) {
        const allowed = rateLimiter.check(email);
        if (!allowed) {
          const remainingTime = rateLimiter.getRemainingBlockTime(email);
          return reply.code(429).send({
            error: "Too many attempts",
            retryAfter: Math.ceil(remainingTime / 1000),
          });
        }
      }
      return reply.code(401).send({ error: "Invalid TOTP code" });
    }

    // Reset rate limiter on success
    if (!isDevMode) {
      rateLimiter.reset(email);
    }

    // Check activation status
    if (!user.isActive && !isDevMode) {
      return reply.code(403).send({ error: "Account pending activation" });
    }

    // Return JWT
    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" });
    reply.setCookie("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });

    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  // Текущий пользователь
  app.get("/me", async (req, reply) => {
    try {
      await req.jwtVerify();
      const payload = req.user as { id: string };
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) return reply.code(404).send({ error: "User not found" });
      return user;
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // Logout
  app.post("/logout", async (req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });
}
