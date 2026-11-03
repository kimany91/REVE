// Test de bout en bout du vrai logiciel : connexion Moodle (faux serveur), cours, téléchargement ZIP,
// import d'un ZIP et création des fichiers calculatrice.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { start } = require('./mock-moodle');
(async () => {
  const srv = await start();
  const url = `http://127.0.0.1:${srv.address().port}`;
  const userData = fs.mkdtempSync(path.join(process.argv[2] || os.tmpdir(), 'reve-e2e-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, REVE_USERDATA: userData, HOME: userData } });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.waitForSelector('.empty');
  console.log('✔ démarrage (aucune matière)');

  const loginP = page.evaluate((u) => window.reve.moodleLogin(u), url);
  const lw = await app.waitForEvent('window');
  await lw.waitForSelector('#username');
  await lw.fill('#username', 'eleve'); await lw.fill('#password', 'secret');
  await lw.click('#loginbtn');
  const st = await loginP;
  if (!st.moodle.connected || st.moodle.mode !== 'token') throw new Error('connexion ratée ' + JSON.stringify(st.moodle));
  console.log('✔ connexion Moodle :', st.moodle.siteName, '/', st.moodle.user);

  const courses = await page.evaluate(() => window.reve.moodleCourses());
  console.log('✔ cours trouvés :', courses.map((c) => c.name).join(', '));
  const sub = await page.evaluate(() => window.reve.moodleDownload(11, 'Physique - Optique'));
  console.log('✔ ZIP téléchargé :', path.basename(sub.zipPath), '·', sub.chapters.length, 'chapitres ·', sub.chapters.reduce((a, c) => a + c.points.length, 0), 'points');
  if (!fs.existsSync(sub.zipPath) || sub.chapters.length < 3) throw new Error('téléchargement incomplet');

  const imported = await app.evaluate(async ({ ipcMain }, p) => ipcMain._invokeHandlers.get('import:paths')({}, [p]), path.join(__dirname, '../demo/Cours_demo.zip'));
  if (!imported.ok) throw new Error(imported.error);
  console.log('✔ import ZIP :', imported.data.map((s) => s.name).join(', '));

  const state = await page.evaluate(() => window.reve.state());
  const ids = state.subjects.map((s) => s.id);
  const nw = await page.evaluate((ids) => window.reve.calcBuild({ model: 'numworks', subjectIds: ids, key: 'toolbox' }), ids);
  const files = await app.evaluate(async ({ ipcMain }, ids) => ipcMain._invokeHandlers.get('calc:export')({}, { model: 'ti83', subjectIds: ids }), ids);
  if (!files.ok) throw new Error(files.error);
  console.log('✔ calculatrice : NumWorks', nw.T.length, 'chapitres,', nw.bytes, 'octets · TI :', files.data.map((f) => path.basename(f)).join(', '));
  await app.close();
  srv.close();
  console.log('TOUT EST OK');
})().catch((e) => { console.error('ÉCHEC', e); process.exit(1); });
