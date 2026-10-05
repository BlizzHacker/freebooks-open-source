'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('freebooks', Object.freeze({
  profiles: () => ipcRenderer.invoke('profiles:list'),
  saveProfile: profile => ipcRenderer.invoke('profiles:save', profile),
  removeProfile: id => ipcRenderer.invoke('profiles:remove', id),
  openProfile: id => ipcRenderer.invoke('profiles:open', id),
  openBrowser: id => ipcRenderer.invoke('profiles:browser', id),
  startLocal: () => ipcRenderer.invoke('local:start'),
  createOwner: values => ipcRenderer.invoke('local:owner', values),
  onProgress: callback => {
    const handler = (_event, text) => callback(text);
    ipcRenderer.on('local:progress', handler);
    return () => ipcRenderer.removeListener('local:progress', handler);
  }
}));
