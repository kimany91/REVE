// Connexion à Moodle et récupération des cours.
// 1) On ouvre la vraie page de connexion de l'école dans une fenêtre (ça marche aussi avec l'ENT / SSO).
// 2) Moodle renvoie un jeton (comme pour l'app mobile officielle) -> on reste connecté.
// 3) Si l'école a désactivé l'app mobile, on utilise la session du navigateur intégré.
const { BrowserWindow, session } = require('electron');
const crypto = require('crypto');

const PARTITION = 'persist:moodle';

function normUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/\/(login|my|course)\/.*$/i, '').replace(/\/(index\.php)?$/i, '').replace(/\/+$/, '');
  return u;
}

class Moodle {
  constructor(store) {
    this.store = store; // { get(), set(patch) }
  }

  get cfg() { return this.store.get().moodle || {}; }
  get ses() { return session.fromPartition(PARTITION); }

  // Ouvre la page de connexion et attend que l'utilisateur soit connecté.
  login(parent, url) {
    const base = normUrl(url || this.cfg.url);
    if (!base) return Promise.reject(new Error("Indique d'abord l'adresse du Moodle de ton école."));
    const passport = crypto.randomBytes(8).toString('hex');
    const launch = `${base}/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=${passport}&urlscheme=moodlemobile`;
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        width: 980, height: 760, parent, modal: false, title: 'Connexion à Moodle',
        autoHideMenuBar: true,
        webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      let done = false;
      const finish = async (token) => {
        if (done) return;
        done = true;
        try {
          const info = await this._siteInfo(base, token);
          this.store.set({ moodle: { url: base, token: token || null, mode: token ? 'token' : 'session', siteName: info.sitename, user: info.fullname, userid: info.userid } });
          resolve(this.store.get().moodle);
        } catch (e) { reject(e); }
        setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 300);
      };
      const check = (ev, target) => {
        const m = /^moodlemobile:\/\/token=([^&#]+)/i.exec(target || '');
        if (m) {
          ev && ev.preventDefault && ev.preventDefault();
          const parts = Buffer.from(decodeURIComponent(m[1]), 'base64').toString('utf8').split(':::');
          finish(parts[1]);
        }
      };
      win.webContents.on('will-navigate', check);
      win.webContents.on('will-redirect', check);
      win.webContents.on('will-frame-navigate', (e) => check(e, e.url));
      win.webContents.setWindowOpenHandler(({ url: u }) => { check(null, u); return { action: 'deny' }; });
      win.webContents.on('did-fail-load', (_e, _c, _d, u) => check(null, u));
      // Après la connexion : si Moodle ne renvoie pas de jeton (app mobile désactivée), on garde la session.
      let triedLaunch = false;
      win.webContents.on('did-finish-load', async () => {
        if (done) return;
        const u = win.webContents.getURL();
        if (!u.startsWith(base) || /\/login\//.test(u)) return;
        const logged = await win.webContents.executeJavaScript('!!document.querySelector(\'a[href*="login/logout.php"]\')').catch(() => false);
        if (!logged) return;
        if (/admin\/tool\/mobile\/launch\.php/.test(u) || triedLaunch) finish(null);
        else { triedLaunch = true; win.loadURL(launch); }
      });
      win.on('closed', () => { if (!done) reject(new Error('Connexion annulée.')); });
      win.loadURL(launch);
    });
  }

  async logout() {
    await this.ses.clearStorageData();
    const url = this.cfg.url;
    this.store.set({ moodle: { url } });
  }

