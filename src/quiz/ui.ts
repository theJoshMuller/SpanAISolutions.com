import {
  QUESTIONS,
  CALENDAR_URL,
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  type Answers,
  type QuestionId,
} from "./config";
import {
  sequenceFor,
  nextStep,
  prevStep,
  pruneForPath,
  progress,
} from "./flow";
import { getPath, scoreAll, bandFor, segmentFor, winBack } from "./scoring";
import { renderGauge } from "./gauge";
import { submitQuiz, optIn, type SubmissionPayload } from "./api";
type Screen = "intro" | "gate" | "results" | QuestionId;
interface State {
  screen: Screen;
  answers: Answers;
  submissionId: string;
  startedAt: string;
  contact: SubmissionPayload["contact"];
  optinToken: string | null;
  attribution: SubmissionPayload["attribution"];
  subscribed?: boolean;
}
const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function mountQuiz(root: HTMLElement): void {
  const live = document.createElement("p");
  live.className = "quiz-sr-only";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  root.after(live);
  const params = new URLSearchParams(location.search);
  let state: State = {
    screen: "intro",
    answers: {},
    submissionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    contact: { firstName: "", email: "", organization: null, phone: null },
    optinToken: null,
    attribution: {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      referrer: document.referrer || null,
      landingPath: location.pathname,
    },
  };
  try {
    const saved = JSON.parse(sessionStorage.getItem("span-quiz") || "null");
    if (
      saved &&
      typeof saved === "object" &&
      saved.submissionId &&
      saved.answers &&
      ["intro", "gate", "results", ...QUESTIONS.map((q) => q.id)].includes(
        saved.screen,
      )
    )
      state = { ...state, ...saved };
  } catch {
    /* Storage is optional. */
  }
  let busy = false,
    advancing = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    try {
      sessionStorage.setItem("span-quiz", JSON.stringify(state));
    } catch {
      /* Private browsing still works. */
    }
  };
  const sanitize = () => {
    state.answers = pruneForPath(state.answers);
    if (getPath(state.answers) !== "leader") state.contact.organization = null;
    if (segmentFor(state.answers) !== "discovery") state.contact.phone = null;
  };
  const button = (label: string, action: string, primary = false) =>
    `<button type="button" class="button ${primary ? "button--primary" : ""}" data-action="${action}">${label}</button>`;
  const calendar = (label: string, primary = false) =>
    `<a class="button ${primary ? "button--primary" : ""}" href="${CALENDAR_URL}">${label}</a>`;
  function go(screen: Screen) {
    clearTimeout(timer);
    advancing = false;
    state.screen = screen;
    persist();
    render();
  }
  function gauge(level: number, mini = false) {
    const el = root.querySelector<HTMLElement>("[data-gauge]");
    if (el)
      renderGauge(el, {
        size: mini ? "mini" : "full",
        ...(mini ? { label: "Progress" } : {}),
      }).set(level, !mini && state.screen !== "intro");
    if (mini)
      el?.querySelector("svg")?.setAttribute(
        "aria-label",
        `Quiz progress ${Math.round(level)} percent`,
      );
  }
  function render() {
    sanitize();
    persist();
    const a = state.answers;
    const result = scoreAll(a);
    const band = bandFor(result.aiLevel);
    if (state.screen === "intro") {
      root.innerHTML = `<div class="quiz-intro"><div><p class="eyebrow">AI LEVEL QUIZ · 3 MINUTES</p><h1 tabindex="-1">What's your AI level, and what's it costing you?</h1><p class="lead">Answer a few quick questions. Get your score from 0–100, see where you're strong, and find out how many hours a year you could win back.</p><div class="actions">${button("Start the quiz", "start", true)}</div><p><a class="text-link" href="${CALENDAR_URL}">Rather just talk? Grab a time →</a></p></div><div class="quiz-intro-gauge" data-gauge aria-hidden="true"></div></div><ol class="quiz-takeaways"><li><span>01</span><h2>Your AI Level</h2><p>Where you are, from 0–100.</p></li><li><span>02</span><h2>Your 5-skill breakdown</h2><p>What's working. What to try next.</p></li><li><span>03</span><h2>Your win-back + 2 ideas</h2><p>More time for the work that matters.</p></li></ol>`;
      gauge(35);
    } else if (state.screen === "gate" || state.screen === "results") {
      const full = state.screen === "results";
      root.innerHTML = `<div class="quiz-result-top"><div><p class="eyebrow">YOUR AI LEVEL</p><h1 tabindex="-1">${full ? "Your full results" : band.label}</h1><p class="lead">${escape(band.description)}</p></div><div data-gauge></div></div>${full ? `<div class="quiz-result-grid"><section class="card"><h2>Your 5-skill breakdown</h2>${result.skills.map((s) => `<div class="quiz-skill"><div><strong>${s.label}</strong><span>${s.value}/100</span></div><meter min="0" max="100" value="${s.value}" aria-label="${s.label}">${s.value}</meter><p>${escape(s.tip)}</p></div>`).join("")}</section><section class="card quiz-win"><p class="eyebrow">YOUR POTENTIAL WIN-BACK</p><h2>${result.hoursPerYear.toLocaleString("en-CA")} hours/year</h2><p class="quiz-money" data-testid="dollars">$${result.dollarsPerYear.toLocaleString("en-CA")}/year</p><label for="quiz-rate">Your hourly rate: <output id="rate-output">$40</output></label><input id="quiz-rate" type="range" min="${RATE_MIN}" max="${RATE_MAX}" step="${RATE_STEP}" value="40"><p>Estimate assumes 48 working weeks and 60% of this recurring task can be automated. Actual savings will vary.</p></section></div><p class="quiz-mail">📬 Your 2 tailored ideas are on their way to your inbox.</p><div class="quiz-ctas">${result.segment !== "course" ? calendar("Grab a time to map your win-back →", result.segment === "discovery") : ""}${button(state.subscribed ? "✓ You're on the list" : state.optinToken ? "Notify me when the free AI agents course launches" : "Try again", "optin", result.segment === "course")}${result.segment === "course" ? calendar("Running a team? Grab a time.") : ""}</div><p data-status role="status"></p>` : `<div class="quiz-unlock"><div class="quiz-blur" aria-hidden="true"><h2>Your 5-skill breakdown</h2><div></div><div></div><div></div><h2>Your win-back: $••,•••/year</h2></div><form class="card quiz-gate"><h2>Unlock your full results</h2><p>We'll email you a copy, plus 2 ideas for your task.</p><div class="form-grid">${field("firstName", "First name", "text", 80, true)}${field("email", "Email", "email", 254, true)}${getPath(a) === "leader" ? field("organization", "Organization", "text", 120, true) : ""}${result.segment === "discovery" ? field("phone", "Best number to reach you (optional)", "tel", 40, false) : ""}</div><div hidden><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="button button--primary" type="submit">Show my results →</button><p class="quiz-privacy">Your results, your next steps. <a href="/privacy">Privacy policy</a></p></form></div><div class="actions">${button("Back", "back")}</div>`}`;
      gauge(result.aiLevel);
      if (full && state.subscribed)
        root.querySelector<HTMLButtonElement>(
          '[data-action="optin"]',
        )!.disabled = true;
    } else {
      const q = QUESTIONS.find((q) => q.id === state.screen)!;
      const path = getPath(a);
      const sequence = sequenceFor(a);
      const index = sequence.indexOf(q.id);
      const pct = progress(a, q.id) * 100;
      root.innerHTML = `<div class="quiz-progress"><div><p>Question ${index + 1} of ${sequence.length}</p><div class="quiz-track"><span style="width:${pct}%"></span></div></div><div data-gauge></div></div><form class="quiz-question"><p class="eyebrow">PART ${q.part} · ${q.part === "B" ? "YOUR AI LEVEL" : q.part === "A" ? "ABOUT YOU" : "YOUR TIME BACK"}</p><h1 tabindex="-1">${escape(q.prompt[path])}</h1>${q.helper ? `<p class="quiz-helper">${escape(q.helper)}</p>` : ""}${q.kind === "choice" ? `<div class="quiz-options">${q.options!.map((o, i) => `<button type="button" data-choice="${i}" class="quiz-option" aria-pressed="${a[q.id] === o.value}"><span class="quiz-badge">${String.fromCharCode(65 + i)}</span><span>${escape(typeof o.label === "string" ? o.label : o.label[path])}</span><kbd>${i + 1}</kbd></button>`).join("")}</div><p class="quiz-helper">Choose an answer or press ${q.options!.map((_, i) => i + 1).join(", ")}.</p>` : `${q.chips ? `<div class="quiz-chips">${q.chips.map((c, i) => `<button type="button" data-chip="${i}" class="button">${escape(c.label)}</button>`).join("")}</div>` : ""}<label class="quiz-input-label" for="quiz-answer">${q.required ? "Your answer" : "Your answer (optional)"}</label>${q.kind === "number" ? `<input id="quiz-answer" type="number" min="1" max="500" step="1" required value="${escape(a[q.id] ?? 1)}">` : `<textarea id="quiz-answer" rows="4" maxlength="${q.maxLength}" ${q.required ? 'required minlength="10"' : ""}>${escape(a[q.id])}</textarea>`}`}<div class="actions">${button("Back", "back")}${q.kind !== "choice" ? '<button type="submit" class="button button--primary">Next</button>' : ""}</div></form>`;
      gauge(pct, true);
    }
    root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    live.textContent =
      root.querySelector(".quiz-progress p")?.textContent ??
      root.querySelector("h1")?.textContent ??
      "";
  }
  function field(
    name: keyof State["contact"],
    label: string,
    type: string,
    max: number,
    required: boolean,
  ) {
    return `<label>${label}<input name="${name}" type="${type}" autocomplete="${name === "firstName" ? "given-name" : name === "organization" ? "organization" : type}" maxlength="${max}" ${required ? "required" : ""} value="${escape(state.contact[name])}"></label>`;
  }
  function choose(index: number) {
    if (advancing || ["intro", "gate", "results"].includes(state.screen))
      return;
    const q = QUESTIONS.find((q) => q.id === state.screen)!;
    const option = q.options?.[index];
    if (!option) return;
    Object.assign(state.answers, { [q.id]: option.value });
    sanitize();
    persist();
    advancing = true;
    root
      .querySelectorAll<HTMLButtonElement>("[data-choice]")
      .forEach((b, i) => b.setAttribute("aria-pressed", String(i === index)));
    timer = setTimeout(() => go(nextStep(state.answers, q.id)), 250);
  }
  async function submit() {
    if (busy) return;
    busy = true;
    try {
      const response = await submitQuiz({
        submissionId: state.submissionId,
        startedAt: state.startedAt,
        answers: state.answers,
        contact: state.contact,
        attribution: state.attribution,
        website:
          root.querySelector<HTMLInputElement>('[name="website"]')?.value || "",
      });
      if (response.ok) state.optinToken = response.optinToken;
      persist();
    } finally {
      busy = false;
    }
  }
  root.addEventListener("click", async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!target) return;
    if (target.dataset.choice !== undefined) {
      choose(Number(target.dataset.choice));
      return;
    }
    if (target.dataset.chip !== undefined) {
      const q = QUESTIONS.find((q) => q.id === state.screen)!;
      const chip = q.chips![Number(target.dataset.chip)];
      state.answers.C1 = chip.label;
      state.answers.C1chip = chip.value;
      const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
      input.value = chip.label;
      input.setCustomValidity("");
      persist();
      return;
    }
    switch (target.dataset.action) {
      case "start":
        go("A1");
        break;
      case "back":
        if (busy) return;
        if (state.screen === "gate") go(sequenceFor(state.answers).at(-1)!);
        else if (state.screen !== "intro" && state.screen !== "results")
          go(prevStep(state.answers, state.screen));
        break;
      case "optin":
        if (busy || state.subscribed) return;
        target.setAttribute("disabled", "");
        target.textContent = "Working…";
        if (!state.optinToken) await submit();
        if (state.optinToken) {
          busy = true;
          try {
            state.subscribed = await optIn({
              submissionId: state.submissionId,
              email: state.contact.email,
              token: state.optinToken,
            });
          } finally {
            busy = false;
          }
        }
        persist();
        render();
        if (!state.subscribed) {
          root.querySelector("[data-status]")!.textContent =
            "That did not go through. Please try again.";
          root.querySelector('[data-action="optin"]')!.textContent =
            "Try again";
        }
        break;
    }
  });
  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    target.setCustomValidity?.("");
    if (target.name in state.contact) {
      Object.assign(state.contact, { [target.name]: target.value });
      persist();
    }
    if (target.id === "quiz-answer") {
      Object.assign(state.answers, {
        [state.screen]:
          target.type === "number" ? Number(target.value) : target.value,
      });
      if (state.screen === "C1") state.answers.C1chip = null;
      persist();
    }
    if (target.id === "quiz-rate") {
      const rate = Number(target.value);
      root.querySelector("#rate-output")!.textContent = `$${rate}`;
      root.querySelector('[data-testid="dollars"]')!.textContent =
        `$${winBack(state.answers, rate).dollarsPerYear.toLocaleString("en-CA")}/year`;
    }
  });
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (state.screen === "gate") {
      const form = event.target as HTMLFormElement;
      for (const field of form.querySelectorAll<HTMLInputElement>(
        "input[required]",
      )) {
        field.value = field.value.trim();
      }
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      state.contact = {
        firstName: String(data.get("firstName")).trim(),
        email: String(data.get("email")).trim().toLowerCase(),
        organization:
          getPath(state.answers) === "leader"
            ? String(data.get("organization")).trim()
            : null,
        phone:
          segmentFor(state.answers) === "discovery"
            ? String(data.get("phone") || "").trim() || null
            : null,
      };
      persist();
      const btn = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
      btn.disabled = true;
      btn.textContent = "Preparing your results…";
      await submit();
      go("results");
    } else if (state.screen !== "intro" && state.screen !== "results") {
      const q = QUESTIONS.find((q) => q.id === state.screen)!;
      const input = root.querySelector<HTMLInputElement>("#quiz-answer");
      if (input) {
        if (q.id === "C1" && input.value.trim().length < 10) {
          input.setCustomValidity(
            "Enter at least 10 characters or choose a task above.",
          );
        }
        if (!input.reportValidity()) return;
        Object.assign(state.answers, {
          [q.id]:
            q.kind === "number"
              ? Number(input.value)
              : input.value.trim() || null,
        });
      }
      go(nextStep(state.answers, q.id));
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)
    )
      return;
    if (/^[1-6]$/.test(event.key)) {
      event.preventDefault();
      choose(Number(event.key) - 1);
    }
  });
  render();
}
