// REVE - processus principal (fenêtres, fichiers, Moodle, calculatrices)
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { Moodle } = require('./moodle');
const { readZip, fileToBlocks, SUPPORTED } = require('./extract');
const { summarizeDocuments, cleanTitle } = require('./analyzer/summarize');
const { buildScript, MODELS, NUMWORKS_KEYS } = require('./calc/generate');

app.setName('REVE');
if (process.env.REVE_USERDATA) app.setPath('userData', process.env.REVE_USERDATA);
const DATA_DIR = () => app.getPath('userData');
const DB = () => path.join(DATA_DIR(), 'reve.json');
const COURSES_DIR = () => path.join(DATA_DIR(), 'cours');

// ---------- Sauvegarde locale ----------
let state = { settings: { model: 'numworks', key: 'toolbox' }, moodle: {}, subjects: [] };
function load() {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(DB(), 'utf8')) };
    if (state.moodle && state.moodle.tokenEnc && safeStorage.isEncryptionAvailable()) {
      state.moodle.token = safeStorage.decryptString(Buffer.from(state.moodle.tokenEnc, 'base64'));
    }
  } catch { /* premier lancement */ }
}
function save() {
  const copy = JSON.parse(JSON.stringify(state));
  if (copy.moodle && copy.moodle.token && safeStorage.isEncryptionAvailable()) {
    copy.moodle.tokenEnc = safeStorage.encryptString(copy.moodle.token).toString('base64');
    delete copy.moodle.token;
  }
  fs.mkdirSync(DATA_DIR(), { recursive: true });
  fs.writeFileSync(DB(), JSON.stringify(copy, null, 1));
}
const store = { get: () => state, set: (patch) => { state = { ...state, ...patch }; save(); } };
const moodle = new Moodle(store);

const safeName = (s) => (s || 'sans-nom').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let win;
function progress(p) { if (win && !win.isDestroyed()) win.webContents.send('progress', p); }

function publicState() {
  const m = state.moodle || {};
  return {
    settings: state.settings,
    moodle: { url: m.url || '', connected: !!m.mode, siteName: m.siteName, user: m.user, mode: m.mode },
    subjects: state.subjects,
    moodleCourses: state.moodleCourses || [],
    models: Object.fromEntries(Object.entries(MODELS).map(([k, v]) => [k, { name: v.name, budget: v.defaultBudget }])),
    numworksKeys: Object.fromEntries(Object.entries(NUMWORKS_KEYS).map(([k, v]) => [k, v.label])),
  };
}

function upsertSubject(sub) {
  const i = state.subjects.findIndex((s) => (sub.courseId && s.courseId === sub.courseId) || s.id === sub.id || (!sub.courseId && !s.courseId && s.name === sub.name));
  if (i >= 0) state.subjects[i] = { ...state.subjects[i], ...sub, id: state.subjects[i].id };
  else state.subjects.push({ id: newId(), ...sub });
  save();
  return state.subjects[i >= 0 ? i : state.subjects.length - 1];
}

async function analyzeGroups(groups, extra = {}) {
  const out = [];
  let k = 0;
  for (const [name, docs] of groups) {
    progress({ step: 'analyse', label: `Analyse de « ${name} » par REVE-Net…`, done: k++, total: groups.size });
    const chapters = summarizeDocuments(docs).map((c) => ({ id: newId(), ...c }));
    out.push(upsertSubject({ name: extra.name || cleanTitle(name), chapters, analyzedAt: Date.now(), files: docs.map((d) => d.name), ...extra }));
  }
  progress(null);
  return out;
}

async function importZipFile(file, opts = {}) {
  const buf = fs.readFileSync(file);
  const { groups } = await readZip(buf, path.basename(file), (p) => progress({ step: 'lecture', label: `Lecture : ${p.file}`, done: p.done, total: p.total }), opts);
  return analyzeGroups(groups, opts.extra || { zipPath: file, source: 'zip' });
}

async function importLooseFiles(files) {
  const docs = [];
  for (const [i, f] of files.entries()) {
    progress({ step: 'lecture', label: `Lecture : ${path.basename(f)}`, done: i, total: files.length });
    docs.push({ name: path.basename(f), blocks: await fileToBlocks(f, fs.readFileSync(f)) });
  }
  const name = path.basename(path.dirname(files[0]));
  return analyzeGroups(new Map([[name, docs]]), { source: 'fichiers' });
}

