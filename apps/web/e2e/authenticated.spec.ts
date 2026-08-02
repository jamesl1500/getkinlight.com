import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL as string;
const password = process.env.E2E_USER_PASSWORD as string;

test("a staging member can sign in and navigate their family space", async ({
  page,
}) => {
  await page.goto("/auth/sign-in?next=/dashboard");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Welcome back/i }),
  ).toBeVisible();
  await expect(page.getByText("Private family space")).toBeVisible();

  const seriousViolations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousViolations).toEqual([]);

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});
