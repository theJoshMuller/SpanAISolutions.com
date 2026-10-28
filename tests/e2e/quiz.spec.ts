import { test, expect, type Page } from "@playwright/test";
const individual = {
  A1: "member",
  A2: "2-9",
  B1: 2,
  B2: 2,
  B3: 2,
  B4: 2,
  B5: 2,
  C1: "Building reports",
  C2: "5-10",
  C4: null,
};
const leader = { ...individual, A1: "owner", C3: 2, D1: "for", D2: "We need reliable reporting" };
async function seed(page: Page, answers = individual, screen = "gate") {
  await page.goto("/quiz");
  await page.evaluate(
    ({ answers, screen }) =>
      sessionStorage.setItem(
        "span-quiz",
        JSON.stringify({
          screen,
          answers,
          submissionId: "aa991257-2d1d-44e4-a9da-b9de9648bb9e",
          startedAt: new Date().toISOString(),
          contact: {
            firstName: "Jane",
            email: "jane@example.com",
            organization: "Acme",
            phone: "123",
          },
          optinToken: null,
        }),
      ),
    { answers, screen },
  );
  await page.reload();
}
async function mock(page: Page, fail = false) {
  await page.route("**/api/quiz", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      json: fail ? {} : { ok: true, optinToken: "signed" },
    }),
  );
}
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}
test("individual keyboard path has all 10 questions and course opt-in", async ({
  page,
}) => {
  await mock(page);
  let body: any;
  await page.route("**/api/optin", (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({ json: { ok: true } });
  });
  await page.goto("/quiz");
  await tabTo(page, page.getByRole("button", { name: "Start the quiz" }));
  await page.keyboard.press("Enter");
  for (const key of ["4", "2", "3", "3", "3", "3", "3"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
  }
  await tabTo(page, page.getByRole("textbox"));
  await page.keyboard.type("short");
  await tabTo(page, page.getByRole("button", { name: "Next", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Building reports");
  await tabTo(page, page.getByRole("button", { name: "Next", exact: true }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("3");
  await page.waitForTimeout(300);
  await expect(
    page
      .locator(".quiz-progress")
      .getByText("Question 10 of 10", { exact: true }),
  ).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "Next", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Organization")).toHaveCount(0);
  await expect(page.getByLabel("Best number")).toHaveCount(0);
  await tabTo(page, page.getByLabel("First name"));
  await page.keyboard.type("Jane");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.type("invalid");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("jane@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your full results" })).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "Notify me when the free AI agents course launches" }));
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("✓ You're on the list", { exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({ email: "jane@example.com", token: "signed" });
  expect(body.submissionId).toBeTruthy();
});
test("leader discovery gate and calendar", async ({ page }) => {
  await mock(page);
  await seed(page, leader);
  await expect(page.getByLabel("Organization")).toBeVisible();
  await expect(page.getByLabel("Best number")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page
      .locator(".quiz-progress")
      .getByText("Question 13 of 13", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Show my results" }).click();
  await expect(
    page.getByRole("link", { name: "Grab a time to map your win-back" }),
  ).toHaveAttribute("href", "https://calendar.app.google/bNDHFsbv5cj88RzPA");
  await expect(page.getByText(/Kami will|we'll call/i)).toHaveCount(0);
});
test("leader team size rejects values outside the integer range", async ({ page }) => {
  await seed(page, leader, "C3");
  const input = page.getByRole("spinbutton");
  for (const value of ["0", "501", "1.5"]) {
    await input.fill(value);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(input).toBeFocused();
    expect(await input.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  }
  await input.fill("2");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(input).toHaveCount(0);
});
test("role change prunes leader answers and contact", async ({ page }) => {
  await mock(page);
  await seed(page, leader);
  for (let i = 0; i < 13; i++)
    await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.keyboard.press("4");
  await page.waitForTimeout(300);
  const state = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("span-quiz")!),
  );
  expect(state.answers.C3).toBeUndefined();
  expect(state.answers.D1).toBeUndefined();
  expect(state.answers.D2).toBeUndefined();
  expect(state.contact.organization).toBeNull();
  expect(state.contact.phone).toBeNull();
  // Continue the current path all the way back to its gate.
  for (const key of ["2", "3", "3", "3", "3", "3"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.keyboard.press("3");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Organization")).toHaveCount(0);
  await expect(page.getByLabel("Best number")).toHaveCount(0);
});
test("double submit, refresh and failed submission retry keep one id", async ({
  page,
}) => {
  let hits = 0;
  const ids: string[] = [];
  await page.route("**/api/quiz", async (r) => {
    hits++;
    ids.push(r.request().postDataJSON().submissionId);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await r.fulfill({
      status: hits === 1 ? 500 : 200,
      json: { ok: true, optinToken: "signed" },
    });
  });
  await page.route("**/api/optin", (r) => r.fulfill({ json: { ok: true } }));
  await page.goto("/quiz");
  const originalId = await page.evaluate(() => JSON.parse(sessionStorage.getItem("span-quiz")!).submissionId);
  expect(originalId).toMatch(/^[0-9a-f-]{36}$/);
  await page.evaluate((answers) => {
    const saved = JSON.parse(sessionStorage.getItem("span-quiz")!);
    saved.screen = "gate";
    saved.answers = answers;
    saved.contact = { firstName: "Jane", email: "jane@example.com", organization: null, phone: null };
    sessionStorage.setItem("span-quiz", JSON.stringify(saved));
  }, individual);
  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("Jane");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("span-quiz")!).submissionId)).toBe(originalId);
  await page.getByRole("button", { name: "Show my results" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Your full results" }),
  ).toBeVisible();
  expect(hits).toBe(1);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("✓ You're on the list", { exact: true }),
  ).toBeVisible();
  expect(hits).toBe(2);
  expect(ids).toEqual([originalId, originalId]);
});
test("pending submission freezes contact and keeps the signed opt-in email", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let submitted: any;
  let optedIn: any;
  await page.route("**/api/quiz", async (route) => {
    submitted = route.request().postDataJSON();
    await pending;
    await route.fulfill({ json: { ok: true, optinToken: "signed-for-jane" } });
  });
  await page.route("**/api/optin", (route) => {
    optedIn = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await seed(page);
  await page.getByRole("button", { name: "Show my results" }).click();
  await expect.poll(() => submitted?.contact.email).toBe("jane@example.com");
  const email = page.getByLabel("Email", { exact: true });
  // Try a real keyboard edit while the mocked response is held open.
  await email.click({ force: true });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("edited@example.com");
  await expect(email).toBeDisabled();
  await expect(email).toHaveValue("jane@example.com");
  release();
  await page.getByRole("button", { name: "Notify me when the free AI agents course launches" }).click();
  await expect(page.getByText("✓ You're on the list", { exact: true })).toBeVisible();
  expect(optedIn).toEqual({ submissionId: submitted.submissionId, email: submitted.contact.email, token: "signed-for-jane" });
});
test("rate slider and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mock(page);
  await seed(page);
  await page.getByRole("button", { name: "Show my results" }).click();
  await expect(
    page.getByRole("img", { name: "AI Level 50 of 100, Cruising" }),
  ).toBeVisible();
  await page.getByRole("slider").fill("100");
  await expect(page.getByTestId("dollars")).toHaveText("$21,600/year");
});
for (const width of [1280, 375])
  test(`screenshots and overflow ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto("/quiz");
    const shot = async (name: string) => {
      await page.waitForTimeout(1300);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (testInfo.project.name !== "desktop") return;
      await page.screenshot({
        path: `docs/review/quiz-${name}-${width}.png`,
        fullPage: true,
        scale: "css",
      });
    };
    await shot("intro");
    await page.getByRole("button", { name: "Start the quiz" }).click();
    await shot("question");
    await seed(page);
    await shot("teaser");
    await page.getByRole("button", { name: "Show my results" }).click();
    await expect(
      page.getByRole("heading", { name: "Your full results" }),
    ).toBeVisible();
    await shot("results");
  });

test("sixth role option and unavailable storage remain usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/quiz");
  await page.getByRole("button", { name: "Start the quiz" }).click();
  await page.keyboard.press("6");
  await expect(
    page.getByRole("heading", {
      name: "How many people are on your team or in your organization?",
    }),
  ).toBeVisible();
});

test('email opt-in confirms and posts link parameters', async ({ page }) => {
  await page.route('**/api/optin', async route => {
    expect(route.request().postDataJSON()).toEqual({ submissionId: 'test-id', email: 'jane@example.com', token: 'signed' });
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/quiz/subscribed?s=test-id&e=jane%40example.com&t=signed');
  await expect(page.getByRole('heading', { name: "You're on the list ✓" })).toBeVisible();
});
test('email opt-in rejects invalid links without a retry', async ({ page }) => {
  await page.route('**/api/optin', route => route.fulfill({ status: 403, json: { ok: false } }));
  await page.goto('/quiz/subscribed?s=test-id&e=jane%40example.com&t=bad');
  await expect(page.getByText("This link didn't work — try the button on your results again.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});
test('email opt-in retries a network failure', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/optin', route => ++calls === 1 ? route.abort() : route.fulfill({ json: { ok: true } }));
  await page.goto('/quiz/subscribed?s=test-id&e=jane%40example.com&t=signed');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list ✓" })).toBeVisible();
});
test('quiz links and privacy notice are integrated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.desktop-nav a[href="/quiz"]')).toHaveText('AI Level Quiz');
  await expect(page.locator('main').getByRole('link', { name: "What's your AI level? Take the quiz →" })).toHaveAttribute('href', '/quiz');
  await page.goto('/privacy');
  await expect(page.locator('main')).not.toContainText('being updated');
  await expect(page.locator('main')).toContainText('hello@spanaisolutions.com');
});

test('missing email opt-in parameters do not send a request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/optin', route => { requests++; return route.fulfill({ json: { ok: true } }); });
  await page.goto('/quiz/subscribed?s=test-id');
  await expect(page.getByText("This link didn't work — try the button on your results again.")).toBeVisible();
  expect(requests).toBe(0);
});
test('shared quiz navigation renders on desktop and mobile', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: width === 375 ? 'Mobile navigation' : 'Primary navigation' });
    if (width === 375) await page.locator('.mobile-nav summary').click();
    await expect(nav.getByRole('link', { name: 'AI Level Quiz' })).toBeVisible();
    await page.screenshot({ path: `docs/review/quiz-header-${width}.png`, fullPage: false });
    await nav.getByRole('link', { name: 'AI Level Quiz' }).click();
    await expect(page).toHaveURL(/\/quiz\/?$/);
  }
});

test('temporary opt-in service errors offer retry', async ({ page }) => {
  await page.route('**/api/optin', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.goto('/quiz/subscribed?s=test-id&e=jane%40example.com&t=signed');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText("This link didn't work — try the button on your results again.")).toHaveCount(0);
});
