import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function readBoolean(value: string | undefined) {
  return value === "true" || value === "1";
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing email environment variable: ${name}`);
  }

  return value;
}

export function getEmailRecipient() {
  return requiredEnv("DIGEST_TO_EMAIL");
}

export function hasSmtpConfig() {
  return getMissingSmtpConfig().length === 0;
}

export function getMissingSmtpConfig() {
  return [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "EMAIL_FROM",
    "DIGEST_TO_EMAIL",
  ].filter((name) => !process.env[name]);
}

export async function sendEmail(payload: EmailPayload) {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const secure = readBoolean(process.env.SMTP_SECURE);
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASSWORD");
  const from = requiredEnv("EMAIL_FROM");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}
