const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveDataBackup: (data) => ipcRenderer.invoke('save-data-backup', data),
    restoreData: () => ipcRenderer.invoke('restore-data-backup')
});

