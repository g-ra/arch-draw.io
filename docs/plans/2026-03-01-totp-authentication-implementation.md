# TOTP Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Dev Login and GitHub OAuth with TOTP-based authentication using authenticator apps.

**Architecture:** Inline TOTP setup on login page with email-only input. First-time users see QR code, scan with authenticator app, verify code. Existing users enter email + TOTP code. New accounts require admin activation (isActive flag). Dev mode supports static code bypass.

**Tech Stack:** Fastify, Prisma, PostgreSQL, React, otplib (TOTP), qrcode (QR generation)

**Design Document:** `docs/plans/2026-03-01-totp-authentication-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `apps/api/prisma/migrations/20260301_add_totp_fields/migration.sql`
- Modify: `apps/api/prisma/schema.prisma`

**Step 1: Update Prisma schema**

Edit `apps/api/prisma/schema.prisma`:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  avatar        String?

  // TOTP Authentication
  totpSecret    String?   @map("totp_secret")

  // User Moderation
  isActive      Boolean   @default(false) @map("is_active")

  // Remove these fields (or keep for compatibility)
  // oauthProvider String?   @map("oauth_provider")
  // oauthId       String?   @map("oauth_id")

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  ownedTeams       Team[]    @relation("TeamOwner")
  teamMembers      TeamMember[]
  diagrams         Diagram[]
  sharedWith       DiagramShare[]
  macros           UserMacro[]
  nodeTypes        NodeType[]
  comments         Comment[]
  commentReactions CommentReaction[]

  @@map("users")
}
```

**Step 2: Create migration**

Run: `cd apps/api && pnpm prisma migrate dev --name add_totp_fields`

Expected: Creates migration file and applies to database

**Step 3: Verify migration**

Run: `cd apps/api && pnpm prisma migrate status`

Expected: Shows migration applied successfully

**Step 4: Update existing users**

Run SQL in database:
```sql
UPDATE users SET is_active = true WHERE totp_secret IS NULL;
```

**Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(auth): add TOTP fields to User model

- Add totpSecret for TOTP authentication
- Add isActive for user moderation
- Set existing users to active by default"
```

---

## Task 2: Install Dependencies and Create TOTP Utilities

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/lib/totp.ts`
- Create: `apps/api/src/lib/totp.test.ts`

**Step 1: Install dependencies**

Run: `cd apps/api && pnpm add otplib qrcode && pnpm add -D @types/qrcode`

Expected: Dependencies installed

**Step 2: Write failing test for TOTP utilities**

Create `apps/api/src/lib/totp.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { generateTOTPSecret, generateQRCode, verifyTOTPCode } from './totp';

describe('TOTP Utilities', () => {
  let secret: string;

  beforeEach(() => {
    secret = generateTOTPSecret();
  });

  test('generateTOTPSecret returns valid base32 string', () => {
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(16);
  });

  test('generateQRCode creates data URL', async () => {
    const qrCode = await generateQRCode(secret, 'test@example.com');
    expect(qrCode).toMatch(/^data:image\/png;base64,/);
  });

  test('verifyTOTPCode accepts valid code', () => {
    const authenticator = require('otplib').authenticator;
    const validCode = authenticator.generate(secret);

    const result = verifyTOTPCode(secret, validCode, false);
    expect(result).toBe(true);
  });

  test('verifyTOTPCode rejects invalid code', () => {
    const result = verifyTOTPCode(secret, '000000', false);
    expect(result).toBe(false);
  });

  test('verifyTOTPCode accepts dev static code in dev mode', () => {
    process.env.DEV_STATIC_CODE = '123456';
    const result = verifyTOTPCode(secret, '123456', true);
    expect(result).toBe(true);
  });

  test('verifyTOTPCode rejects dev static code in production', () => {
    process.env.DEV_STATIC_CODE = '123456';
    const result = verifyTOTPCode(secret, '123456', false);
    expect(result).toBe(false);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/lib/totp.test.ts`

Expected: FAIL - module not found

