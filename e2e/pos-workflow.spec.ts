import { expect, test } from "@playwright/test";

test("cashier can build and complete a local sale preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sales register" })).toBeVisible();
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText("Draft total")).toBeVisible();

  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText(/LOCAL-0001 completed locally/)).toBeVisible();
});

test("cashier role cannot save stock adjustment", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "cashier" }).click();
  await page.getByRole("tab", { name: "Stock" }).click();
  await expect(page.getByRole("button", { name: "Save adjustment" })).toBeDisabled();
});
