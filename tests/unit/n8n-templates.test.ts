// @ts-expect-error Node Buffer is provided by Vitest's runtime; this browser project omits @types/node.
import { Buffer } from "node:buffer";
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  markdownText,
  renderResultEmail,
  renderKamiAlert,
  renderNoteMarkdown,
} from "../../n8n/src/templates.js";
import { buildRawMime } from "../../n8n/src/mime.js";
import { QUESTIONS } from "../../src/quiz/config";
import { scoreAll } from "../../src/quiz/scoring";
const hostile = '<script>alert(1)</script> "quotes" 🚀\nline2';
function env(segment = "discovery", test = false): any {
  const answers = {
    A1: "owner",
    A2: "10-49",
    B1: 1,
    B2: 2,
    B3: 3,
    B4: 2,
    B5: 1,
    C1: hostile,
    C1chip: "reports",
    C2: "5-10",
    C3: 3,
    C4: hostile,
    D1: "for",
    D2: hostile.padEnd(500, "x"),
  };
  return {
    answers,
    result: { ...scoreAll(answers as any), segment },
    contact: {
      firstName: hostile,
      organization: hostile,
      email: "a@example.com",
      phone: "+1 (306) 555-1234",
    },
    attribution: { utm_source: hostile, landingPath: "/quiz" },
    submissionId: "id",
    test,
  };
}
describe("email and note templates", () => {
  it("escapes free text and generated ideas, retaining emoji and newlines", () => {
    const e = env();
    const ideas = [
      {
        title: hostile,
        whatItDoes: hostile,
        tools: [hostile],
        hoursSavedPerWeek: 1,
      },
    ];
    for (const html of [
      renderResultEmail(e, ideas, { optinUrl: "https://example.com/?a=1&b=2" })
        .html,
      renderKamiAlert(e, null).html,
      renderNoteMarkdown(e).markdown,
    ]) {
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>");
      expect(html).toContain("🚀");
      expect(html).toContain("line2");
    }
    expect(escapeHtml("\"'&<>")).toBe("&quot;&#39;&amp;&lt;&gt;");
  });
  it("uses only calendar for Discovery, course primary and calendar secondary for Course", () => {
    const d = renderResultEmail(env(), [], {
      optinUrl: "https://example.com/optin",
    });
    expect(d.html).toContain("https://calendar.app.google/bNDHFsbv5cj88RzPA");
    expect(d.html).not.toContain("https://example.com/optin");
    expect(d.text).not.toMatch(/call you|reach out/i);
    const c = renderResultEmail(env("course"), [], {
      optinUrl: "https://example.com/optin",
    });
    expect(c.html.indexOf("https://example.com/optin")).toBeLessThan(
      c.html.indexOf("https://calendar.app.google"),
    );
    expect(c.html).toContain("/quiz/gauge/45.png");
    expect(c.html).toContain("23-4900 Optimist Dr");
    expect(c.subject).toContain("25,900");
  });
  it.each([
    ["discovery", "🔥 Discovery"],
    ["nurture-leader", "🌤 Nurture-Leader"],
    ["course", "🎓 Course"],
  ])("routes and prefixes %s", (segment, prefix) => {
    expect(renderKamiAlert(env(segment), null).subject).toMatch(
      new RegExp("^" + prefix),
    );
    const a = renderKamiAlert(env(segment, true), "https://crm.example.com");
    expect(a.to).toBe("josh@spanaisolutions.com");
    expect(a.subject).toContain("[TEST]");
    expect(a.html).toContain("tel:+13065551234");
    expect(renderKamiAlert(env(segment), null).to).toBe(
      "kamila@spanaisolutions.com",
    );
  });
  it("notes contain all asked prompts and chosen labels and default-rate math", () => {
    const e = env();
    const note = renderNoteMarkdown(e);
    for (const q of QUESTIONS)
      expect(note.markdown).toContain(
        escapeHtml(q.prompt.leader).replace(/[\\`*_{}\[\]()!|#~]/g, "\\$&"),
      );
    expect(note.markdown).toContain("Owner / founder");
    expect(note.markdown).toContain("Have someone build it for us");
    expect(note.markdown).toContain("648 hours/year");
    expect(note.markdown).toContain("$25,900/year");
  });
  it("omits leader-only answers on individual path and escapes Markdown syntax", () => {
    const e = env("course");
    e.result.path = "individual";
    e.answers.C1 = "[click](javascript:alert(1))";
    const n = renderNoteMarkdown(e).markdown;
    expect(n).not.toContain("Anything else we should know?");
    expect(n).not.toContain("[click](javascript:");
    expect(n).toContain("40");
  });
  it("builds UTF8 multipart MIME and rejects injected headers", () => {
    const raw = buildRawMime({
      from: '"Josh & Kami at Span" <hello@spanaisolutions.com>',
      to: "a@example.com",
      subject: "🔥 AI 🚀",
      html: "<p>🚀</p>",
      text: "🚀",
    });
    const mime = Buffer.from(raw, "base64url").toString();
    expect(mime).toContain(
      'From: "Josh & Kami at Span" <hello@spanaisolutions.com>',
    );
    expect(mime).toContain("Subject: =?UTF-8?B?");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain(Buffer.from("🚀").toString("base64"));
    expect(() =>
      buildRawMime({
        from: "a\r\nBcc: evil",
        to: "a",
        subject: "s",
        html: "",
        text: "",
      }),
    ).toThrow();
  });
});

it("keeps the import-free question snapshot in parity for both paths and all choices", () => {
  for (const path of ["leader", "individual"])
    for (const q of QUESTIONS.filter((q) => q.paths.includes(path as any)))
      for (const option of q.options || [
        { value: "sample", label: "sample" },
      ]) {
        const e = env();
        e.result.path = path;
        e.answers[q.id] = option.value;
        const email = renderResultEmail(e, [], {
          optinUrl: "https://example.com",
        });
        expect(email.text).toContain(q.prompt[path as "leader" | "individual"]);
        expect(email.text).toContain(
          String(
            typeof option.label === "string"
              ? option.label
              : option.label[path as "leader" | "individual"],
          ),
        );
      }
});
it("strips subject newlines and rejects unsafe URL schemes in HTML", () => {
  const e = env();
  e.contact.firstName = "Jane\r\nBcc: bad@example.com";
  expect(renderKamiAlert(e, "javascript:alert(1)").subject).not.toMatch(
    /[\r\n]/,
  );
  expect(renderKamiAlert(e, "javascript:alert(1)").html).not.toContain(
    'href="javascript:',
  );
  e.result.segment = "course";
  expect(
    renderResultEmail(e, [], { optinUrl: "javascript:alert(1)" }).html,
  ).not.toContain('href="javascript:');
});
it("preserves UTF8 subject across folded encoded words and both MIME alternatives", () => {
  const subject = "🔥🚀 ".repeat(35);
  const raw = buildRawMime({
    from: "sender@example.com",
    to: "a@example.com",
    subject,
    html: "<p>é🚀</p>",
    text: "é🚀",
  });
  expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(raw, "base64url").toString();
  const words = [...mime.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)];
  expect(
    words.map((m) => Buffer.from(m[1], "base64").toString()).join(""),
  ).toBe(subject);
  expect(words.every((m) => m[0].length <= 75)).toBe(true);
  expect(mime).toContain(Buffer.from("é🚀").toString("base64"));
});

it("preserves exact 500-character D2 and every newline in both email HTML and Markdown", () => {
  const e = env();
  const html = escapeHtml(e.answers.D2).replace(/\n/g, "<br>");
  expect(e.answers.D2).toHaveLength(500);
  expect(
    renderResultEmail(e, [], { optinUrl: "https://example.com" }).html,
  ).toContain(html);
  expect(renderKamiAlert(e, null).html).toContain(html);
  expect(renderNoteMarkdown(e).markdown).toContain(
    "**D2. Anything else we should know?**\n\n" +
      markdownText(e.answers.D2) +
      "\n\nPain chip:",
  );
  expect(markdownText(e.answers.D2)).toContain("🚀\nline2");
});
it("escapes Markdown line controls identically in both import-free helpers", async () => {
  // @ts-ignore import-free runtime helper
  const { wfEscape } = await import("../../n8n/src/workflow.js");
  const raw = "- item\n+ item\n1. item\n2) item\n---\n  - nested";
  const expected =
    "\\- item\n\\+ item\n1\\. item\n2\\) item\n\\---\n  \\- nested";
  expect(markdownText(raw)).toBe(expected);
  expect(wfEscape(raw)).toBe(expected);
});