async function importPaths(paths) {
  const zips = paths.filter((p) => /\.zip$/i.test(p));
  const docs = paths.filter((p) => SUPPORTED.includes(path.extname(p).toLowerCase()));
  const res = [];
  for (const z of zips) res.push(...(await importZipFile(z)));
  if (docs.length) res.push(...(await importLooseFiles(docs)));
  return res;
}

// ---------- Moodle : télécharger un cours en ZIP ----------
async function downloadCourse(courseId, courseName) {
  progress({ step: 'moodle', label: 'Liste des supports du cours…', done: 0, total: 1 });
  const files = await moodle.listCourseFiles(courseId);
  if (!files.length) throw new Error("Aucun support trouvé dans ce cours.");
  const zip = new AdmZip();
  let ok = 0;
  for (const [i, f] of files.entries()) {
    progress({ step: 'moodle', label: `Téléchargement : ${f.name}`, done: i, total: files.length });
    try {
      const dl = await moodle.download(f.url);
      if (/text\/html/.test(dl.type)) continue; // page web, pas un fichier
      const dir = [safeName(f.section), f.folder ? safeName(f.folder) : null].filter(Boolean).join('/');
      if (f.zip || /zip/.test(dl.type)) {
        const inner = new AdmZip(dl.buf);
        for (const e of inner.getEntries()) if (!e.isDirectory) zip.addFile(`${dir}/${e.entryName}`, e.getData());
      } else {
        let name = f.guessName ? (dl.filename || f.name) : f.name;
        if (!path.extname(name)) name += { 'application/pdf': '.pdf' }[dl.type.split(';')[0]] || '';
        zip.addFile(`${dir}/${safeName(name)}`, dl.buf);
      }
      ok++;
    } catch (e) { console.warn('échec', f.name, e.message); }
  }
  fs.mkdirSync(COURSES_DIR(), { recursive: true });
  const zipPath = path.join(COURSES_DIR(), safeName(courseName) + '.zip');
  zip.writeZip(zipPath);
  const subjects = await importZipFile(zipPath, { single: true, extra: { name: courseName, courseId, source: 'moodle', zipPath, fileCount: ok } });
  return subjects[0];
}

// ---------- IPC ----------
function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; } catch (e) { progress(null); return { ok: false, error: e.message || String(e) }; }
  });
}

handle('state', () => publicState());
handle('settings:set', (patch) => { state.settings = { ...state.settings, ...patch }; save(); return publicState(); });
handle('moodle:login', async (url) => { await moodle.login(win, url); return publicState(); });
handle('moodle:logout', async () => { await moodle.logout(); return publicState(); });
handle('moodle:courses', async () => {
  const courses = await moodle.listCourses();
  state.moodleCourses = courses; save();
  return courses;
});
handle('moodle:download', (id, name) => downloadCourse(id, name));
handle('import:dialog', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Importer des cours', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Cours (ZIP, PDF, Word, PowerPoint…)', extensions: ['zip', ...SUPPORTED.map((e) => e.slice(1))] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return importPaths(r.filePaths);
});
handle('import:paths', (paths) => importPaths(paths));
handle('subject:update', (sub) => upsertSubject(sub));
handle('subject:delete', (id) => { state.subjects = state.subjects.filter((s) => s.id !== id); save(); return publicState(); });
handle('subject:saveZip', async (id) => {
  const s = state.subjects.find((x) => x.id === id);
  if (!s || !s.zipPath || !fs.existsSync(s.zipPath)) throw new Error("Le ZIP n'est pas disponible : télécharge d'abord le cours.");
  const r = await dialog.showSaveDialog(win, { title: 'Enregistrer le ZIP des cours', defaultPath: path.join(app.getPath('downloads'), path.basename(s.zipPath)), filters: [{ name: 'ZIP', extensions: ['zip'] }] });
  if (r.canceled) return null;
  fs.copyFileSync(s.zipPath, r.filePath);
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});
function buildFor({ model, subjectIds, key, budget }) {
  const subs = state.subjects.filter((s) => subjectIds.includes(s.id));
  return buildScript(subs, { model, key, budget });
}
// Fichier à envoyer : REVE.8xp (programme TI-Basic) ou reve.py (script NumWorks)
function calcFile(r) {
  return r.model === 'ti83' ? { name: 'REVE.8xp', data: r.file } : { name: 'reve.py', data: Buffer.from(r.code, 'utf8') };
}
function saveCalcFile(r) {
  const dir = path.join(app.getPath('documents'), 'REVE');
  fs.mkdirSync(dir, { recursive: true });
  const f = calcFile(r);
  const p = path.join(dir, f.name);
  fs.writeFileSync(p, f.data);
  return p;
}
let lastTIFile = null;

