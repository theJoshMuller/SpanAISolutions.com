import { describe, it, expect, afterEach } from "vitest";
import { renderResultEmail, safeUrl } from "../../n8n/src/templates.js";
import { researchMarkdown } from "../../n8n/src/workflow.js";
import { scoreAll } from "../../src/quiz/scoring";

// n8n's Code-node sandbox has no URL global; the included modules must not depend on it.
const realUrl = globalThis.URL;
function withoutUrl<T>(fn: () => T): T {
  // @ts-expect-error simulate the n8n sandbox
  delete globalThis.URL;
  try {
    return fn();
  } finally {
    globalThis.URL = realUrl;
  }
}
afterEach(() => {
  globalThis.URL = realUrl;
});
function env(segment: string): any {
  const answers = {
    A1: segment === "course" ? "member" : "owner",
    A2: segment === "course" ? "solo" : "10-49",
    B1: 3,
    B2: 2,
    B3: 3,
    B4: 2,
    B5: 2,
    C1: "followups for every new lead",
    C2: "5-10",
    C3: 3,
    D1: segment === "discovery" ? "for" : "diy",
  };
  return {
    answers,
    result: { ...scoreAll(answers as any), segment },
    contact: { firstName: "Ana", email: "a@example.com" },
    submissionId: "id",
    test: false,
  };
}
const ideas = [
  {
    title: "Idea",
    whatItDoes: "Does",
    tools: ["Claude"],
    hoursSavedPerWeek: 1,
  },
];
const optinUrl =
  "https://spanaisolutions.com/.netlify/functions/optin?token=a.b";

describe("n8n sandbox without URL global", () => {
  it("safeUrl keeps http(s) links and escapes them", () => {
    withoutUrl(() => {
      expect(safeUrl("https://example.com/?a=1&b=2")).toBe(
        "https://example.com/?a=1&amp;b=2",
      );
      expect(safeUrl("http://example.com")).toBe("http://example.com");
    });
  });
  it("safeUrl rejects non-http schemes and malformed input", () => {
    withoutUrl(() => {
      for (const bad of [
        "javascript:alert(1)",
        "data:text/html,x",
        "//example.com",
        "https://",
        'https://e.com/"onmouseover="x',
        "https://e.com/ x",
        "",
        null,
      ])
        expect(safeUrl(bad)).toBe("");
    });
  });
  it.each([
    ["discovery", "https://calendar.app.google/bNDHFsbv5cj88RzPA"],
    ["nurture-leader", "https://calendar.app.google/bNDHFsbv5cj88RzPA"],
    [
      "course",
      "https://spanaisolutions.com/.netlify/functions/optin?token=a.b",
    ],
  ])("%s result email primary button links to %s", (segment, href) => {
    const { html } = withoutUrl(() =>
      renderResultEmail(env(segment), ideas, { optinUrl }),
    );
    expect(html).not.toContain('href=""');
    expect(html).toContain(`href="${href}"`);
  });
  it("researchMarkdown keeps source links", () => {
    const text = withoutUrl(() =>
      researchMarkdown({
        results: [
          {
            title: "Acme",
            content: "About",
            url: "https://acme.example/about",
          },
          { title: "Bad", content: "x", url: "javascript:alert(1)" },
        ],
      }),
    );
    expect(text).toContain("acme.example/about");
    expect(text).not.toContain("javascript:");
  });
});
