import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { authRoutes } from './auth';
import { prisma } from '../lib/prisma';
import { generateSync } from 'otplib';
import { generateTOTPSecret } from '../lib/totp';
import { rateLimiter } from '../lib/rate-limiter';

describe('POST /api/auth/login', () => {
  let app: FastifyInstance;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    // Create test Fastify instance
    app = Fastify();

    await app.register(cookie);
    await app.register(jwt, {
      secret: process.env.JWT_SECRET || 'test-secret',
      cookie: { cookieName: 'token', signed: false },
    });
    await app.register(authRoutes, { prefix: '/api/auth' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'newuser@example.com',
            'existing@example.com',
            'inactive@example.com',
            'invalidcode@example.com',
            'ratelimit@example.com',
          ],
        },
      },
    });

    // Reset rate limiter for test emails
    rateLimiter.reset('invalidcode@example.com');
    rateLimiter.reset('ratelimit@example.com');
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  test('new email creates user and returns QR code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'newuser@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('qrCode');
    expect(body.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(body).toHaveProperty('message', 'Scan QR code with authenticator app');

    // Verify user was created
    const user = await prisma.user.findUnique({
      where: { email: 'newuser@example.com' },
    });
    expect(user).toBeTruthy();
    expect(user?.name).toBe('newuser');
    expect(user?.totpSecret).toBeNull();
    expect(user?.isActive).toBe(false);
  });

  test('existing user with totpSecret requires code', async () => {
    // Create user with TOTP secret
    const secret = generateTOTPSecret();
    await prisma.user.create({
      data: {
        email: 'existing@example.com',
        name: 'existing',
        totpSecret: secret,
        isActive: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'existing@example.com',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error', 'TOTP code required');
  });

  test('valid TOTP code returns JWT', async () => {
    const secret = generateTOTPSecret();

    // Create user with TOTP secret
    await prisma.user.create({
      data: {
        email: 'existing@example.com',
        name: 'existing',
        totpSecret: secret,
        isActive: true,
      },
    });

    // Generate valid TOTP code
    const validCode = generateSync({ secret });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'existing@example.com',
        code: validCode,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe('existing@example.com');

    // Verify JWT cookie was set
    const cookies = response.cookies;
    const tokenCookie = cookies.find(c => c.name === 'token');
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie?.value).toBeTruthy();
  });

  test('inactive user returns pending activation error', async () => {
    const secret = generateTOTPSecret();

    // Set production mode to enable activation check
    process.env.NODE_ENV = 'production';

    // Create inactive user with TOTP secret
    await prisma.user.create({
      data: {
        email: 'inactive@example.com',
        name: 'inactive',
        totpSecret: secret,
        isActive: false,
      },
    });

    // Generate valid TOTP code
    const validCode = generateSync({ secret });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'inactive@example.com',
        code: validCode,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error', 'Account pending activation');
  });

  test('invalid TOTP code returns 401', async () => {
    const secret = generateTOTPSecret();

    // Create user with TOTP secret
    await prisma.user.create({
      data: {
        email: 'invalidcode@example.com',
        name: 'invalidcode',
        totpSecret: secret,
        isActive: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'invalidcode@example.com',
        code: '999999', // Invalid code (not the dev static code)
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error', 'Invalid TOTP code');
  });

  test('rate limiting blocks after 5 attempts', async () => {
    const secret = generateTOTPSecret();

    // Set production mode to enable rate limiting
    process.env.NODE_ENV = 'production';

    // Create user with TOTP secret
    await prisma.user.create({
      data: {
        email: 'ratelimit@example.com',
        name: 'ratelimit',
        totpSecret: secret,
        isActive: true,
      },
    });

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'ratelimit@example.com',
          code: '000000', // Invalid code
        },
      });
    }

    // 6th attempt should be blocked with 429
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'ratelimit@example.com',
        code: '000000',
      },
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error', 'Too many attempts');
    expect(body).toHaveProperty('retryAfter');
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
