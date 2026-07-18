const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("frontendEditorDesktop", Object.freeze({
  platform: process.platform,
  readWorkspace: () => ipcRenderer.invoke("desktop:workspace"),
  onOpenProject: (listener) => {
    const handler = (_event, path) => listener(path);
    ipcRenderer.on("desktop:open-project", handler);
    return () => ipcRenderer.removeListener("desktop:open-project", handler);
  },
}));

