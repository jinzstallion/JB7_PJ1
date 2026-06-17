const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("node:path");
const workshopDb = require("./db.cjs");

function registerDbHandlers() {
  ipcMain.handle("workshop-db:load", () => workshopDb.load());
  ipcMain.handle("workshop-db:save", (_event, data) => {
    workshopDb.save(data);
    return true;
  });
  ipcMain.handle("workshop-db:path", () => workshopDb.getPath());
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 780,
    title: "JB7 UAE Auto Workshop",
    backgroundColor: "#07111f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  await workshopDb.init(app.getPath("userData"));
  registerDbHandlers();

  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