  async _ws(fn, params = {}, base = this.cfg.url, token = this.cfg.token) {
    const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json' });
    const flat = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (v && typeof v === 'object') flat(v, key); else body.append(key, String(v));
      }
    };
    flat(params);
    const r = await this.ses.fetch(`${base}/webservice/rest/server.php`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const j = await r.json();
    if (j && j.exception) throw new Error(j.message || j.errorcode);
    return j;
  }

  async _sesskey(base = this.cfg.url) {
    const r = await this.ses.fetch(`${base}/my/`);
    const html = await r.text();
    const m = html.match(/"sesskey":"([^"]+)"/);
    if (!m) throw new Error('Session Moodle expirée : reconnecte-toi.');
    return { sesskey: m[1], html };
  }

  async _ajax(fn, args, base = this.cfg.url) {
    const { sesskey } = await this._sesskey(base);
    const r = await this.ses.fetch(`${base}/lib/ajax/service.php?sesskey=${sesskey}&info=${fn}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ index: 0, methodname: fn, args }]),
    });
    const j = await r.json();
    if (!Array.isArray(j) || j[0].error) throw new Error((j[0] && j[0].exception && j[0].exception.message) || 'Erreur Moodle');
    return j[0].data;
  }

  async _siteInfo(base, token) {
    if (token) return this._ws('core_webservice_get_site_info', {}, base, token);
    const { html } = await this._sesskey(base);
    const name = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Moodle';
    const uid = (html.match(/"userId":(\d+)/) || html.match(/data-userid="(\d+)"/) || [])[1];
    const full = (html.match(/class="usertext[^"]*"[^>]*>([^<]+)</) || html.match(/data-user-fullname="([^"]+)"/) || [])[1];
    return { sitename: name.split(':').pop().trim(), fullname: full || 'Connecté', userid: uid ? +uid : null };
  }

  async listCourses() {
    const c = this.cfg;
    if (!c.url || !c.mode) throw new Error("Tu n'es pas connecté à Moodle.");
    if (c.mode === 'token') {
      const list = await this._ws('core_enrol_get_users_courses', { userid: c.userid });
      return list.map((x) => ({ id: x.id, name: x.fullname, short: x.shortname, image: x.courseimage || null, category: x.category }));
    }
    const data = await this._ajax('core_course_get_enrolled_courses_by_timeline_classification', { classification: 'all', limit: 0, offset: 0, sort: 'fullname' });
    return data.courses.map((x) => ({ id: x.id, name: x.fullname, short: x.shortname, image: x.courseimage || null }));
  }

  // Liste tous les fichiers d'un cours : [{ section, name, url }]
  async listCourseFiles(courseId) {
    const c = this.cfg;
    const files = [];
    if (c.mode === 'token') {
      const sections = await this._ws('core_course_get_contents', { courseid: courseId });
      for (const s of sections) for (const m of s.modules || []) for (const f of m.contents || []) {
        if (f.type !== 'file' || !f.fileurl) continue;
        const url = f.fileurl + (f.fileurl.includes('?') ? '&' : '?') + 'token=' + c.token;
        const sub = m.modname === 'folder' ? `${m.name}/${(f.filepath || '/').replace(/^\/|\/$/g, '')}` : '';
        files.push({ section: s.name || 'Général', folder: sub.replace(/\/$/, ''), name: f.filename, url, size: f.filesize });
      }
      return files;
    }
    // Mode session : on lit la page "Ressources" du cours
    const r = await this.ses.fetch(`${c.url}/course/resources.php?id=${courseId}`);
    const html = await r.text();
    const rx = /href="([^"]*\/mod\/(resource|folder)\/view\.php\?id=(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    const seen = new Set();
    while ((m = rx.exec(html))) {
      if (seen.has(m[3])) continue;
      seen.add(m[3]);
      const name = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (m[2] === 'folder') files.push({ section: 'Dossiers', folder: name, name: name + '.zip', url: `${c.url}/mod/folder/download_folder.php?id=${m[3]}`, zip: true });
      else files.push({ section: 'Ressources', name, url: `${c.url}/mod/resource/view.php?id=${m[3]}&redirect=1`, guessName: true });
    }
    return files;
  }

  async download(url) {
    const r = await this.ses.fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const cd = r.headers.get('content-disposition') || '';
    const fn = (cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i) || [])[1];
    const type = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, filename: fn ? decodeURIComponent(fn) : null, type, finalUrl: r.url };
  }
}

module.exports = { Moodle, normUrl };
