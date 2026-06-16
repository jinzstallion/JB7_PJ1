import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  createSeedData,
  getDashboardStats,
  getLowStockItems,
  isWorkshopData
} from "./workshop";

describe("workshop domain calculations", () => {
  it("calculates UAE VAT invoice totals and balances", () => {
    const data = createSeedData("2026-06-16");
    const job = data.jobs[0];

    expect(job).toBeDefined();
    const totals = calculateInvoiceTotals(job!, data.settings.vatRate);

    expect(totals.subtotal).toBe(870);
    expect(totals.vat).toBe(43.5);
    expect(totals.total).toBe(913.5);
    expect(totals.balance).toBe(913.5);
  });

  it("summarizes dashboard metrics from local workshop data", () => {
    const data = createSeedData("2026-06-16");
    const stats = getDashboardStats(data, "2026-06-16");

    expect(stats.activeJobs).toBe(1);
    expect(stats.todaysAppointments).toBe(1);
    expect(stats.lowStockCount).toBe(1);
    expect(stats.monthlyRevenue).toBe(540.75);
    expect(stats.outstandingBalance).toBe(934.25);
  });

  it("identifies parts that need reordering", () => {
    const data = createSeedData("2026-06-16");
    const lowStock = getLowStockItems(data.inventory);

    expect(lowStock.map((item) => item.sku)).toEqual(["BRK-PATROL-F"]);
  });

  it("validates importable backup structure", () => {
    const data = createSeedData("2026-06-16");

    expect(isWorkshopData(data)).toBe(true);
    expect(isWorkshopData({ jobs: [] })).toBe(false);
  });
});
