import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

const TOTP_ISSUER = 'TechFlow';

/**
 * Generate a new TOTP secret (base32 encoded)
 */
export function generateTOTPSecret(): string {
  return generateSecret();
}

/**
 * Generate QR code data URL for TOTP setup
 * @param secret - TOTP secret (base32)
 * @param email - User email for authenticator app label
 */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const otpauth = generateURI({
    issuer: TOTP_ISSUER,
    label: email,
    secret,
  });
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
    const result = verifySync({
      secret,
      token: code,
    });
    return result.valid;
  } catch {
    return false;
  }
}
