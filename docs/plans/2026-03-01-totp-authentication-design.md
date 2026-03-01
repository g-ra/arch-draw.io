# TOTP Authentication Design

**Date:** 2026-03-01
**Status:** Approved
**Approach:** Inline TOTP setup (Approach B)

## Overview

Replace existing authentication (Dev Login, GitHub OAuth) with TOTP-based authentication using authenticator apps (Google Authenticator, Authy, etc.).

### Key Requirements

- Email-only login (no password, no name field)
- TOTP codes from authenticator apps
- First-time users: inline QR code setup on login page
- User moderation: new accounts require admin activation
- Dev mode: static code bypass for development
- Auto-generate username from email

### User Flow Summary

1. **New user:** Enter email → See QR code → Scan with authenticator → Enter code → "Pending activation"
2. **Existing inactive user:** Enter email + code → "Pending activation"
3. **Active user:** Enter email + code → Dashboard
4. **Dev mode:** Enter email + static code → Dashboard (bypass TOTP + activation)

---

## Database Schema

### User Model Changes

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String    // Auto-generated from email: email.split('@')[0]
  avatar        String?

  // TOTP Authentication
  totpSecret    String?   @map("totp_secret")  // null = needs setup, value = configured

  // User Moderation
  isActive      Boolean   @default(false) @map("is_active")

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relations (unchanged)
  ownedTeams       Team[]
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

### Field Logic

- `totpSecret === null` → Show QR code for setup
- `totpSecret !== null` → Verify TOTP code
- `isActive === false` → Show "Pending activation" message
- `isActive === true` → Grant access to application

### Migration Strategy

1. Add new fields: `totpSecret`, `isActive`
2. Remove fields: `oauthProvider`, `oauthId` (or keep for compatibility)
3. Existing users: set `isActive = true`, `totpSecret = null`
4. New users: default `isActive = false`, `totpSecret = null`

---

## API Endpoints

### New Endpoint: POST /api/auth/login

Replaces `/api/auth/dev-login` with unified TOTP login.

**Request:**
```typescript
{
  email: string,
  code?: string  // 6-digit TOTP code (optional on first request)
}
```

**Response Types:**

```typescript
// Setup Required (new user or totpSecret=null)
{
  needsSetup: true,
  qrCode: string,      // data:image/png;base64,...
  secret: string       // Base32 secret for manual entry
}

// Login Success
{
  user: User,
  token: string  // JWT
}

// Pending Activation
{
  error: "Account pending activation",
  status: "pending"
}

// Invalid Code
{
  error: "Invalid code"
}

// Rate Limited
{
  error: "Too many attempts",
  retryAfter: number  // seconds
}
```

**Logic Flow:**

1. **Find user by email**
   - If not exists: Create user with `{ email, name: email.split('@')[0], isActive: false, totpSecret: null }`

2. **Check totpSecret**
   - If `null`: Generate TOTP secret, create QR code, return setup response
   - If exists: Proceed to verification

3. **Verify TOTP code**
   - Dev mode check: `NODE_ENV=development && code === DEV_STATIC_CODE` → Skip verification
   - Validate code format: exactly 6 digits
   - Verify against totpSecret with ±1 time window (30 sec)
   - Check rate limiting

4. **Check activation status**
   - If `isActive === false`: Return pending activation error
   - If `isActive === true`: Generate JWT, return success

5. **Setup completion** (when code provided during setup)
   - Verify code against generated secret
   - Save totpSecret to database
   - Return JWT + user

### Removed Endpoints

- `POST /api/auth/dev-login` - Deleted
- `GET /api/auth/github` - Deleted
- `GET /api/auth/github/callback` - Deleted

### Unchanged Endpoints

- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Clear auth cookie

---

## Authentication Flow

### Scenario A: New User (First Login)

1. User enters email → clicks "Continue"
2. Backend creates user: `{ email, name: email.split('@')[0], isActive: false, totpSecret: null }`
3. Backend generates TOTP secret and QR code
4. Frontend displays:
   - QR code (large, centered)
   - Text secret (for manual entry)
   - Input field for 6-digit code
   - Instructions: "Scan with Google Authenticator or Authy"
5. User scans QR code in authenticator app
6. User enters code from app → clicks "Verify & Login"
7. Backend verifies code, saves `totpSecret` to database
8. Backend returns JWT + user data
9. Frontend shows: "Account pending activation by administrator"

### Scenario B: Existing Inactive User

