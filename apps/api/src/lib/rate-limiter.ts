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

    // Reset if block expired - delete to prevent memory leak
    if (entry.blockedUntil && entry.blockedUntil <= now) {
      this.store.delete(email);
      this.store.set(email, { attempts: 1, blockedUntil: null });
      return true;
    }

    // Increment attempts
    entry.attempts++;

    // Block if exceeded (> not >= so maxAttempts=5 allows 5 attempts)
    if (entry.attempts > this.maxAttempts) {
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
    const isStillBlocked = entry.blockedUntil > now;

    // Clean up expired entries to prevent memory leak
    if (!isStillBlocked) {
      this.store.delete(email);
    }

    return isStillBlocked;
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
