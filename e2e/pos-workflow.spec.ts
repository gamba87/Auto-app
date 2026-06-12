import { expect, test } from "@playwright/test";

test("cashier can build and complete a local sale preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sales register" })).toBeVisible();
  await expect
    .poll(async () => {
      await page
        .getByRole("row", { name: /BATH-SHOWER-001/ })
        .getByRole("button", { name: "Add" })
        .click();

      return page.getByLabel("Quantity for AquaFlow shower head").count();
    })
    .toBe(1);
  await expect(page.getByText("Draft total")).toBeVisible();

  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText(/LOCAL-0001 completed locally/)).toBeVisible();
});

test("cashier role cannot save stock adjustment", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(async () => {
      await page.getByRole("button", { name: "cashier" }).click();
      await page.getByRole("tab", { name: "Stock" }).click();

      return page.getByRole("button", { name: "Save adjustment" }).count();
    })
    .toBe(1);
  await expect(page.getByRole("button", { name: "Save adjustment" })).toBeDisabled();
});

test("admin integrations route shows fiscal outbox status", async ({ page }) => {
  await page.goto("/settings/integrations");

  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(page.getByText("NOT_CONNECTED")).toBeVisible();
  await expect(page.locator("span", { hasText: "sale.completed" })).toBeVisible();
  await expect(page.locator("span", { hasText: "sale.voided" })).toBeVisible();
});

test("stock route shows levels and movement history", async ({ page }) => {
  await page.goto("/stock");

  await expect(page.getByRole("heading", { name: "Stock", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stock levels" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "BATH-SHOWER-001", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Movement history" })).toBeVisible();
  await expect(page.getByText("Development seed opening balance").first()).toBeVisible();
});