**Step 4: Implement TOTP utilities**

Create `apps/api/src/lib/totp.ts`:

```typescript
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/**
 * Generate a new TOTP secret (base32 encoded)
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate QR code data URL for TOTP setup
 * @param secret - TOTP secret (base32)
 * @param email - User email for authenticator app label
 */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const otpauth = authenticator.keyuri(email, 'TechFlow', secret);
  return await QRCode.toDataURL(otpauth);
}

/**
 * Verify TOTP code
 * @param secret - TOTP secret (base32)
 * @param code - 6-digit code from authenticator
 * @param isDevMode - Whether running in development mode
 */
export function verifyTOTPCode(secret: string, code: string, isDevMode: boolean): boolean {
  // Dev mode bypass
  if (isDevMode && code === process.env.DEV_STATIC_CODE) {
    return true;
  }

  // Validate format
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  // Verify with ±1 time window (30 seconds)
  try {
    return authenticator.verify({
      token: code,
      secret: secret,
    });
  } catch {
    return false;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api && pnpm test src/lib/totp.test.ts`

Expected: PASS - all tests green

**Step 6: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/lib/totp.ts apps/api/src/lib/totp.test.ts
git commit -m "feat(auth): add TOTP utilities

- generateTOTPSecret: create base32 secret
- generateQRCode: create QR code data URL
- verifyTOTPCode: verify code with dev bypass
- Full test coverage"
```

---

## Task 3: Implement Rate Limiter

**Files:**
- Create: `apps/api/src/lib/rate-limiter.ts`
- Create: `apps/api/src/lib/rate-limiter.test.ts`

**Step 1: Write failing test for rate limiter**

Create `apps/api/src/lib/rate-limiter.test.ts`:

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts, 15 min
    vi.useFakeTimers();
  });

  test('allows attempts under limit', () => {
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
  });

  test('blocks after max attempts', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('test@example.com');
    }
    expect(limiter.isBlocked('test@example.com')).toBe(true);
  });

  test('resets counter after success', () => {
    limiter.check('test@example.com');
    limiter.check('test@example.com');
    limiter.reset('test@example.com');

    expect(limiter.getAttempts('test@example.com')).toBe(0);
  });

  test('unblocks after timeout', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('test@example.com');
    }
    expect(limiter.isBlocked('test@example.com')).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1000); // 15 min + 1 sec

    expect(limiter.isBlocked('test@example.com')).toBe(false);
  });

  test('returns remaining time when blocked', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('test@example.com');
    }

    const remaining = limiter.getRemainingBlockTime('test@example.com');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/lib/rate-limiter.test.ts`

Expected: FAIL - module not found

**Step 3: Implement rate limiter**

Create `apps/api/src/lib/rate-limiter.ts`:

```typescript
interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxAttempts: number;
  private blockDuration: number;

  constructor(maxAttempts: number = 5, blockDuration: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.blockDuration = blockDuration;
  }

  /**
   * Check if email can make another attempt
   * Increments attempt counter
   */
  check(email: string): boolean {
    const now = Date.now();
    const entry = this.store.get(email);

    if (!entry) {
      this.store.set(email, { attempts: 1, blockedUntil: null });
      return true;
    }

    // Check if still blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return false;
    }

    // Reset if block expired
    if (entry.blockedUntil && entry.blockedUntil <= now) {
      entry.attempts = 1;
      entry.blockedUntil = null;
      return true;
    }

    // Increment attempts
    entry.attempts++;

    // Block if exceeded
    if (entry.attempts >= this.maxAttempts) {
      entry.blockedUntil = now + this.blockDuration;
      return false;
    }

    return true;
  }

  /**
   * Check if email is currently blocked
   */
  isBlocked(email: string): boolean {
    const entry = this.store.get(email);
    if (!entry || !entry.blockedUntil) return false;

    const now = Date.now();
    return entry.blockedUntil > now;
  }

  /**
   * Reset attempt counter (call on successful login)
   */
  reset(email: string): void {
    this.store.delete(email);
  }

  /**
   * Get current attempt count
   */
  getAttempts(email: string): number {
    return this.store.get(email)?.attempts || 0;
  }

  /**
   * Get remaining block time in milliseconds
   */
  getRemainingBlockTime(email: string): number {
    const entry = this.store.get(email);
    if (!entry || !entry.blockedUntil) return 0;

    const now = Date.now();
    const remaining = entry.blockedUntil - now;
    return remaining > 0 ? remaining : 0;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test src/lib/rate-limiter.test.ts`

Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add apps/api/src/lib/rate-limiter.ts apps/api/src/lib/rate-limiter.test.ts
git commit -m "feat(auth): add rate limiter for login attempts

