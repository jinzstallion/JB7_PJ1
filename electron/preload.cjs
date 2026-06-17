"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Exposes a minimal, promise-based persistence API to the sandboxed renderer.
// The renderer treats this as the source of truth when running on the desktop;
// in a plain browser it is undefined and the app falls back to localStorage.
contextBridge.exposeInMainWorld("desktopDB", {
  isDesktop: true,
  load: () => ipcRenderer.invoke("workshop-db:load"),
  save: (data) => ipcRenderer.invoke("workshop-db:save", data),
  getPath: () => ipcRenderer.invoke("workshop-db:path")
});