handle('calc:build', (o) => {
  const r = buildFor(o);
  if (r.model === 'ti83') {
    return { model: 'ti83', bytes: r.bytes, dropped: r.dropped, subjects: state.subjects.filter((s) => o.subjectIds.includes(s.id)).map((s) => s.name),
      chapters: r.chapters.map((c) => ({ si: c.si, subject: c.subject, title: c.title, firstPage: c.firstPage, pageCount: c.pageCount })),
      pages: r.pages };
  }
  return { model: r.model, T: r.T, L: r.L, CS: r.CS, SN: r.SN, bytes: r.bytes, dropped: r.dropped };
});
handle('calc:export', (o) => {
  const p = saveCalcFile(buildFor(o));
  shell.showItemInFolder(p);
  return [p];
});
handle('calc:send', (o) => {
  const r = buildFor(o);
  const f = calcFile(r);
  if (r.model === 'ti83') lastTIFile = saveCalcFile(r);
  return openUsbWindow(r.model, f.data);
});

// Ouvre TI Connect CE (s'il est installé) et montre le fichier REVE.8xp à glisser dedans
ipcMain.handle('ti:connect', async () => {
  const file = lastTIFile;
  if (file) shell.showItemInFolder(file);
  const { spawn } = require('child_process');
  if (process.platform === 'win32') {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of roots) {
      for (const sub of ['TI Education\\TI Connect CE\\TI Connect CE.exe', 'TI Education\\TI Connect CE\\TIConnectCE.exe', 'Programs\\TI Connect CE\\TI Connect CE.exe']) {
        const exe = path.join(r, sub);
        if (fs.existsSync(exe)) { spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); return { found: true }; }
      }
    }
  } else if (process.platform === 'darwin') {
    for (const appPath of ['/Applications/TI Connect CE.app', path.join(app.getPath('home'), 'Applications/TI Connect CE.app')]) {
      if (fs.existsSync(appPath)) { spawn('open', ['-a', appPath], { detached: true, stdio: 'ignore' }).unref(); return { found: true }; }
    }
  }
  shell.openExternal('https://education.ti.com/fr/products/computer-software/ti-connect-ce-sw');
  return { found: false };
});
handle('open:external', (url) => shell.openExternal(url));

// Fenêtre d'envoi USB (WebUSB) : NumWorks (0483:a291) ou TI-83 Premium CE (0451:e008)
let usbSessionReady = false;
function openUsbWindow(model, data) {
  return new Promise((resolve) => {
    const usb = new BrowserWindow({
      width: 500, height: 520, parent: win, modal: true, resizable: false, title: 'Envoi sur la calculatrice', autoHideMenuBar: true, backgroundColor: '#0f1222',
      webPreferences: { nodeIntegration: true, contextIsolation: false, partition: 'usb' },
    });
    const ses = usb.webContents.session;
    if (!usbSessionReady) {
      usbSessionReady = true;
      ses.on('select-usb-device', (event, details, callback) => {
        event.preventDefault();
        const d = details.deviceList.find((x) => (x.vendorId === 0x0483 && x.productId === 0xa291) || x.vendorId === 0x0451);
        callback(d ? d.deviceId : '');
      });
      ses.setPermissionCheckHandler(() => true);
      ses.setDevicePermissionHandler((d) => d.deviceType === 'usb');
    }
    let result = { sent: false };
    const onResult = (_e, r) => { result = r; };
    ipcMain.on('usb:result', onResult);
    usb.on('closed', () => { ipcMain.removeListener('usb:result', onResult); resolve(result); });
    usb.loadFile(path.join(__dirname, '../renderer/usb.html'), { query: { model, data: Buffer.from(data).toString('base64') } });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 940, minHeight: 640, title: 'REVE', backgroundColor: '#0f1222', autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  load();
  fs.mkdirSync(COURSES_DIR(), { recursive: true });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

module.exports = { importPaths };
