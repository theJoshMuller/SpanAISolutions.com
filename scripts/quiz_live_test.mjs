/** Operator runner. --dry-run is entirely offline. Live execution requires separate authorization. */
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  readEnv,
  readLocalEnv,
  twentyRestBase,
  apiRequest,
} from "./quiz_deploy_helpers.mjs";
const collections = [
  "people",
  "companies",
  "notes",
  "tasks",
  "noteTargets",
  "taskTargets",
];
const kami = "b5eee740-b5e0-40ba-9d82-1eba46e08899";
export class VerificationError extends Error {}
function assert(ok, message) {
  if (!ok) throw new VerificationError(message);
}
export function diagnostic(error) {
  return error instanceof VerificationError
    ? `Quiz verification failed: ${error.message}`
    : "Quiz verification failed: external operation failed; provider details withheld.";
}
export function verifyTestMode(workflow) {
  const latch = workflow.nodes?.find((n) => n.name === "Config");
  assert(
    latch?.parameters?.assignments?.assignments?.some(
      (a) => a.name === "TEST_MODE" && a.value === true,
    ),
    "Owned intake TEST_MODE must be true",
  );
}
// Compile the real TypeScript modules, resolving their extensionless local import without a new dependency.
export async function buildEnvelopes(key, now = new Date()) {
  const dir = await mkdtemp(`${tmpdir()}/span-quiz-test-`);
  try {
    for (const [source, name] of [
      ["src/quiz/config.ts", "config"],
      ["src/quiz/scoring.ts", "scoring"],
      ["netlify/lib/token.ts", "token"],
    ]) {
      const text = await readFile(
        new URL(`../${source}`, import.meta.url),
        "utf8",
      );
      const js = ts
        .transpileModule(text, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        })
        .outputText.replace("from './config'", "from './config.mjs'");
      await writeFile(`${dir}/${name}.mjs`, js);
    }
    const { scoreAll, validateAnswers } = await import(
      pathToFileURL(`${dir}/scoring.mjs`).href
    );
    const { signOptin } = await import(pathToFileURL(`${dir}/token.mjs`).href);
    const marker = `quiztest-${now.getTime()}-${randomUUID().slice(0, 8)}`;
    return ["discovery", "nurture-leader", "course"].map((segment) => {
      const submissionId = randomUUID();
      const raw = {
        A1: segment === "course" ? "member" : "owner",
        A2: segment === "course" ? "solo" : "10-49",
        B1: 3,
        B2: 2,
        B3: 3,
        B4: 2,
        B5: 2,
        C1: `${marker}: repetitive followups`,
        C2: "5-10",
        C3: 3,
        C4: marker,
        D1: segment === "discovery" ? "for" : "myself",
        D2: marker,
      };
      if (segment === "nurture-leader") raw.D1 = "diy";
      const validated = validateAnswers(raw);
      assert(validated.ok, `Invalid ${segment} fixture`);
      const result = scoreAll(validated.answers);
      assert(result.segment === segment, "Persona segment mismatch");
      const email = `josh+quiztest-${segment}-${marker.slice(9)}@spanaisolutions.com`;
      return {
        submissionId,
        startedAt: now.toISOString(),
        receivedAt: now.toISOString(),
        answers: validated.answers,
        contact: {
          firstName: `${marker}-${segment}`,
          email,
          organization: segment === "course" ? null : `${marker}-${segment}`,
          phone: null,
        },
        attribution: {
          utm_source: "quiztest",
          utm_medium: null,
          utm_campaign: marker,
          referrer: null,
          landingPath: "/quiz/",
        },
        result,
        optinToken: signOptin(submissionId, email, key),
        test: true,
      };
    });
  } finally {
    await rm(dir, {
      recursive: true,
      force: true,
    });
  }
}
export async function listAll(api, collection) {
  const rows = [];
  let cursor;
  const seen = new Set();
  do {
    const response = await api(
      "GET",
      `/${collection}?limit=200&depth=0${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`,
    );
    const page = response.data?.[collection];
    assert(
      Array.isArray(page) &&
        typeof response.pageInfo?.hasNextPage === "boolean",
      `Malformed ${collection} page`,
    );
    rows.push(...page);
    if (!response.pageInfo.hasNextPage) break;
    cursor = response.pageInfo.endCursor;
    assert(cursor && !seen.has(cursor), "Invalid pagination cursor");
    seen.add(cursor);
  } while (true);
  return rows;
}
export async function snapshot(api) {
  return Object.fromEntries(
    await Promise.all(collections.map(async (c) => [c, await listAll(api, c)])),
  );
}
const marked = (value) => /quiztest-[a-z0-9-]+/i.test(String(value ?? ""));
const emailMarked = (p) =>
  /^josh\+quiztest-[a-z0-9-]+@spanaisolutions\.com$/i.test(
    p.emails?.primaryEmail ?? "",
  );
