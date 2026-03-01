import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts, 15 min
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('allows attempts under limit', () => {
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
  });

  test('blocks after max attempts', () => {
    // First 5 attempts should succeed
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);
    expect(limiter.check('test@example.com')).toBe(true);

    // 6th attempt should fail and block
    expect(limiter.check('test@example.com')).toBe(false);
    expect(limiter.isBlocked('test@example.com')).toBe(true);
  });

  test('boundary: 5th attempt succeeds, 6th blocks', () => {
    // Attempts 1-5 should all succeed
    for (let i = 1; i <= 5; i++) {
      expect(limiter.check('test@example.com')).toBe(true);
      expect(limiter.getAttempts('test@example.com')).toBe(i);
    }

    // Not blocked yet
    expect(limiter.isBlocked('test@example.com')).toBe(false);

    // 6th attempt should block
    expect(limiter.check('test@example.com')).toBe(false);
    expect(limiter.isBlocked('test@example.com')).toBe(true);
    expect(limiter.getAttempts('test@example.com')).toBe(6);
  });

  test('resets counter after success', () => {
    limiter.check('test@example.com');
    limiter.check('test@example.com');
    limiter.reset('test@example.com');

    expect(limiter.getAttempts('test@example.com')).toBe(0);
  });

  test('unblocks after timeout', () => {
    // First 5 attempts succeed, 6th blocks
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('test@example.com')).toBe(true);
    }
    expect(limiter.check('test@example.com')).toBe(false);
    expect(limiter.isBlocked('test@example.com')).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1000); // 15 min + 1 sec

    expect(limiter.isBlocked('test@example.com')).toBe(false);
  });

  test('returns remaining time when blocked', () => {
    // First 5 attempts succeed, 6th blocks
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('test@example.com')).toBe(true);
    }
    expect(limiter.check('test@example.com')).toBe(false);

    const remaining = limiter.getRemainingBlockTime('test@example.com');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
