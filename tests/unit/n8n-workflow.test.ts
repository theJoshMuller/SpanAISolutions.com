import { describe, it, expect } from "vitest";
// @ts-ignore import-free runtime helpers
import {
  noteClaimPayload,
  verifyClaim,
  personPatch,
  richText,
  taskPayload,
  routeRecipient,
  researchMarkdown,
} from "../../n8n/src/workflow.js";
const env = {
  submissionId: "12345678-1234-4234-8234-123456789012",
  receivedAt: "2026-10-27T12:00:00.000Z",
  test: true,
  answers: { A1: "owner", C1: "<script>reports", C4: "more time", D2: "hello" },
  contact: { firstName: "Jane", email: "jane@acme.org", organization: "Acme" },
  result: { segment: "discovery", aiLevel: 60, dollarsPerYear: 12300 },
};
describe("quiz workflow guarantees", () => {
  it("claims the existing unique Note UUID before allowing an alert, fails closed on conflicts or malformed success", () => {
    expect(
      noteClaimPayload(env, { title: "title", markdown: "body" }).variables.data
        .id,
    ).toBe(env.submissionId);
    expect(
      verifyClaim(
        { data: { createNote: { id: env.submissionId } } },
        env.submissionId,
      ),
    ).toBe(true);
    expect(
      verifyClaim({ errors: [{ message: "duplicate key" }] }, env.submissionId),
    ).toBe(false);
    expect(
      verifyClaim({ data: { createNote: { id: "other" } } }, env.submissionId),
    ).toBe(false);
  });
  it("never resets existing lead status and maps enum/currency/role", () => {
    expect(personPatch(env, false)).not.toHaveProperty("leadStatus");
    expect(personPatch(env, true)).toMatchObject({
      leadStatus: "NEW",
      segment: "DISCOVERY",
      leadSource: "QUIZ",
      jobTitle: "Owner / founder",
      estAnnualValue: { amountMicros: 12300000000, currencyCode: "CAD" },
    });
  });
  it("builds UI-visible note bodies and due tasks with escaped free text", () => {
    expect(richText("a\nb").markdown).toBe("a\nb");
    expect(JSON.parse(richText("a\nb").blocknote)).toHaveLength(2);
    const task = taskPayload(env, "kami");
    expect(task.dueAt).toBe("2026-10-27T13:00:00.000Z");
    expect(task.bodyV2.markdown).not.toContain("<script>");
  });
  it("routes every test message to Josh, and limits safe research to five bullets", () => {
    expect(routeRecipient(env, "jane@acme.org")).toBe(
      "josh@spanaisolutions.com",
    );
    expect(routeRecipient({ ...env, test: false }, "jane@acme.org")).toBe(
      "jane@acme.org",
    );
    const text = researchMarkdown({
      results: Array.from({ length: 8 }, () => ({
        title: "<script>",
        content: '"hello"',
        url: "javascript:alert(1)",
      })),
    });
    expect(text.match(/^- /gm)).toHaveLength(5);
    expect(text).not.toContain("<script>");
    expect(text).not.toContain("javascript:");
  });
});

describe("atomic dedupe under overlapping deliveries", () => {
  it("allows one Note and one alert across overlap and later replay", async () => {
    const notes = new Map();
    let alerts = 0;
    async function receive() {
      const payload = noteClaimPayload(env, {
        title: env.submissionId,
        markdown: "body",
      });
      await Promise.resolve();
      const id = payload.variables.data.id;
      const response = notes.has(id)
        ? { errors: [{ message: "duplicate key" }] }
        : (notes.set(id, payload.variables.data),
          { data: { createNote: { id } } });
      if (verifyClaim(response, id)) alerts++;
    }
    await Promise.all(Array.from({ length: 25 }, receive));
    await receive();
    expect(notes.size).toBe(1);
    expect(alerts).toBe(1);
  });
});

// Execute the deployed opt-in planner and then the intake planner, preserving CRM progress.
it.each([undefined, "QUALIFIED"])(
  "opt-in before intake gives new contacts NEW and preserves %s",
  async (status) => {
    // @ts-ignore Node runtime
    const { readFile } = await import("node:fs/promises");
    // @ts-ignore deployment module
    const { resolveWorkflow } = await import("../../scripts/n8n_deploy.mjs");
    const w = await resolveWorkflow(
      JSON.parse(await readFile("n8n/span-quiz-optin.json", "utf8")),
    );
    const code = w.nodes.find((n: any) => n.name === "Plan opt-in upsert")
      .parameters.jsCode;
    const AsyncFunction = Object.getPrototypeOf(
      async function () {},
    ).constructor;
    const existing = status ? { id: "p", leadStatus: status } : undefined;
    const output = await new AsyncFunction("$", "$input", code)(
      () => ({
        first: () => ({
          json: { email: env.contact.email, at: env.receivedAt },
        }),
      }),
      {
        first: () => ({
          json: { data: { people: existing ? [existing] : [] } },
        }),
      },
    );
    const contact = { ...existing, ...output[0].json.body };
    const intake = await resolveWorkflow(
      JSON.parse(await readFile("n8n/span-quiz-intake.json", "utf8")),
    );
    const planned = await new AsyncFunction(
      "$",
      "$input",
      intake.nodes.find((n: any) => n.name === "Plan Person upsert").parameters
        .jsCode,
    )(
      () => ({
        first: () => ({
          json: { env, config: { TWENTY_BASE: "https://crm.example/rest" } },
        }),
      }),
      {
        first: () => ({
          json: { data: { people: [{ id: "p", ...contact }] } },
        }),
      },
    );
    expect(planned[0].json.method).toBe("PATCH");
    expect({ ...contact, ...planned[0].json.body }.leadStatus).toBe(
      status || "NEW",
    );
    if (existing) expect(output[0].json.body).not.toHaveProperty("leadStatus");
  },
);