- Track failed attempts per email
- Block after 5 failures for 15 minutes
- Auto-reset on success or timeout
- Full test coverage with fake timers"
```

---

## Task 4: Implement New Auth Endpoint

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/auth.test.ts`

**Step 1: Write failing integration test**

Create `apps/api/src/routes/auth.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from './auth';
import { prisma } from '../lib/prisma';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

describe('POST /api/auth/login', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();
    await app.register(cookie);
    await app.register(jwt, { secret: 'test-secret' });
    await app.register(authRoutes, { prefix: '/api/auth' });

    // Clean test users
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  });

  afterEach(async () => {
    await app.close();
  });

  test('new email creates user and returns QR code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'new@test.com' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.needsSetup).toBe(true);
    expect(body.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
  });

  test('existing user with totpSecret requires code', async () => {
    // Create user with TOTP
    const user = await prisma.user.create({
      data: {
        email: 'existing@test.com',
        name: 'existing',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        isActive: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'existing@test.com' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Code required');
  });

  test('valid TOTP code returns JWT', async () => {
    const { authenticator } = require('otplib');
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = authenticator.generate(secret);

    await prisma.user.create({
      data: {
        email: 'active@test.com',
        name: 'active',
        totpSecret: secret,
        isActive: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'active@test.com', code },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('active@test.com');
    expect(response.cookies).toBeDefined();
  });

  test('inactive user returns pending activation error', async () => {
    const { authenticator } = require('otplib');
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = authenticator.generate(secret);

    await prisma.user.create({
      data: {
        email: 'inactive@test.com',
        name: 'inactive',
        totpSecret: secret,
        isActive: false,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'inactive@test.com', code },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Account pending activation');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test src/routes/auth.test.ts`

Expected: FAIL - tests fail because endpoint not implemented

**Step 3: Implement new login endpoint**

Modify `apps/api/src/routes/auth.ts`:

```typescript
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateTOTPSecret, generateQRCode, verifyTOTPCode } from "../lib/totp";
import { rateLimiter } from "../lib/rate-limiter";

const loginSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // New unified login endpoint
  app.post("/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { email, code } = body;
    const isDevMode = process.env.NODE_ENV === "development";

    // Check rate limiting (skip in dev mode)
    if (!isDevMode && rateLimiter.isBlocked(email)) {
      const remaining = Math.ceil(rateLimiter.getRemainingBlockTime(email) / 1000);
      return reply.code(429).send({
        error: "Too many attempts",
        retryAfter: remaining,
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create new user
      const name = email.split('@')[0];
      user = await prisma.user.create({
        data: { email, name, isActive: false },
      });
    }

    // Case 1: User needs TOTP setup
    if (!user.totpSecret) {
      const secret = generateTOTPSecret();
      const qrCode = await generateQRCode(secret, email);

      // If code provided, verify and save
      if (code) {
        const isValid = verifyTOTPCode(secret, code, isDevMode);

        if (!isValid) {
          if (!isDevMode) rateLimiter.check(email);
          return reply.code(401).send({ error: "Invalid code" });
        }

        // Save secret
        user = await prisma.user.update({
          where: { id: user.id },
          data: { totpSecret: secret },
        });

        // Reset rate limiter
        rateLimiter.reset(email);

        // Check activation
        if (!user.isActive && !isDevMode) {
          return reply.code(403).send({
            error: "Account pending activation",
            status: "pending",
          });
        }

        // Generate JWT
        const token = app.jwt.sign(
          { id: user.id, email: user.email },
          { expiresIn: "7d" }
        );

        reply.setCookie("token", token, {
          httpOnly: true,
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });

        return { user };
      }

      // Return QR for setup
      return { needsSetup: true, qrCode, secret };
    }

    // Case 2: User has TOTP, verify code
    if (!code) {
      return reply.code(400).send({ error: "Code required" });
    }

    const isValid = verifyTOTPCode(user.totpSecret, code, isDevMode);

    if (!isValid) {
      if (!isDevMode) rateLimiter.check(email);
      return reply.code(401).send({ error: "Invalid code" });
    }

    // Reset rate limiter
    rateLimiter.reset(email);

    // Check activation
    if (!user.isActive && !isDevMode) {
      return reply.code(403).send({
        error: "Account pending activation",
        status: "pending",
      });
    }

    // Generate JWT
    const token = app.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: "7d" }
    );

    reply.setCookie("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { user };
  });

  // Keep existing endpoints
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

  app.post("/logout", async (req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test src/routes/auth.test.ts`

