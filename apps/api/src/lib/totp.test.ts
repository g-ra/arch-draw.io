import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { generateSync } from 'otplib';
import { generateTOTPSecret, generateQRCode, verifyTOTPCode } from './totp';

describe('TOTP Utilities', () => {
  let secret: string;

  beforeEach(() => {
    secret = generateTOTPSecret();
  });

  afterEach(() => {
    delete process.env.DEV_STATIC_CODE;
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
    const validCode = generateSync({
      type: 'totp',
      secret,
    });

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
