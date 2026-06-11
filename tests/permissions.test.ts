import { describe, expect, it } from "vitest";
import {
  canAdjustStock,
  canCompleteSale,
  canManageProducts,
  canVoidCompletedSale,
  getRoleFromAppMetadata,
} from "@/lib/permissions/roles";

describe("role helpers", () => {
  it("allows cashiers to complete sales but not void them", () => {
    expect(canCompleteSale("cashier")).toBe(true);
    expect(canVoidCompletedSale("cashier")).toBe(false);
  });

  it("allows managers to manage products and stock", () => {
    expect(canManageProducts("manager")).toBe(true);
    expect(canAdjustStock("manager")).toBe(true);
  });

  it("reads role from app metadata and falls back to cashier", () => {
    expect(getRoleFromAppMetadata({ role: "admin" })).toBe("admin");
    expect(getRoleFromAppMetadata({ role: "owner" })).toBe("cashier");
    expect(getRoleFromAppMetadata(undefined)).toBe("cashier");
  });
});
