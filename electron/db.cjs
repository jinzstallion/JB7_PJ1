"use strict";

// Electron main-process owner of the local SQLite database file. It keeps the
// sql.js database in memory and flushes the full binary to disk on every save,
// which is appropriate for a small, single-shop offline dataset.

const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");
const { readWorkshopData, writeWorkshopData, ensureSchema } = require("./sqliteStore.cjs");

const DB_FILE_NAME = "jb7-uae-workshop.sqlite";

let SQL = null;
let db = null;
let dbFilePath = null;

async function init(userDataDir) {
  dbFilePath = path.join(userDataDir, DB_FILE_NAME);

  // Passing the wasm binary directly avoids any runtime file-location lookups,
  // so this works identically inside an asar-packed production build.
  const wasmBinary = fs.readFileSync(require.resolve("sql.js/dist/sql-wasm.wasm"));
  SQL = await initSqlJs({ wasmBinary });

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  ensureSchema(db);
  return dbFilePath;
}

function load() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return readWorkshopData(db);
}

function save(data) {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  writeWorkshopData(db, data);
  flush();
}

function flush() {
  const exported = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(exported));
}

function getPath() {
  return dbFilePath;
}

module.exports = { init, load, save, getPath };
