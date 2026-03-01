/* ──────────────────────────────────────────
   Single source of truth: Environment config
   ────────────────────────────────────────── */
import { APP_NAME } from "./constants";

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  // Database
  MONGODB_URI: () => getEnvVar("MONGODB_URI"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: () => getEnvVar("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: () => getEnvVar("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: () => getEnvVar("CLOUDINARY_API_SECRET"),
  CLOUDINARY_UPLOAD_FOLDER: () =>
    getEnvVar("CLOUDINARY_UPLOAD_FOLDER", "nhs-mentor-report"),

  // Auth
  NEXTAUTH_URL: () => getEnvVar("NEXTAUTH_URL", "http://localhost:3000"),
  NEXTAUTH_SECRET: () => getEnvVar("NEXTAUTH_SECRET"),

  // Email (SMTP)
  SMTP_HOST: () => getEnvVar("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: () => Number(getEnvVar("SMTP_PORT", "587")),
  SMTP_USER: () => getEnvVar("SMTP_USER"),
  SMTP_PASS: () => getEnvVar("SMTP_PASS"),
  SMTP_FROM: () => getEnvVar("SMTP_FROM", `${APP_NAME} <noreply@example.com>`),
  SMTP_REPLY_TO: () => getEnvVar("SMTP_REPLY_TO", "support@example.com"),
  RESEND_API_KEY: () => process.env.RESEND_API_KEY, // Optional since we use SMTP

  // Cron
  CRON_SECRET: () => getEnvVar("CRON_SECRET"),

  // App
  APP_NAME: () => getEnvVar("NEXT_PUBLIC_APP_NAME", APP_NAME),
  DIGEST_RECIPIENT_EMAILS: () =>
    getEnvVar("DIGEST_RECIPIENT_EMAILS", "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  TIMEZONE: () => getEnvVar("TIMEZONE", "Africa/Lagos"),
} as const;
