import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  {
    path: "/",
    heading: /One bright home for care updates/i,
  },
  {
    path: "/features",
    heading: "Purpose-built for caring families",
  },
  {
    path: "/how-it-works",
    heading: "From scattered threads to one shared rhythm",
  },
  {
    path: "/pricing",
    heading: "Simple plans for real life",
  },
  {
    path: "/about",
    heading: "We built the tool we wished our own families had",
  },
  {
    path: "/faq",
    heading: "Answers before you sign up",
  },
  {
    path: "/contact",
    heading: "Talk to a real person",
  },
] as const;

for (const page of pages) {
  test(`${page.path} is accessible and fits the viewport`, async ({
    page: browserPage,
  }) => {
    await browserPage.goto(page.path);

    await expect(
      browserPage.getByRole("heading", { level: 1, name: page.heading }),
    ).toBeVisible();
    await expect(
      browserPage.getByRole("link", { name: "Kinlight", exact: true }).first(),
    ).toBeVisible();

    const horizontalOverflow = await browserPage.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page: browserPage }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("public navigation is operable", async ({ page }) => {
  await page.goto("/");

  if (!test.info().project.use.isMobile) {
    await page.keyboard.press("Tab");
    const focusedLink = page.locator("a:focus");
    await expect(focusedLink).toBeVisible();
    await expect(focusedLink).toHaveAttribute(
      "href",
      expect.stringMatching(/^\//),
    );
  }

  await page
    .getByRole("link", { name: "Features", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/features$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Purpose-built for caring families",
    }),
  ).toBeVisible();
});

test("public responses include baseline security headers", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response?.headers()["permissions-policy"]).toContain("camera=()");
});
