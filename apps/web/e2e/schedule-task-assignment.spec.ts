import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL as string;
const password = process.env.E2E_USER_PASSWORD as string;

test("a household member can claim and unclaim a schedule task", async ({
  page,
}) => {
  await page.goto("/auth/sign-in?next=/calendar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/calendar$/);

  const title = `PT appointment ${Date.now()}`;
  await page.getByRole("button", { name: "Add schedule item" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add to calendar" }).click();

  await page
    .getByRole("button", { name: `View ${title} details` })
    .click();

  await expect(page.getByText("Unclaimed")).toBeVisible();
  await page.getByRole("button", { name: "Claim this task" }).click();

  await expect(page.getByText("Unclaimed")).toHaveCount(0);
  const unclaimButton = page.getByRole("button", { name: "Unclaim" });
  await expect(unclaimButton).toBeVisible();

  await unclaimButton.click();
  await expect(page.getByText("Unclaimed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim this task" })).toBeVisible();
});
