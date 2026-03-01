-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;

-- Set existing users to active by default
UPDATE users SET is_active = true WHERE totp_secret IS NULL;