1. User enters email + TOTP code → clicks "Login"
2. Backend verifies code against saved `totpSecret`
3. Backend checks `isActive === false`
4. Backend returns: `{ error: "Account pending activation" }`
5. Frontend displays: "Your account is pending activation by administrator"

### Scenario C: Active User

1. User enters email + TOTP code → clicks "Login"
2. Backend verifies code
3. Backend checks `isActive === true`
4. Backend returns JWT + user data
5. Frontend redirects to `/dashboard`

### Scenario D: Development Mode

1. User enters email + static code (e.g., "000000")
2. Backend checks: `NODE_ENV === 'development' && code === process.env.DEV_STATIC_CODE`
3. Backend bypasses TOTP verification and `isActive` check
4. Backend returns JWT + user data
5. Frontend redirects to `/dashboard`

**Environment Variable:**
```bash
DEV_STATIC_CODE=000000  # Any 6-digit code for dev bypass
```

---

## UI States

### LoginPage Component States

```typescript
type LoginState =
  | { mode: 'email-input' }
  | { mode: 'totp-setup', qrCode: string, secret: string }
  | { mode: 'totp-verify' }
  | { mode: 'pending-activation' }
  | { mode: 'error', message: string }
```

### Visual States

#### 1. email-input (Initial State)
- **Fields:** Email input
- **Button:** "Continue"
- **Action:** Submit email → transition to setup or verify

#### 2. totp-setup (New User Setup)
- **Header:** "Setup Two-Factor Authentication"
- **QR Code:** Large, centered image
- **Secret Text:** Base32 string (for manual entry)
- **Instructions:** "Scan with Google Authenticator or Authy"
- **Fields:** 6-digit code input
- **Button:** "Verify & Login"
- **Link:** "← Back" (return to email input)

#### 3. totp-verify (Existing User Login)
- **Fields:**
  - Email (pre-filled, disabled)
  - 6-digit code input
- **Button:** "Login"
- **Link:** "← Change email"

#### 4. pending-activation (Awaiting Admin)
- **Icon:** ⏳
- **Message:** "Your account is pending activation"
- **Submessage:** "Administrator will review your request"
- **Button:** "← Back to login"

#### 5. error (Error State)
- **Toast notification** (3 seconds, auto-dismiss)
- **Red border** on input field with error
- **Attempt counter:** "2 attempts remaining" (if rate limited)

### State Transitions

```
email-input
  → (submit) → totp-setup (if totpSecret=null)
  → (submit) → totp-verify (if totpSecret exists)

totp-setup
  → (verify success + isActive=false) → pending-activation
  → (verify success + isActive=true) → dashboard

totp-verify
  → (login success + isActive=false) → pending-activation
  → (login success + isActive=true) → dashboard
  → (invalid code) → error → totp-verify

Any state → (error) → error (3s timeout) → previous state
```

---

## Error Handling & Security

### Rate Limiting

**Rules:**
- Maximum 5 failed attempts per email within 15 minutes
- After 5 failures: block for 15 minutes
- Counter resets on successful login
- Dev mode: rate limiting disabled

**Implementation:**
- In-memory Map: `{ email: { attempts: number, blockedUntil: Date } }`
- Alternative: Redis for distributed systems

**Response:**
```json
{
  "error": "Too many attempts",
  "retryAfter": 900
}
```

### TOTP Validation

**Format:**
- Exactly 6 digits
- Numeric only

**Time Window:**
- Current time ±1 period (30 seconds before/after)
- Prevents clock drift issues

**Dev Bypass:**
```typescript
if (process.env.NODE_ENV === 'development' && code === process.env.DEV_STATIC_CODE) {
  return true;  // Skip TOTP verification
}
```

### Error Messages

| Error | HTTP Status | Message |
|-------|-------------|---------|
| Invalid code | 401 | "Invalid code" |
| Rate limited | 429 | "Too many attempts" |
| Pending activation | 403 | "Account pending activation" |
| Invalid email | 400 | "Invalid email format" |
| Server error | 500 | "Server error" |

### Edge Cases

#### 1. Lost Authenticator Access
**Problem:** User loses phone/authenticator app
**Solution (Current):** Admin manually resets: `UPDATE users SET totp_secret = NULL WHERE email = '...'`
**Future:** Implement recovery codes (10 one-time backup codes)

#### 2. Concurrent Registration
**Problem:** Two requests with same email
**Solution:** Database unique constraint on email prevents duplicates

#### 3. Dev Mode on Production
**Problem:** Accidentally using static code on production
**Solution:** Static code only works when `NODE_ENV === 'development'`