export function cleanupPlan(db) {
  const people = db.people.filter(emailMarked),
    pids = new Set(people.map((p) => p.id));
  const companies = db.companies.filter((c) => marked(c.name));
  const cids = new Set(companies.map((c) => c.id));
  assert(
    !db.people.some((p) => cids.has(p.companyId) && !pids.has(p.id)),
    "Marked company contains unmarked Person",
  );
  const out = [];
  for (const [records, targets, idKey] of [
    ["notes", "noteTargets", "noteId"],
    ["tasks", "taskTargets", "taskId"],
  ]) {
    const linked = db[targets].filter(
      (t) => pids.has(t.targetPersonId) || cids.has(t.targetCompanyId),
    );
    const ids = new Set(linked.map((t) => t[idKey]));
    const chosen = db[records].filter(
      (r) => ids.has(r.id) || marked(`${r.title} ${r.bodyV2?.markdown}`),
    );
    for (const r of chosen)
      assert(
        marked(`${r.title} ${r.bodyV2?.markdown}`),
        `Refusing unmarked linked ${records}`,
      );
    const selected = new Set(chosen.map((r) => r.id));
    for (const t of db[targets].filter(
      (t) => selected.has(t[idKey]) || ids.has(t[idKey]),
    )) {
      assert(
        (!t.targetPersonId || pids.has(t.targetPersonId)) &&
          (!t.targetCompanyId || cids.has(t.targetCompanyId)) &&
          !t.targetOpportunityId,
        "Target links to real record",
      );
      out.push({
        collection: targets,
        id: t.id,
      });
    }
    out.push(
      ...chosen.map((r) => ({
        collection: records,
        id: r.id,
      })),
    );
  }
  out.push(
    ...people.map((r) => ({
      collection: "people",
      id: r.id,
    })),
    ...companies.map((r) => ({
      collection: "companies",
      id: r.id,
    })),
  );
  const order = [
    "noteTargets",
    "taskTargets",
    "notes",
    "tasks",
    "people",
    "companies",
  ];
  return out.sort(
    (a, b) => order.indexOf(a.collection) - order.indexOf(b.collection),
  );
}
export function verifyRecords(envelopes, db, consent = false) {
  for (const e of envelopes) {
    const matches = db.people.filter(
      (p) => p.emails?.primaryEmail === e.contact.email,
    );
    assert(matches.length === 1, "Expected one test Person");
    const p = matches[0];
    assert(
      p.segment === e.result.segment.toUpperCase().replaceAll("-", "_") &&
        p.aiLevel === e.result.aiLevel &&
        p.leadStatus === "NEW",
      "Person fields mismatch",
    );
    assert(
      db.notes.filter((n) => n.title?.includes(e.submissionId)).length === 1,
      "Expected exactly one Note per submissionId",
    );
    if (e.result.segment === "discovery")
      assert(
        db.taskTargets.some(
          (t) =>
            t.targetPersonId === p.id &&
            db.tasks.some(
              (task) => task.id === t.taskId && task.assigneeId === kami,
            ),
        ),
        "Discovery task missing or wrong assignee",
      );
    if (consent) assert(p.courseOptIn === true, "Consent not persisted");
  }
}
export async function main(args = process.argv.slice(2)) {
  assert(
    args.every((a) => ["--dry-run", "--cleanup", "--audit"].includes(a)),
    "Unknown argument",
  );
  if (args.includes("--dry-run")) {
    const rows = await buildEnvelopes("offline-only-key");
    console.log(
      JSON.stringify({
        mode: "offline",
        segments: rows.map((e) => e.result.segment),
        test: true,
        cleanupCollections: collections,
        networkRequests: 0,
      }),
    );
    return;
  }
  const env = {
    ...(await readEnv()),
    ...(await readLocalEnv()),
    ...process.env,
  };
  for (const key of ["SPAN_TWENTY_API_URL", "SPAN_TWENTY_API_KEY"])
    assert(env[key], `Missing ${key}`);
  const api = apiRequest(twentyRestBase(env.SPAN_TWENTY_API_URL), {
    Authorization: `Bearer ${env.SPAN_TWENTY_API_KEY}`,
  });
  if (args.includes("--audit")) {
    const plan = cleanupPlan(await snapshot(api));
    console.log(
      JSON.stringify(
        Object.fromEntries(
          collections.map((c) => [
            c,
            plan.filter((r) => r.collection === c).length,
          ]),
        ),
      ),
    );
    return;
  }
  if (args.includes("--cleanup")) {
    const plan = cleanupPlan(await snapshot(api));
    for (const item of plan)
      await api("DELETE", `/${item.collection}/${item.id}`);
    const after = await snapshot(api);
    assert(cleanupPlan(after).length === 0, "Test records remain");
    for (const item of plan)
      assert(
        !after[item.collection].some((r) => r.id === item.id),
        "Created target remains",
      );
    console.log(
      `Cleanup verified: ${plan.length} test records/targets removed`,
    );
    return;
  }
  for (const key of [
    "N8N_QUIZ_WEBHOOK_URL",
    "N8N_OPTIN_WEBHOOK_URL",
    "N8N_QUIZ_SECRET",
    "OPTIN_SIGNING_KEY",
  ])
    assert(env[key], `Missing ${key}`);
  const owned = JSON.parse(env.N8N_QUIZ_OWNED_WORKFLOWS || "{}");
  const intakeId = owned["Span · Quiz Intake"];
  assert(intakeId, "Missing owned intake workflow");
  const n8nKey =
    env.N8N_API_KEY ||
    (await readFile("/home/yeshu/n8n.joshmuller.ca-KEY", "utf8")).trim();
  const n8n = apiRequest("https://n8n.joshmuller.ca/api/v1", {
    "X-N8N-API-KEY": n8nKey,
  });
  const workflow = await n8n("GET", `/workflows/${intakeId}`);
  assert(
    workflow.name === "Span · Quiz Intake",
    "Unexpected workflow identity",
  );
  verifyTestMode(workflow);
  const rows = await buildEnvelopes(env.OPTIN_SIGNING_KEY);
  assert(
    rows.every(
      (e) =>
        e.test === true &&
        emailMarked({
          emails: {
            primaryEmail: e.contact.email,
          },
        }),
    ),
    "Unsafe test recipients",
  );
  const post = async (url, body) => {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Span-Quiz-Secret": env.N8N_QUIZ_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    assert(r.ok, `Webhook failed (${r.status})`);
  };
  const wait = () => new Promise((r) => setTimeout(r, 60000));
  for (const row of rows) await post(env.N8N_QUIZ_WEBHOOK_URL, row);
  await wait();
  verifyRecords(rows, await snapshot(api));
  await post(env.N8N_QUIZ_WEBHOOK_URL, rows[0]);
  await wait();
  verifyRecords(rows, await snapshot(api));
  for (const e of rows)
    await post(env.N8N_OPTIN_WEBHOOK_URL, {
      submissionId: e.submissionId,
      email: e.contact.email,
      optedInAt: new Date().toISOString(),
    });
  await wait();
  verifyRecords(rows, await snapshot(api), true);
  console.log(
    "CRM and consent assertions passed. Duplicate alert attempts require n8n execution evidence; inbox delivery requires manual confirmation.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
)
  main().catch((error) => {
    console.error(diagnostic(error));
    process.exitCode = 1;
  });
