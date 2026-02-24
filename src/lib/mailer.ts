/* ──────────────────────────────────────────
   Nodemailer transporter (singleton)
   ────────────────────────────────────────── */
import nodemailer, { Transporter } from "nodemailer";
import { env } from "@/lib/env";

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST(),
      port: env.SMTP_PORT(),
      secure: env.SMTP_PORT() === 465,
      auth: {
        user: env.SMTP_USER(),
        pass: env.SMTP_PASS(),
      },
    });
  }
  return transporter;
}

interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: SendMailOptions) {
  const t = getTransporter();
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  return t.sendMail({
    from: env.SMTP_FROM(),
    to: recipients,
    subject,
    text,
    html,
  });
}