#### 4. Interrupted Setup
**Problem:** User closes browser during QR scan
**Solution:**
- If `totpSecret` already generated: show same QR on next login
- If `totpSecret = null`: generate new secret

---

## Testing Strategy

### Unit Tests (Backend)

**TOTP Utilities:**
```typescript
describe('TOTP Utils', () => {
  test('generateTOTPSecret() returns valid base32 string')
  test('generateQRCode() creates valid data URL')
  test('verifyTOTPCode() accepts valid code within time window')
  test('verifyTOTPCode() rejects expired code')
  test('verifyTOTPCode() accepts dev static code in dev mode')
  test('verifyTOTPCode() rejects dev static code in production')
})
```

**Rate Limiter:**
```typescript
describe('RateLimiter', () => {
  test('allows 5 attempts before blocking')
  test('blocks after 5 failed attempts')
  test('resets counter after successful login')
  test('unblocks after 15 minutes')
  test('disabled in dev mode')
})
```

### Integration Tests (API)

```typescript
describe('POST /api/auth/login', () => {
  test('new email creates user and returns QR code')
  test('existing email without totpSecret returns QR code')
  test('existing email with totpSecret + valid code returns JWT')
  test('existing email with totpSecret + invalid code returns error')
  test('isActive=false returns pending activation error')
  test('dev mode + static code bypasses TOTP and activation')
  test('rate limiting blocks after 5 attempts')
  test('rate limiting resets after success')
})
```

### E2E Tests (Frontend)

```typescript
describe('Login Flow', () => {
  test('new user: email → QR → code → pending activation')
  test('active user: email + code → dashboard')
  test('inactive user: email + code → pending message')
  test('invalid code shows error toast')
  test('5 invalid attempts shows rate limit message')
  test('dev mode: static code → dashboard')
})
```

### Manual Testing Checklist

- [ ] Scan QR in Google Authenticator → code works
- [ ] Scan QR in Authy → code works
- [ ] Enter secret manually → code works
- [ ] Code valid ±30 seconds (time sync test)
- [ ] Dev mode with static code → successful login
- [ ] isActive=false → shows pending message
- [ ] Admin sets isActive=true in DB → login works
- [ ] Close browser during setup → QR persists on return
- [ ] Rate limiting: 5 failures → 15 min block
- [ ] Rate limiting: success → counter resets

---

## Implementation Notes

### Dependencies

**Backend:**
- `otplib` - TOTP generation and verification
- `qrcode` - QR code generation

**Frontend:**
- No new dependencies (use existing UI components)

### Environment Variables

```bash
# .env
DEV_STATIC_CODE=000000  # Static code for dev bypass
NODE_ENV=development    # Enable dev mode features
```

### Admin Tools

**Activate User:**
```sql
UPDATE users SET is_active = true WHERE email = 'user@example.com';
```

**Reset TOTP (Lost Authenticator):**
```sql
UPDATE users SET totp_secret = NULL WHERE email = 'user@example.com';
```

**List Pending Users:**
```sql
SELECT id, email, name, created_at
FROM users
WHERE is_active = false
ORDER BY created_at DESC;
```

---

## Future Enhancements

1. **Recovery Codes:** Generate 10 one-time backup codes during setup
2. **Admin Dashboard:** UI for activating/deactivating users
3. **Email Notifications:** Notify users when account is activated
4. **Audit Log:** Track login attempts and admin actions
5. **Session Management:** View/revoke active sessions
6. **2FA Settings:** Allow users to regenerate TOTP secret

---

## Migration Plan

### Phase 1: Database Migration
1. Add `totpSecret`, `isActive` columns
2. Set existing users: `isActive = true`
3. Remove `oauthProvider`, `oauthId` columns

### Phase 2: Backend Implementation
1. Install dependencies: `otplib`, `qrcode`
2. Implement TOTP utilities
3. Implement rate limiter
4. Update `/api/auth/login` endpoint
5. Remove old auth endpoints

### Phase 3: Frontend Implementation
1. Update LoginPage component with state machine
2. Add QR code display
3. Add TOTP code input
4. Add pending activation screen
5. Update error handling

### Phase 4: Testing & Deployment
1. Run unit tests
2. Run integration tests
3. Manual testing with real authenticator apps
4. Deploy to staging
5. Test with real users
6. Deploy to production

### Phase 5: Cleanup
1. Remove old auth code
2. Update documentation
3. Notify users about new login flow
