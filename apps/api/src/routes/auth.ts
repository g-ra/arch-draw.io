import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
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