Expected: PASS - all tests green

**Step 5: Test manually with dev static code**

Add to `.env`:
```
DEV_STATIC_CODE=000000
NODE_ENV=development
```

Run: `cd apps/api && pnpm dev`

Test with curl:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"000000"}'
```

Expected: Returns JWT and user

**Step 6: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/routes/auth.test.ts
git commit -m "feat(auth): implement TOTP login endpoint

- POST /api/auth/login with email + optional code
- Auto-create users with name from email
- QR code generation for first-time setup
- TOTP verification with rate limiting
- User activation check (isActive flag)
- Dev mode static code bypass
- Full integration test coverage"
```

---

## Task 5: Remove Old Authentication Code

**Files:**
- Modify: `apps/api/src/routes/auth.ts`

**Step 1: Remove dev-login endpoint**

Remove from `apps/api/src/routes/auth.ts`:
```typescript
// DELETE THIS:
const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

app.post("/dev-login", async (req, reply) => {
  // ... entire dev-login implementation
});
```

**Step 2: Remove GitHub OAuth endpoints**

Remove from `apps/api/src/routes/auth.ts`:
```typescript
// DELETE THIS:
app.get("/github", async (req, reply) => {
  // ... GitHub redirect
});

app.get("/github/callback", async (req, reply) => {
  // ... GitHub callback
});
```

**Step 3: Verify API still works**

Run: `cd apps/api && pnpm dev`

Test: `curl http://localhost:3001/api/auth/me`

Expected: 401 Unauthorized (correct, no token)

**Step 4: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "refactor(auth): remove dev-login and GitHub OAuth

- Remove POST /api/auth/dev-login endpoint
- Remove GET /api/auth/github endpoints
- Replaced by unified TOTP login"
```

---

## Task 6: Update Frontend LoginPage Component

**Files:**
- Modify: `apps/web/src/components/LoginPage.tsx`

**Step 1: Update LoginPage component**

Replace entire content of `apps/web/src/components/LoginPage.tsx`:

```typescript
import { useState } from "react";

interface Props {
  onLogin: (user: { id: string; name: string; email: string }) => void;
}

