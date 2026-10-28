import { describe, it, expect } from "vitest";
// @ts-ignore Node built-in runtime
import { readFile } from "node:fs/promises";
// @ts-ignore deployment module
import { resolveWorkflow } from "../../scripts/n8n_deploy.mjs";

// Offline dataflow harness: external nodes are stubs, while the terminal Code
// node runs verbatim. Inject n8n's documented Continue output {error: message}.
async function simulate(failed: string[], research: boolean) {
  const w = await resolveWorkflow(
    JSON.parse(await readFile("n8n/span-quiz-intake.json", "utf8")),
  );
  const outputs = new Map<string, any[]>();
  const attempted: string[] = [];
  let name = "Build Kami MIME";
  let failure: Error | undefined;
  const branch: Record<string, boolean> = {
    "Company needed": true,
    "Person available": true,
    "Discovery task needed": true,
    "Company research needed": research,
  };
  for (let count = 0; name && count < 100; count++) {
    const n = w.nodes.find((n: any) => n.name === name);
    attempted.push(name);
    if (name === "Report deferred failures") {
      const AsyncFunction = Object.getPrototypeOf(
        async function () {},
      ).constructor;
      const $ = (key: string) => ({
        isExecuted: outputs.has(key),
        all: () => outputs.get(key),
        first: () => ({ json: { env: { submissionId: "test-submission" } } }),
      });
      try {
        await new AsyncFunction("$", "$input", n.parameters.jsCode)($, {
          all: () => [{ json: {} }],
        });
      } catch (e) {
        failure = e as Error;
      }
      break;
    }
    outputs.set(name, [
      {
        json: failed.includes(name)
          ? { error: "injected failure" }
          : { ok: true },
      },
    ]);
    if (failed.includes(name) && n.onError !== "continueRegularOutput") break;
    const index = n.type === "n8n-nodes-base.if" ? (branch[name] ? 0 : 1) : 0;
    name = w.connections[name]?.main[index]?.[0]?.node;
  }
  return { w, attempted, failure };
}
describe("deferred post-alert failures", () => {
  it.each([
    "Build Kami MIME",
    "Send Kami alert",
    "Upsert Person",
    "Send result email",
  ])(
    "continues downstream after %s then fails for the existing Josh error workflow",
    async (step) => {
      const { attempted, failure } = await simulate([step], true);
      expect(attempted).toContain("Send result email");
      expect(attempted).toContain("Update submission Note");
      expect(failure?.message).toContain(step);
      expect(failure?.message).toContain("test-submission");
      const errors = JSON.parse(
        await readFile("n8n/span-quiz-errors.json", "utf8"),
      );
      const deploy = await readFile("scripts/n8n_deploy.mjs", "utf8");
      expect(deploy.replace(/\s/g, "")).toMatch(/w\.settings\.errorWorkflow=owned\[['"]Span·QuizErrors['"]\]/);
      expect(
        errors.nodes.find((n: any) => n.name === "Build error MIME").parameters
          .jsCode,
      ).toContain("to:'josh@spanaisolutions.com'");
    },
  );
  it("reports all failures on the no-research branch and succeeds for skipped/successful steps", async () => {
    const failed = await simulate(["Find Person", "Send result email"], false);
    expect(failed.failure?.message).toContain("Find Person");
    expect(failed.failure?.message).toContain("Send result email");
    const ok = await simulate([], false);
    expect(ok.attempted).toContain("Report deferred failures");
    expect(ok.failure).toBeUndefined();
  });
});

it.each(["Build Kami MIME", "Send Kami alert"])(
  "claims once and never retries an alert after %s fails",
  async (failedStep) => {
    const w = await resolveWorkflow(
      JSON.parse(await readFile("n8n/span-quiz-intake.json", "utf8")),
    );
    const AsyncFunction = Object.getPrototypeOf(
      async function () {},
    ).constructor;
    const env = {
      submissionId: "12345678-1234-4234-8234-123456789012",
      test: true,
      contact: { firstName: "Jane", email: "jane@example.com" },
      answers: { A1: "member", C2: "5-10" },
      result: {
        path: "individual",
        segment: "course",
        aiLevel: 50,
        skills: [],
      },
      attribution: {},
    };
    const envelope = [{ json: { env } }];
    let notes: any[] = [];
    let alerts = 0;
    const $ = () => ({ all: () => envelope, first: () => envelope[0] });
    const run = async (name: string, input: any[]) =>
      new AsyncFunction(
        "$",
        "$input",
        w.nodes.find((n: any) => n.name === name).parameters.jsCode,
      )($, { first: () => input[0], all: () => input });
    const receive = async () => {
      const fresh = await run("Skip duplicate Note", [
        { json: { data: { notes } } },
      ]);
      if (!fresh.length) return;
      const claim = await run("Build atomic Note claim", fresh);
      const note = claim[0].json.variables.data;
      notes.push(note);
      const won = await run("Require claim winner", [
        { json: { data: { createNote: { id: note.id } } } },
      ]);
      expect(won).toHaveLength(1);
      // MIME rendering runs verbatim before injecting preparation/provider failure.
      expect((await run("Build Kami MIME", won))[0].json.raw).toBeTruthy();
      alerts++;
      const result = await simulate([failedStep], false);
      expect(result.attempted).toContain("Upsert Person");
      expect(result.attempted).toContain("Send result email");
      expect(result.failure?.message).toContain(failedStep);
    };
    await receive();
    await receive();
    expect(notes).toHaveLength(1);
    expect(alerts).toBe(1);
  },
);
