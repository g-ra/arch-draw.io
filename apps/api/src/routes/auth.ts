import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateTOTPSecret, generateQRCode, verifyTOTPCode } from "../lib/totp";
import { rateLimiter } from "../lib/rate-limiter";

const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const totpLoginSchema = z.object({
  email: z.string().email(),
  code: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // GitHub OAuth — redirect
  app.get("/github", async (req, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirect = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email`;
    reply.redirect(redirect);
  });

  // GitHub OAuth — callback
  app.get<{ Querystring: { code: string } }>("/github/callback", async (req, reply) => {
    const { code } = req.query;

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = (await userRes.json()) as {
      id: number;
      login: string;
      name: string;
      avatar_url: string;
      email: string;
    };

    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails = (await emailRes.json()) as { email: string; primary: boolean }[];
    const primaryEmail = emails.find((e) => e.primary)?.email || githubUser.email;

    let user = await prisma.user.findFirst({
      where: { oauthProvider: "github", oauthId: String(githubUser.id) },
    });

    if (!user) {
      user = await prisma.user.upsert({
        where: { email: primaryEmail },
        update: { avatar: githubUser.avatar_url, name: githubUser.name || githubUser.login },
        create: {
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          oauthProvider: "github",
          oauthId: String(githubUser.id),
        },
      });
    }

    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" });

    reply
      .setCookie("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 })
      .redirect(`${process.env.FRONTEND_URL}/dashboard`);
  });

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

      // If code provided, verify and save
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

        // Save secret and reset rate limiter
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { totpSecret: secret },
          });
        } catch (error) {
          return reply.code(500).send({ error: "Database error" });
        }

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
      return { qrCode, message: "Scan QR code with authenticator app" };
    }

    // Case 2: User has TOTP secret (existing user)
    if (!code) {
      return reply.code(400).send({ error: "TOTP code required" });
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

  // Dev login (только для разработки)
  app.post("/dev-login", async (req, reply) => {
    if (process.env.NODE_ENV === "production") {
      return reply.code(404).send({ error: "Not found" });
    }

    const body = loginSchema.parse(req.body);

    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: {},
      create: { email: body.email, name: body.name },
    });

    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" });
    reply.setCookie("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
    return { user };
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