type LoginState =
  | { mode: "email-input" }
  | { mode: "totp-setup"; qrCode: string; secret: string }
  | { mode: "totp-verify" }
  | { mode: "pending-activation" }
  | { mode: "error"; message: string };

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<LoginState>({ mode: "email-input" });
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.needsSetup) {
          setState({
            mode: "totp-setup",
            qrCode: data.qrCode,
            secret: data.secret,
          });
        } else if (data.user) {
          onLogin(data.user);
        }
      } else if (res.status === 400 && data.error === "Code required") {
        setState({ mode: "totp-verify" });
      } else {
        setState({ mode: "error", message: data.error || "Login failed" });
        setTimeout(() => setState({ mode: "email-input" }), 3000);
      }
    } catch (error) {
      setState({ mode: "error", message: "Network error" });
      setTimeout(() => setState({ mode: "email-input" }), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        onLogin(data.user);
      } else if (res.status === 403 && data.status === "pending") {
        setState({ mode: "pending-activation" });
      } else {
        setState({ mode: "error", message: data.error || "Invalid code" });
        setTimeout(() => {
          if (state.mode === "totp-setup") {
            setState({ mode: "totp-setup", qrCode: (state as any).qrCode, secret: (state as any).secret });
          } else {
            setState({ mode: "totp-verify" });
          }
        }, 3000);
      }
    } catch (error) {
      setState({ mode: "error", message: "Network error" });
      setTimeout(() => setState({ mode: "totp-verify" }), 3000);
    } finally {
      setLoading(false);
      setCode("");
    }
  };

  const handleBack = () => {
    setEmail("");
    setCode("");
    setState({ mode: "email-input" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#2d3148] bg-[#1a1d2e]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">TechFlow</h1>
          <p className="text-slate-400">Architecture Diagrams & Data Flow</p>
        </div>

        {/* Email Input */}
        {state.mode === "email-input" && (
          <div className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            />
            <button
              onClick={handleContinue}
              disabled={loading || !email}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Continue"}
            </button>
          </div>
        )}

        {/* TOTP Setup */}
        {state.mode === "totp-setup" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white text-center">
              Setup Two-Factor Authentication
            </h2>
            <div className="bg-white p-4 rounded-lg">
              <img src={state.qrCode} alt="QR Code" className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">
              <p className="mb-2">Scan with Google Authenticator or Authy</p>
              <p className="font-mono text-xs break-all">{state.secret}</p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button
              onClick={handleBack}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              ← Back
            </button>
          </div>
        )}

        {/* TOTP Verify */}
        {state.mode === "totp-verify" && (
          <div className="space-y-3">
            <input
              value={email}
              disabled
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-slate-500"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <button
              onClick={handleBack}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              ← Change email
            </button>
          </div>
        )}

        {/* Pending Activation */}
        {state.mode === "pending-activation" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">⏳</div>
            <h2 className="text-xl font-semibold text-white">
              Account Pending Activation
            </h2>
            <p className="text-slate-400">
              Administrator will review your request
            </p>
            <button
              onClick={handleBack}
              className="w-full py-2.5 rounded-lg border border-[#2d3148] text-white hover:bg-[#2d3148] transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}

        {/* Error State */}
        {state.mode === "error" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <p className="text-red-400">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Test frontend locally**

Run: `cd apps/web && pnpm dev`

Open: `http://localhost:5173`

Test flow:
1. Enter email → see QR code
2. Scan with authenticator app
3. Enter code → see pending activation

**Step 3: Commit**

```bash
git add apps/web/src/components/LoginPage.tsx
git commit -m "feat(auth): update LoginPage for TOTP authentication

- Remove name field from login
- Add inline TOTP setup with QR code
- Add TOTP verification state
- Add pending activation screen
- Add error handling with auto-dismiss
- Support dev static code bypass"
```

---

## Task 7: Update Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`

**Step 1: Update .env.example**

Add to `.env.example`:
```bash
# Development
NODE_ENV=development
DEV_STATIC_CODE=000000

# Database
POSTGRES_USER=techflow
POSTGRES_PASSWORD=techflow_secret
POSTGRES_DB=techflow

# API
JWT_SECRET=dev-secret-change-in-production
FRONTEND_URL=http://localhost:5173
PORT=3001
```

**Step 2: Update .env.production.example**

Update `.env.production.example`:
```bash
# Production
NODE_ENV=production

# Database
POSTGRES_USER=techflow
POSTGRES_PASSWORD=change_this_in_production
POSTGRES_DB=techflow

# API
JWT_SECRET=change_this_to_random_secret_in_production
FRONTEND_URL=https://draw.g3ra.ru
PORT=3001

# Note: DEV_STATIC_CODE not needed in production
# Note: No GitHub OAuth credentials needed anymore
```

**Step 3: Update server .env**

On server, update `.env`:
```bash
NODE_ENV=production
JWT_SECRET=<existing-secret>
FRONTEND_URL=https://draw.g3ra.ru
POSTGRES_USER=techflow
POSTGRES_PASSWORD=techflow_secret
POSTGRES_DB=techflow
```

**Step 4: Commit**

```bash
git add .env.example .env.production.example
git commit -m "docs: update environment variables for TOTP auth

- Add DEV_STATIC_CODE for development bypass
- Remove GitHub OAuth credentials
- Update documentation"
```

---

## Task 8: Deploy and Test on Production

**Files:**
- None (deployment only)

**Step 1: Push all changes**

Run: `git push origin master`

Expected: All commits pushed to remote

**Step 2: Pull on server**

On server:
```bash
cd ~/Documents/projects/draw
git pull
```

**Step 3: Rebuild and restart**

On server:
```bash
docker compose down
docker compose build --no-cache api web
docker compose up -d
```

**Step 4: Check logs**

On server:
```bash
docker compose logs -f api
```

Expected: API starts without errors

**Step 5: Test production login**

Open: `https://draw.g3ra.ru`

Test:
1. Enter email → see QR code
2. Scan with Google Authenticator
3. Enter code → see "Pending activation"

**Step 6: Activate test user**

On server:
```bash
docker compose exec postgres psql -U techflow -d techflow -c "UPDATE users SET is_active = true WHERE email = 'your-test-email@example.com';"
```

**Step 7: Test activated user login**

1. Enter email + TOTP code
2. Should redirect to dashboard

**Step 8: Test dev mode (locally)**

Locally with `.env`:
```bash
NODE_ENV=development
DEV_STATIC_CODE=000000
```

Test:
1. Enter any email + code "000000"
2. Should login successfully (bypass TOTP + activation)

**Step 9: Document completion**

Create completion note in plan:
```markdown
## Deployment Complete ✅

- Database migrated with totpSecret and isActive fields
- TOTP utilities implemented and tested
- Rate limiter working (5 attempts, 15 min block)
- New /api/auth/login endpoint deployed
- Old auth endpoints removed
- Frontend updated with inline TOTP setup
- Production tested with real authenticator apps
- Dev mode bypass working locally

**Admin commands:**
```sql
-- Activate user
UPDATE users SET is_active = true WHERE email = 'user@example.com';

-- Reset TOTP (lost authenticator)
UPDATE users SET totp_secret = NULL WHERE email = 'user@example.com';

-- List pending users
SELECT id, email, name, created_at FROM users WHERE is_active = false;
```
```

---

## Summary

**Total Tasks:** 8
**Estimated Time:** 4-6 hours
**Test Coverage:** Unit tests, integration tests, E2E manual testing

**Key Files Modified:**
- `apps/api/prisma/schema.prisma` - Added TOTP fields
- `apps/api/src/lib/totp.ts` - TOTP utilities
- `apps/api/src/lib/rate-limiter.ts` - Rate limiting
- `apps/api/src/routes/auth.ts` - New login endpoint
- `apps/web/src/components/LoginPage.tsx` - TOTP UI

**Dependencies Added:**
- `otplib` - TOTP generation/verification
- `qrcode` - QR code generation

**Breaking Changes:**
- Dev Login removed (use dev static code instead)
- GitHub OAuth removed
- Name field removed from login (auto-generated from email)

**Migration Notes:**
- Existing users: `isActive = true` by default
- New users: `isActive = false`, require admin activation
- Lost authenticator: Admin resets `totpSecret = NULL`

---

## Execution Options

Plan complete and saved to `docs/plans/2026-03-01-totp-authentication-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
