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

test("draft cancellation requires confirmation and a reason", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("row", { name: /BATH-SHOWER-001/ })
    .getByRole("button", { name: "Add" })
    .click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("dialog", { name: "Cancel draft" })).toBeVisible();
  await page.getByLabel("Reason").selectOption("other");
  await expect(page.getByRole("button", { name: "Confirm cancel" })).toBeDisabled();

  await page.getByLabel("Other reason").fill("Customer changed mind");
  await page.getByRole("button", { name: "Confirm cancel" }).click();

  await expect(
    page.getByText("Draft sale cancelled: Customer changed mind."),
  ).toBeVisible();
  await expect(page.getByText("No items in the draft sale.")).toBeVisible();
});

test("cashier sees manager contact message for completed sale voids", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("row", { name: /BATH-SHOWER-001/ })
    .getByRole("button", { name: "Add" })
    .click();
  await page.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("button", { name: "cashier" }).click();
  await page.getByRole("tab", { name: "Reports" }).click();

  await expect(page.getByRole("button", { name: "Void" })).toBeDisabled();
  await expect(
    page.getByText("Only managers can void completed sales. Contact a manager."),
  ).toBeVisible();
});

test("manager can void a completed local sale", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("row", { name: /BATH-SHOWER-001/ })
    .getByRole("button", { name: "Add" })
    .click();
  await page.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("tab", { name: "Reports" }).click();
  await page.getByRole("button", { name: "Void" }).click();

  await expect(page.getByText("Sale voided locally and stock restored.")).toBeVisible();
  await expect(page.getByText("voided", { exact: true })).toBeVisible();
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
