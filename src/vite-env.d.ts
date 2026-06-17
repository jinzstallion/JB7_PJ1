/// <reference types="vite/client" />

import type { WorkshopData } from "./domain/workshop";

declare global {
  interface Window {
    // Injected by electron/preload.cjs when running inside the desktop shell.
    // Undefined in a plain browser, where the app falls back to localStorage.
    desktopDB?: {
      isDesktop: true;
      load: () => Promise<WorkshopData | null>;
      save: (data: WorkshopData) => Promise<boolean>;
      getPath: () => Promise<string>;
    };
  }
}

export {};
