const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frontendEditorDesktop", Object.freeze({
  platform: process.platform,
  readWorkspace: () => ipcRenderer.invoke("desktop:workspace"),
  getUpdateStatus: () => ipcRenderer.invoke("desktop:update-status"),
  captureRegion: (bounds) => ipcRenderer.invoke("desktop:capture-region", bounds),
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("desktop:update-status", handler);
    return () => ipcRenderer.removeListener("desktop:update-status", handler);
  },
  onOpenProject: (listener) => {
    const handler = (_event, path) => listener(path);
    ipcRenderer.on("desktop:open-project", handler);
    return () => ipcRenderer.removeListener("desktop:open-project", handler);
  },
}));
