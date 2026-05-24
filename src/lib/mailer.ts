type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

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

export function hasEmailConfig() {
  return getMissingEmailConfig().length === 0;
}

export function getMissingEmailConfig() {
  return ["RESEND_API_KEY", "EMAIL_FROM", "DIGEST_TO_EMAIL"].filter(
    (name) => !process.env[name],
  );
}

export async function sendEmail(payload: EmailPayload) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as ResendEmailResponse;

  if (!response.ok) {
    throw new Error(
      body.message || `Resend email request failed with ${response.status}.`,
    );
  }

  return body;
}
