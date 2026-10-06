const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: store => ipcRenderer.invoke('store:save', store),
  restoreStore: () => ipcRenderer.invoke('store:restore'),
  exportJson: store => ipcRenderer.invoke('store:exportJson', store),
  exportXlsx: sheets => ipcRenderer.invoke('export:xlsx', sheets),
  whatsapp: phone => ipcRenderer.invoke('shell:whatsapp', phone),
  openDataFolder: () => ipcRenderer.invoke('shell:openDataFolder'),
  printDoc: opts => ipcRenderer.invoke('print:doc', opts),
  useRegion: dir => ipcRenderer.invoke('region:use', dir),
  openRegion: () => ipcRenderer.invoke('region:open'),
  openRegionFolder: () => ipcRenderer.invoke('region:openFolder'),
  saveRegion: obj => ipcRenderer.invoke('region:saveJson', obj)
});
