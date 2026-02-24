/* ──────────────────────────────────────────
   Single source of truth: Environment config
   ────────────────────────────────────────── */

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  // MongoDB
  MONGODB_URI: () => getEnvVar("MONGODB_URI"),

  // NextAuth
  NEXTAUTH_URL: () => getEnvVar("NEXTAUTH_URL", "http://localhost:3000"),
  NEXTAUTH_SECRET: () => getEnvVar("NEXTAUTH_SECRET"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: () => getEnvVar("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: () => getEnvVar("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: () => getEnvVar("CLOUDINARY_API_SECRET"),
  CLOUDINARY_UPLOAD_FOLDER: () => getEnvVar("CLOUDINARY_UPLOAD_FOLDER", "nhs-mentor-report"),

  // SMTP / Nodemailer
  SMTP_HOST: () => getEnvVar("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: () => Number(getEnvVar("SMTP_PORT", "587")),
  SMTP_USER: () => getEnvVar("SMTP_USER"),
  SMTP_PASS: () => getEnvVar("SMTP_PASS"),
  SMTP_FROM: () => getEnvVar("SMTP_FROM", "NHS Mentor Reporting <noreply@example.com>"),

  // Cron
  CRON_SECRET: () => getEnvVar("CRON_SECRET"),

  // App
  APP_NAME: () => getEnvVar("NEXT_PUBLIC_APP_NAME", "NHS Mentor Reporting"),
  DIGEST_RECIPIENT_EMAILS: () =>
    getEnvVar("DIGEST_RECIPIENT_EMAILS", "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  TIMEZONE: () => getEnvVar("TIMEZONE", "Africa/Lagos"),
} as const;
