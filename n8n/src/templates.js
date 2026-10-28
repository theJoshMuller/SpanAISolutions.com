export function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}
export function safeHeader(s) {
  return String(s ?? "").replace(/[\r\n\x00-\x1f\x7f]+/g, " ");
}
// No URL global in n8n's Code-node sandbox, so validate with a pattern instead.
export function safeUrl(s) {
  const u = String(s ?? "");
  return /^https?:\/\/[^\s"'<>\\/?#]+[^\s"'<>\\]*$/i.test(u)
    ? escapeHtml(u)
    : "";
}
export function quizMath(env) {
  const a = env.answers;
  const weekly =
    ({
      "<2": 1,
      "2-5": 3.5,
      "5-10": 7.5,
      "10-20": 15,
      "20+": 25,
    }[a.C2] || 0) * (env.result.path === "leader" ? a.C3 || 1 : 1);
  return {
    weekly,
    hours: Math.round(weekly * 48 * 0.6),
    dollars: Math.round((weekly * 48 * 0.6 * 40) / 100) * 100,
  };
}
export function money(n) {
  return Number(n).toLocaleString("en-CA");
}
export function quizAnswerRows(env) {
  const path = env.result.path;
  return EMAIL_QUESTIONS.filter((q) => q.paths.includes(path)).map((q) => ({
    id: q.id,
    prompt: q.prompt[path],
    answer:
      q.options?.find((o) => o.value === env.answers[q.id])?.label ??
      env.answers[q.id] ??
      "—",
  }));
}
export function htmlLines(s) {
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}
export function renderResultEmail(env, ideas, opts) {
  const r = env.result,
    m = quizMath(env),
    calendar = "https://calendar.app.google/bNDHFsbv5cj88RzPA";
  const subject = safeHeader(
    `Your AI Level: ${r.aiLevel} · ${r.bandLabel}, and ≈$${money(m.dollars)}/yr on the table`,
  );
  const button = (label, url) =>
    `<p><a style="display:inline-block;padding:14px 20px;background:#2db56f;color:#10251b;border-radius:6px;font-weight:bold" href="${safeUrl(url)}">${escapeHtml(label)}</a></p>`;
  let cta = "",
    ctaText = "";
  if (r.segment === "course") {
    cta =
      button(
        "Notify me when the free AI agents course launches",
        opts.optinUrl,
      ) + `<p><a href="${calendar}">Running a team? Grab a time.</a></p>`;
    ctaText = `Notify me when the free AI agents course launches: ${opts.optinUrl}\nRunning a team? Grab a time: ${calendar}`;
  } else {
    cta = button("Grab a time to map your win-back", calendar);
    ctaText = `Grab a time to map your win-back: ${calendar}`;
    if (r.segment === "nurture-leader") {
      cta += button(
        "Notify me when the free AI agents course launches",
        opts.optinUrl,
      );
      ctaText += `\nNotify me when the free AI agents course launches: ${opts.optinUrl}`;
    }
  }
  const description =
    EMAIL_BANDS.find((b) => b.key === r.band)?.description || "";
  const rows = quizAnswerRows(env);
  const skills = r.skills
    .map(
      (s) =>
        `<tr><td style="padding:6px">${escapeHtml(s.label)}: ${escapeHtml(s.value)}/100</td><td style="padding:6px">${htmlLines(s.tip)}</td></tr>`,
    )
    .join("");
  const ideaHtml = ideas
    .map(
      (i) =>
        `<h3>${htmlLines(i.title)}</h3><p>${htmlLines(i.whatItDoes)}</p><p>Tools: ${i.tools.map(htmlLines).join(", ")} · Rough hours saved/week: ${escapeHtml(i.hoursSavedPerWeek)}</p>`,
    )
    .join("");
  const math = `≈${money(m.hours)} hours/year · ≈$${money(m.dollars)}/year. Estimate: ${m.weekly} team-hours/week × 48 weeks × 60% automation share, at the default $40/hr. These are assumptions, not a guarantee.`;
  const footer =
    "You're getting this because you asked for your AI Level results.";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Arial,sans-serif;color:#18261f"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:white" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;background:#10251b;color:white"><h1>Your AI Level: ${escapeHtml(r.aiLevel)} · ${escapeHtml(r.bandLabel)}</h1></td></tr><tr><td style="padding:24px"><p>Hi ${htmlLines(env.contact.firstName)},</p><img src="https://spanaisolutions.com/quiz/gauge/${Number(r.aiLevel)}.png" width="300" alt="AI Level ${escapeHtml(r.aiLevel)} of 100"><p>${escapeHtml(description)}</p><table role="presentation">${skills}</table><h2>Your win-back</h2><p>${escapeHtml(math)}</p><h2>Two ideas for your task</h2>${ideaHtml}${cta}<h2>Your answers</h2>${rows.map((q) => `<p><strong>${escapeHtml(q.prompt)}</strong><br>${htmlLines(q.answer)}</p>`).join("")}<p style="font-size:12px">${escapeHtml(footer)}<br>23-4900 Optimist Dr, Regina, SK S4V 4E2<br><a href="https://spanaisolutions.com/privacy">Privacy</a></p></td></tr></table></body></html>`;
  const text = `Hi ${env.contact.firstName},\nYour AI Level: ${r.aiLevel} · ${r.bandLabel}\n${description}\n${r.skills.map((s) => `${s.label}: ${s.value}/100 — ${s.tip}`).join("\n")}\n${math}\n${ideas.map((i) => `${i.title}\n${i.whatItDoes}\nTools: ${i.tools.join(", ")}; rough hours saved/week: ${i.hoursSavedPerWeek}`).join("\n\n")}\n${ctaText}\n${rows.map((q) => `${q.prompt}\n${q.answer}`).join("\n\n")}\n${footer}\n23-4900 Optimist Dr, Regina, SK S4V 4E2\nPrivacy: https://spanaisolutions.com/privacy`;
  return {
    subject,
    html,
    text,
  };
}
export function renderKamiAlert(env, personUrl) {
  const r = env.result,
    c = env.contact,
    m = quizMath(env),
    prefix = {
      discovery: "🔥 Discovery",
      "nurture-leader": "🌤 Nurture-Leader",
      course: "🎓 Course",
    }[r.segment];
  const subject = safeHeader(
    `${env.test ? "[TEST] " : ""}${prefix}: ${c.firstName}, ${c.organization || "—"} — ≈$${money(m.dollars)}/yr, AI Level ${r.aiLevel}`,
  );
  const phone = String(c.phone || "").replace(/[^+\d]/g, "");
  const html = `<h1>${escapeHtml(subject)}</h1><p>${htmlLines(c.firstName)} · ${htmlLines(c.organization || "—")}</p><p>Email: ${escapeHtml(c.email)}</p>${phone ? `<p><a href="tel:${escapeHtml(phone)}">${htmlLines(c.phone)}</a></p>` : ""}${personUrl && safeUrl(personUrl) ? `<p><a href="${safeUrl(personUrl)}">Twenty record</a></p>` : ""}${quizAnswerRows(
    env,
  )
    .map(
      (q) =>
        `<p><strong>${escapeHtml(q.prompt)}</strong><br>${htmlLines(q.answer)}</p>`,
    )
    .join("")}`;
  return {
    to: env.test ? "josh@spanaisolutions.com" : "kamila@spanaisolutions.com",
    subject,
    html,
  };
}
export function markdownText(s) {
  return escapeHtml(s)
    .replace(/[\\`*_{}\[\]()!|#~]/g, "\\$&")
    .replace(/^( *)([-+])/gm, "$1\\$2")
    .replace(/^( *\d+)([.)])(?=\s|$)/gm, "$1\\$2");
}
export function renderNoteMarkdown(env) {
  const r = env.result,
    m = quizMath(env),
    e = markdownText;
  return {
    title: safeHeader(
      `${env.test ? "[TEST] " : ""}AI Level Quiz · ${r.aiLevel} ${r.bandLabel} · ${env.submissionId}`,
    ),
    markdown: `# AI Level Quiz\n\n${e(r.aiLevel)} · ${e(r.bandLabel)}\n\nPath: ${e(r.path)}; segment: ${e(r.segment)}\n\n${Object.entries(
      env.contact,
    )
      .map(([k, v]) => `${e(k)}: ${e(v)}`)
      .join(
        "\n\n",
      )}\n\n## Skills\n\n${r.skills.map((s) => `${e(s.label)}: ${e(s.value)}/100 — ${e(s.tip)}`).join("\n\n")}\n\n## Answers\n\n${quizAnswerRows(
      env,
    )
      .map((q) => `**${e(q.id)}. ${e(q.prompt)}**\n\n${e(q.answer)}`)
      .join(
        "\n\n",
      )}\n\nPain chip: ${e(env.answers.C1chip)}\n\n## Win-back assumptions\n\n${m.weekly} team-hours/week × 48 weeks × 0.60 = ${m.hours} hours/year (rounded). Default $40/hr → ≈$${money(m.dollars)}/year (nearest $100, using unrounded hours).\n\n## Attribution\n\n${Object.entries(
      env.attribution,
    )
      .map(([k, v]) => `${e(k)}: ${e(v)}`)
      .join(
        "\n\n",
      )}\n\nsubmissionId: ${e(env.submissionId)}\nreceivedAt: ${e(env.receivedAt)}`,
  };
}
// Snapshot of quiz/config.ts for import-free n8n Code nodes; parity is unit tested.
const EMAIL_QUESTIONS = [
  {
    id: "A1",
    part: "A",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "What best describes your role?",
      leader: "What best describes your role?",
    },
    required: true,
    options: [
      {
        value: "owner",
        label: "Owner / founder",
      },
      {
        value: "executive",
        label: "Executive director / C-suite",
      },
      {
        value: "manager",
        label: "Director / manager",
      },
      {
        value: "member",
        label: "Team member",
      },
      {
        value: "freelancer",
        label: "Freelancer / solo",
      },
      {
        value: "student",
        label: "Student / exploring",
      },
    ],
  },
  {
    id: "A2",
    part: "A",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "How many people are on your team or in your organization?",
      leader: "How many people are on your team or in your organization?",
    },
    required: true,
    options: [
      {
        value: "solo",
        label: "Just me",
      },
      {
        value: "2-9",
        label: "2–9",
      },
      {
        value: "10-49",
        label: "10–49",
      },
      {
        value: "50-249",
        label: "50–249",
      },
      {
        value: "250+",
        label: "250+",
      },
    ],
  },
  {
    id: "B1",
    part: "B",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "Which of these is part of your normal week?",
      leader: "Which of these is part of your team's normal week?",
    },
    helper: "most advanced that's true",
    required: true,
    options: [
      {
        value: 0,
        label: "I rarely use AI",
      },
      {
        value: 1,
        label: "Ask ChatGPT/Claude questions now and then",
      },
      {
        value: 2,
        label: "Use AI daily to write, summarize or analyze",
      },
      {
        value: 3,
        label: "Custom instructions, Projects or GPTs I reuse",
      },
      {
        value: 4,
        label:
          "AI is connected to my tools (docs, inbox, CRM) or runs automations",
      },
    ],
  },
  {
    id: "B2",
    part: "B",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "How does the AI know about your work?",
      leader: "How does the AI know about your team's work?",
    },
    required: true,
    options: [
      {
        value: 0,
        label: "It doesn't; I start fresh every time",
      },
      {
        value: 1,
        label: "I paste in background when I remember",
      },
      {
        value: 2,
        label: "A saved prompt or instructions I reuse",
      },
      {
        value: 3,
        label: "Projects set up with our docs, examples and style",
      },
      {
        value: 4,
        label: "Connected directly to our files and systems",
      },
    ],
  },
  {
    id: "B3",
    part: "B",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual:
        "Scenario: you need a proposal for a new client in your organization's voice.",
      leader:
        "Scenario: your team needs a proposal for a new client in your organization's voice.",
    },
    required: true,
    options: [
      {
        value: 0,
        label: "Write it myself",
      },
      {
        value: 1,
        label: '"Write me a proposal for X" and edit',
      },
      {
        value: 2,
        label: "Detailed instructions: tone, client, structure",
      },
      {
        value: 3,
        label: "Instructions + 2–3 past proposals as examples",
      },
      {
        value: 4,
        label:
          "A reusable setup that drafts these from our templates and the client's info",
      },
    ],
  },
  {
    id: "B4",
    part: "B",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual:
        "Scenario: every Monday someone exports a report, pastes numbers into a sheet and emails a summary.",
      leader:
        "Scenario: every Monday someone on your team exports a report, pastes numbers into a sheet and emails a summary.",
    },
    required: true,
    options: [
      {
        value: 0,
        label: "That's just part of the job",
      },
      {
        value: 1,
        label: "AI helps write the summary",
      },
      {
        value: 2,
        label: "I know it could be automated but not where to start",
      },
      {
        value: 3,
        label: "I'd sketch it as trigger → steps → output in Zapier/Make/n8n",
      },
      {
        value: 4,
        label: "Things like this already run on their own for us",
      },
    ],
  },
  {
    id: "B5",
    part: "B",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "When AI gets something wrong, what do you do?",
      leader: "When AI gets something wrong, what does your team do?",
    },
    required: true,
    options: [
      {
        value: 0,
        label: "Stop trusting it for that task",
      },
      {
        value: 1,
        label: "Ask again and hope",
      },
      {
        value: 2,
        label: "Fix my prompt: detail, examples, constraints",
      },
      {
        value: 3,
        label: "Build in a check: review step, checklist, second pass",
      },
      {
        value: 4,
        label:
          "Test it systematically against known-good examples before relying on it",
      },
    ],
  },
  {
    id: "C1",
    part: "C",
    kind: "text",
    paths: ["leader", "individual"],
    prompt: {
      individual:
        "If you could hand one recurring task to a reliable AI teammate tomorrow, what would it be?",
      leader:
        "If your team could hand one recurring task to a reliable AI teammate tomorrow, what would it be?",
    },
    required: true,
    maxLength: 280,
    chips: [
      {
        value: "followups",
        label: "Follow-ups & chasing",
      },
      {
        value: "data-entry",
        label: "Data entry between tools",
      },
      {
        value: "same-questions",
        label: "Answering the same questions",
      },
      {
        value: "reports",
        label: "Building reports",
      },
      {
        value: "scheduling",
        label: "Scheduling & intake",
      },
      {
        value: "content",
        label: "Writing content",
      },
    ],
  },
  {
    id: "C2",
    part: "C",
    kind: "choice",
    paths: ["leader", "individual"],
    prompt: {
      individual: "Roughly how many hours a week does it take?",
      leader: "Roughly how many hours a week does it take?",
    },
    required: true,
    options: [
      {
        value: "<2",
        label: "<2",
      },
      {
        value: "2-5",
        label: "2–5",
      },
      {
        value: "5-10",
        label: "5–10",
      },
      {
        value: "10-20",
        label: "10–20",
      },
      {
        value: "20+",
        label: "20+",
      },
    ],
  },
  {
    id: "C3",
    part: "C",
    kind: "number",
    paths: ["leader"],
    prompt: {
      individual: "How many people spend time on it?",
      leader: "How many people spend time on it?",
    },
    required: true,
  },
  {
    id: "C4",
    part: "C",
    kind: "text",
    paths: ["leader", "individual"],
    prompt: {
      individual: "What would you do with that time back?",
      leader: "What would your team do with that time back?",
    },
    required: false,
    maxLength: 280,
  },
  {
    id: "D1",
    part: "D",
    kind: "choice",
    paths: ["leader"],
    prompt: {
      individual:
        "Say we found a way to win those hours back. What would you want?",
      leader:
        "Say we found a way to win those hours back. What would you want?",
    },
    required: true,
    options: [
      {
        value: "diy",
        label: "🎓 Show me how to do it myself",
      },
      {
        value: "with",
        label: "🤝 Build it with us — coach us while we build",
      },
      {
        value: "for",
        label: "🛠️ Have someone build it for us",
      },
      {
        value: "curious",
        label: "👀 Just curious for now",
      },
    ],
  },
  {
    id: "D2",
    part: "D",
    kind: "text",
    paths: ["leader"],
    prompt: {
      individual: "Anything else we should know?",
      leader: "Anything else we should know?",
    },
    required: false,
    maxLength: 500,
  },
];
const EMAIL_BANDS = [
  {
    key: "parked",
    label: "Parked",
    emoji: "🔴",
    min: 0,
    max: 20,
    color: "#ef4444",
    description:
      "AI hasn't entered the workflow yet — which means the biggest gains are still on the table.",
  },
  {
    key: "first-gear",
    label: "First Gear",
    emoji: "🟠",
    min: 21,
    max: 40,
    color: "#f97316",
    description: "You're using AI, but it's still a side tool, not a teammate.",
  },
  {
    key: "cruising",
    label: "Cruising",
    emoji: "🟡",
    min: 41,
    max: 60,
    color: "#f59e0b",
    description:
      "Real daily habits. The next jump is giving AI context and repeatable setups.",
  },
  {
    key: "accelerating",
    label: "Accelerating",
    emoji: "🟢",
    min: 61,
    max: 80,
    color: "#2db56f",
    description:
      "You've built real habits. The next jump is connecting AI to your systems so work runs without you.",
  },
  {
    key: "full-speed",
    label: "Full Speed",
    emoji: "🤩",
    min: 81,
    max: 100,
    color: "#9be4b9",
    description:
      "You build with AI. What's next is making it reliable, measured, and running across the team.",
  },
];
