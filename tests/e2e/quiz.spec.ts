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
const leader = { ...individual, A1: "owner", C3: 2, D1: "for", D2: null };
async function seed(page: Page, answers = individual, screen = "gate") {
  await page.addInitScript(
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
  await page.goto("/quiz");
}
async function mock(page: Page, fail = false) {
  await page.route("**/api/quiz", (route) =>
    route.fulfill({
      status: fail ? 500 : 200,
      json: fail ? {} : { ok: true, optinToken: "signed" },
    }),
  );
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
  await page.getByRole("button", { name: "Start the quiz" }).focus();
  await page.keyboard.press("Enter");
  for (const key of ["4", "2", "3", "3", "3", "3", "3"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
  }
  await page.getByRole("textbox").fill("Building reports");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Next", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("3");
  await page.waitForTimeout(300);
  await expect(
    page
      .locator(".quiz-progress")
      .getByText("Question 10 of 10", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Organization")).toHaveCount(0);
  await expect(page.getByLabel("Best number")).toHaveCount(0);
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Email", { exact: true }).fill("jane@example.com");
  await page.getByRole("button", { name: "Show my results" }).click();
  await page
    .getByRole("button", {
      name: "Notify me when the free AI agents course launches",
    })
    .click();
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
  expect(state.contact.organization).toBeNull();
  expect(state.contact.phone).toBeNull();
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
  await seed(page);
  await page.reload();
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
  expect(new Set(ids).size).toBe(1);
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
  test(`screenshots and overflow ${width}`, async ({ page }) => {
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
      await page.screenshot({
        path: `docs/review/quiz-${name}-${width}.png`,
        fullPage: true,
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
