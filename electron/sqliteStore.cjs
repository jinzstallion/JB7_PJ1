"use strict";

// Shared, framework-agnostic SQLite persistence layer for the workshop data.
// Used by the Electron main process (electron/main.cjs) and by the automated
// round-trip test (src/domain/sqliteStore.test.ts). It operates on a sql.js
// Database instance so it stays free of native bindings and cross-builds for
// Windows from any platform.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  emirate TEXT NOT NULL,
  phone TEXT NOT NULL,
  trn TEXT NOT NULL,
  vatRate REAL NOT NULL,
  invoicePrefix TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  emirate TEXT NOT NULL,
  trn TEXT
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  plate TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  vin TEXT NOT NULL,
  odometerKm INTEGER NOT NULL,
  nextServiceKm INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  jobNumber TEXT NOT NULL,
  customerId TEXT NOT NULL,
  vehicleId TEXT NOT NULL,
  status TEXT NOT NULL,
  technician TEXT NOT NULL,
  openedAt TEXT NOT NULL,
  dueAt TEXT NOT NULL,
  complaint TEXT NOT NULL,
  inspection TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  approved INTEGER NOT NULL,
  paidAmount REAL NOT NULL,
  lines TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock REAL NOT NULL,
  reorderLevel REAL NOT NULL,
  unitPrice REAL NOT NULL,
  supplier TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  customerId TEXT NOT NULL,
  vehicleId TEXT NOT NULL,
  service TEXT NOT NULL,
  status TEXT NOT NULL
);
`;

function ensureSchema(db) {
  db.run(SCHEMA);
}

function rowsFor(db, sql) {
  const result = db.exec(sql);
  if (!result.length) {
    return [];
  }
  const { columns, values } = result[0];
  return values.map((row) => {
    const record = {};
    columns.forEach((column, index) => {
      record[column] = row[index];
    });
    return record;
  });
}

// Returns the full WorkshopData, or null when the database has not been seeded.
function readWorkshopData(db) {
  ensureSchema(db);
  const settingsRows = rowsFor(db, "SELECT * FROM settings WHERE id = 1");
  if (!settingsRows.length) {
    return null;
  }
  const settingsRow = settingsRows[0];

  return {
    settings: {
      name: settingsRow.name,
      emirate: settingsRow.emirate,
      phone: settingsRow.phone,
      trn: settingsRow.trn,
      vatRate: settingsRow.vatRate,
      invoicePrefix: settingsRow.invoicePrefix
    },
    customers: rowsFor(db, "SELECT * FROM customers ORDER BY rowid").map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      emirate: row.emirate,
      ...(row.trn === null || row.trn === undefined ? {} : { trn: row.trn })
    })),
    vehicles: rowsFor(db, "SELECT * FROM vehicles ORDER BY rowid").map((row) => ({
      id: row.id,
      customerId: row.customerId,
      plate: row.plate,
      make: row.make,
      model: row.model,
      year: row.year,
      vin: row.vin,
      odometerKm: row.odometerKm,
      nextServiceKm: row.nextServiceKm
    })),
    jobs: rowsFor(db, "SELECT * FROM jobs ORDER BY rowid").map((row) => ({
      id: row.id,
      jobNumber: row.jobNumber,
      customerId: row.customerId,
      vehicleId: row.vehicleId,
      status: row.status,
      technician: row.technician,
      openedAt: row.openedAt,
      dueAt: row.dueAt,
      complaint: row.complaint,
      inspection: row.inspection,
      recommendations: row.recommendations,
      approved: row.approved === 1,
      paidAmount: row.paidAmount,
      lines: JSON.parse(row.lines)
    })),
    inventory: rowsFor(db, "SELECT * FROM inventory ORDER BY rowid").map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      stock: row.stock,
      reorderLevel: row.reorderLevel,
      unitPrice: row.unitPrice,
      supplier: row.supplier
    })),
    appointments: rowsFor(db, "SELECT * FROM appointments ORDER BY rowid").map((row) => ({
      id: row.id,
      date: row.date,
      time: row.time,
      customerId: row.customerId,
      vehicleId: row.vehicleId,
      service: row.service,
      status: row.status
    }))
  };
}

// Replaces the entire database contents with the supplied WorkshopData inside a
// transaction. The dataset is small (single offline shop) so a full rewrite on
// each save mirrors the renderer's "save the whole document" model safely.
function writeWorkshopData(db, data) {
  ensureSchema(db);
  db.run("BEGIN TRANSACTION");
  try {
    db.run(
      "DELETE FROM settings; DELETE FROM customers; DELETE FROM vehicles; DELETE FROM jobs; DELETE FROM inventory; DELETE FROM appointments;"
    );

    runStatement(
      db,
      "INSERT INTO settings (id, name, emirate, phone, trn, vatRate, invoicePrefix) VALUES (1, ?, ?, ?, ?, ?, ?)",
      [
        data.settings.name,
        data.settings.emirate,
        data.settings.phone,
        data.settings.trn,
        data.settings.vatRate,
        data.settings.invoicePrefix
      ]
    );

    for (const customer of data.customers) {
      runStatement(
        db,
        "INSERT INTO customers (id, name, phone, email, emirate, trn) VALUES (?, ?, ?, ?, ?, ?)",
        [customer.id, customer.name, customer.phone, customer.email, customer.emirate, customer.trn ?? null]
      );
    }

    for (const vehicle of data.vehicles) {
      runStatement(
        db,
        "INSERT INTO vehicles (id, customerId, plate, make, model, year, vin, odometerKm, nextServiceKm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          vehicle.id,
          vehicle.customerId,
          vehicle.plate,
          vehicle.make,
          vehicle.model,
          vehicle.year,
          vehicle.vin,
          vehicle.odometerKm,
          vehicle.nextServiceKm
        ]
      );
    }

    for (const job of data.jobs) {
      runStatement(
        db,
        "INSERT INTO jobs (id, jobNumber, customerId, vehicleId, status, technician, openedAt, dueAt, complaint, inspection, recommendations, approved, paidAmount, lines) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          job.id,
          job.jobNumber,
          job.customerId,
          job.vehicleId,
          job.status,
          job.technician,
          job.openedAt,
          job.dueAt,
          job.complaint,
          job.inspection,
          job.recommendations,
          job.approved ? 1 : 0,
          job.paidAmount,
          JSON.stringify(job.lines)
        ]
      );
    }

    for (const item of data.inventory) {
      runStatement(
        db,
        "INSERT INTO inventory (id, sku, name, category, stock, reorderLevel, unitPrice, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.sku, item.name, item.category, item.stock, item.reorderLevel, item.unitPrice, item.supplier]
      );
    }

    for (const appointment of data.appointments) {
      runStatement(
        db,
        "INSERT INTO appointments (id, date, time, customerId, vehicleId, service, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          appointment.id,
          appointment.date,
          appointment.time,
          appointment.customerId,
          appointment.vehicleId,
          appointment.service,
          appointment.status
        ]
      );
    }

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

function runStatement(db, sql, params) {
  const statement = db.prepare(sql);
  try {
    statement.run(params);
  } finally {
    statement.free();
  }
}

module.exports = {
  ensureSchema,
  readWorkshopData,
  writeWorkshopData
};
