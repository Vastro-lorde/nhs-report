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
  SMTP_SECURE: () => getEnvVar("SMTP_SECURE", "false").toLowerCase() === "true",
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

  // AI (Gemini)
  GEMINI_API_KEY: () => getEnvVar("GEMINI_API_KEY", ""),

  // Google (Meet integration) — parsed from the GOOGLESECRETS JSON string
  GOOGLE_CREDENTIALS: () => {
    const raw = process.env.GOOGLESECRETS;
    if (!raw) {
      throw new Error("Missing environment variable: GOOGLESECRETS");
    }
    let parsed: { web?: { client_id?: string; client_secret?: string; token_uri?: string; auth_uri?: string } };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("GOOGLESECRETS is not valid JSON");
    }
    const web = parsed.web ?? {};
    if (!web.client_id || !web.client_secret) {
      throw new Error("GOOGLESECRETS is missing web.client_id or web.client_secret");
    }
    return {
      clientId: web.client_id,
      clientSecret: web.client_secret,
      tokenUri: web.token_uri ?? "https://oauth2.googleapis.com/token",
      authUri: web.auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
    };
  },
  /** OAuth redirect URI for the Google Meet integration (derived from the app URL). */
  GOOGLE_REDIRECT_URI: () =>
    `${getEnvVar("NEXTAUTH_URL", "http://localhost:3000").replace(/\/$/, "")}/api/integrations/google/callback`,
  /** Whether the Google Meet integration is configured. */
  GOOGLE_ENABLED: () => Boolean(process.env.GOOGLESECRETS),
} as const;
