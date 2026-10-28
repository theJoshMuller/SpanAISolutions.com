import type { Answers } from "./config";
export interface SubmissionPayload {
  submissionId: string;
  startedAt: string;
  answers: Answers;
  contact: {
    firstName: string;
    email: string;
    organization: string | null;
    phone: string | null;
  };
  attribution: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    landingPath: string;
  };
  website: string;
}
async function post(
  path: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
export async function submitQuiz(
  p: SubmissionPayload,
): Promise<{ ok: true; optinToken: string } | { ok: false }> {
  const result = await post("/api/quiz", p);
  return result?.ok === true && typeof result.optinToken === "string"
    ? { ok: true, optinToken: result.optinToken }
    : { ok: false };
}
export interface OptInPayload {
  submissionId: string;
  email: string;
  token: string;
}
export type OptInResult = "success" | "invalid" | "network-error";
export async function optInStatus(body: OptInPayload): Promise<OptInResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/optin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status >= 500) return "network-error";
    if (!response.ok) return "invalid";
    return (await response.json())?.ok === true ? "success" : "invalid";
  } catch {
    return "network-error";
  } finally {
    clearTimeout(timeout);
  }
}
export async function optIn(body: OptInPayload): Promise<boolean> {
  return (await optInStatus(body)) === "success";
}
