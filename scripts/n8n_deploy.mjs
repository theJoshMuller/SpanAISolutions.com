import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  readLocalEnv,
  writeLocalEnv,
  apiRequest,
} from "./quiz_deploy_helpers.mjs";
const ROOT = new URL("../", import.meta.url);
const NAMES = [
  "Span · Quiz Errors",
  "Span · Quiz Intake",
  "Span · Quiz Course Opt-in",
];
const FILES = [
  "span-quiz-errors.json",
  "span-quiz-intake.json",
  "span-quiz-optin.json",
];
export async function resolveWorkflow(input) {
  const workflow = structuredClone(input);
  for (const node of workflow.nodes) {
    if (typeof node.parameters?.jsCode !== "string") continue;
    let code = node.parameters.jsCode;
    for (const match of [...code.matchAll(/\/\*@include (.*?)\*\//g)]) {
      if (
        !["templates.js", "mime.js", "ideas.js", "workflow.js"].includes(
          match[1],
        )
      )
        throw Error("Unknown module include");
      const source = (
        await fs.readFile(new URL(`n8n/src/${match[1]}`, ROOT), "utf8")
      ).replace(/^export\s+/gm, "");
      if (/^\s*(?:import|export)\s/m.test(source))
        throw Error("Included module must be import-free");
      code = code.replace(match[0], () => source);
    }
    if (code.includes("/*@include")) throw Error("Unresolved include");
    node.parameters.jsCode = code;
  }
  return workflow;
}
export function selectWorkflowTarget(existing, name, owned) {
  const matches = existing.filter((w) => w.name === name);
  if (matches.length > 1)
    throw Error(`Duplicate workflow name collision: ${name}`);
  if (!matches.length) {
    if (owned[name]) throw Error(`Owned workflow missing: ${name}`);
    return null;
  }
  const w = matches[0];
  if (w.id !== owned[name])
    throw Error(`Unowned workflow name collision: ${name}`);
  if (w.active) throw Error(`Refusing to update active workflow: ${name}`);
  return w.id;
}
export async function deploy(dryRun = false) {
  const local = await readLocalEnv();
  const workflows = await Promise.all(
    FILES.map(async (file) =>
      resolveWorkflow(
        JSON.parse(await fs.readFile(new URL("n8n/" + file, ROOT), "utf8")),
      ),
    ),
  );
  if (dryRun) {
    for (const w of workflows) console.log(JSON.stringify(w, null, 2));
    return;
  }
  const key = (
    await fs.readFile("/home/yeshu/n8n.joshmuller.ca-KEY", "utf8")
  ).trim();
  const request = apiRequest("https://n8n.joshmuller.ca/api/v1", {
    "X-N8N-API-KEY": key,
  });
  const existing = [];
  let cursor;
  do {
    const d = await request(
      "GET",
      "/workflows?limit=250" +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""),
    );
    existing.push(...d.data);
    cursor = d.nextCursor;
  } while (cursor);
  const owned = JSON.parse(local.N8N_QUIZ_OWNED_WORKFLOWS || "{}");
  for (const name of NAMES) selectWorkflowTarget(existing, name, owned);
  if (!local.N8N_QUIZ_SECRET_CREDENTIAL_ID)
    throw Error(
      "Create the authorized webhook credential first; local credential ID missing",
    );
  for (const w of workflows) {
    for (const node of w.nodes) {
      if (node.credentials?.httpHeaderAuth?.name === "Span Quiz Webhook Secret")
        node.credentials.httpHeaderAuth.id =
          local.N8N_QUIZ_SECRET_CREDENTIAL_ID;
    }
    if (w.name !== "Span · Quiz Errors")
      w.settings.errorWorkflow = owned["Span · Quiz Errors"];
    const id = selectWorkflowTarget(existing, w.name, owned);
    const payload = {
      name: w.name,
      nodes: w.nodes,
      connections: w.connections,
      settings: w.settings,
    };
    const saved = await request(
      id ? "PUT" : "POST",
      `/workflows${id ? "/" + id : ""}`,
      payload,
    );
    owned[w.name] = saved.id;
    await writeLocalEnv({
      N8N_QUIZ_OWNED_WORKFLOWS: JSON.stringify(owned),
    });
    const verified = await request("GET", `/workflows/${saved.id}`);
    if (verified.active) throw Error("Workflow unexpectedly active");
    console.log(`${w.name}: ${saved.id} (inactive)`);
    for (const node of verified.nodes.filter(
      (n) => n.type === "n8n-nodes-base.webhook",
    )) {
      const url = `https://n8n.joshmuller.ca/webhook/${node.parameters.path}`;
      await writeLocalEnv({
        [w.name === "Span · Quiz Intake"
          ? "N8N_QUIZ_WEBHOOK_URL"
          : "N8N_OPTIN_WEBHOOK_URL"]: url,
      });
      console.log(`webhook path: ${node.parameters.path}`);
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await deploy(process.argv.includes("--dry-run"));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
