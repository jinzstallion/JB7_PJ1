import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { readWorkshopData, writeWorkshopData } from "../../electron/sqliteStore.cjs";
import { createSeedData } from "./workshop";

describe("sqlite workshop store", () => {
  it("round-trips workshop data through a real SQLite database file", async () => {
    const SQL = await initSqlJs();
    const seed = createSeedData("2026-06-16");

    const writer = new SQL.Database();
    writeWorkshopData(writer, seed);
    const fileBytes = writer.export();
    writer.close();

    // Re-open from the exported bytes to prove persistence survives a file
    // write/read cycle, exactly as the desktop app does on disk.
    const reader = new SQL.Database(fileBytes);
    const restored = readWorkshopData(reader);
    reader.close();

    expect(restored).toEqual(seed);
  });

  it("returns null for an empty (unseeded) database", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    expect(readWorkshopData(db)).toBeNull();
    db.close();
  });

  it("persists newly added records across a save/load cycle", async () => {
    const SQL = await initSqlJs();
    const data = createSeedData("2026-06-16");
    data.customers.push({
      id: "cust-falcon",
      name: "Falcon Logistics LLC",
      phone: "+971 52 778 3322",
      email: "ops@falconlogistics.ae",
      emirate: "Abu Dhabi"
    });

    const writer = new SQL.Database();
    writeWorkshopData(writer, data);
    const bytes = writer.export();
    writer.close();

    const reader = new SQL.Database(bytes);
    const restored = readWorkshopData(reader);
    reader.close();

    expect(restored?.customers.map((customer) => customer.name)).toContain("Falcon Logistics LLC");
    expect(restored?.customers).toHaveLength(3);
  });
});
