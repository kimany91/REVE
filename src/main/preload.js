// Pont sécurisé entre l'interface et le processus principal
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = async (ch, ...a) => {
  const r = await ipcRenderer.invoke(ch, ...a);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

contextBridge.exposeInMainWorld('reve', {
  state: () => call('state'),
  setSettings: (p) => call('settings:set', p),
  moodleLogin: (url) => call('moodle:login', url),
  moodleLogout: () => call('moodle:logout'),
  moodleCourses: () => call('moodle:courses'),
  moodleDownload: (id, name) => call('moodle:download', id, name),
  importDialog: () => call('import:dialog'),
  importFiles: (files) => call('import:paths', files.map((f) => webUtils.getPathForFile(f))),
  updateSubject: (s) => call('subject:update', s),
  deleteSubject: (id) => call('subject:delete', id),
  saveZip: (id) => call('subject:saveZip', id),
  calcBuild: (o) => call('calc:build', o),
  calcExport: (o) => call('calc:export', o),
  calcNumworks: (o) => call('calc:numworks', o),
  openExternal: (u) => call('open:external', u),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, p) => cb(p)),
});
