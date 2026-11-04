// Lance le vrai logiciel REVE (Electron) avec des données de démo et prend des captures.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const userData = process.argv[2];
  const out = process.argv[3] || path.join(__dirname, '../docs/captures');
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: { ...process.env, REVE_USERDATA: userData },
  });
  const page = await app.firstWindow();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1280, 820); });
  await page.waitForSelector('.subject');
  await page.waitForTimeout(500);
  const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, name) }); console.log('capture', name); };
  await shot('1-matieres.png');
  await page.click('.subject >> nth=0');
  await page.click('.chapter >> nth=1 >> .chapter-head');
  await shot('2-fiche-matiere.png');
  await page.click('nav button[data-view=import]');
  await shot('3-import-zip.png');
  await page.click('nav button[data-view=calc]');
  for (const k of ['1', '2', '*', '3', 'exe', '9', '.', '8', '1', '*', '2', 'exe']) await page.click(`#device [data-k="${k}"]`);
  await shot('4-transfert-numworks-calcul.png');
  await page.click('#device [data-k=reve]');
  await page.click('#device [data-k=ok]');
  await page.click('#device [data-k=ok]');
  await shot('5-transfert-numworks-revision.png');
  await page.click('.model[data-model=ti83]');
  await page.waitForTimeout(400);
  for (const k of ['1', '2', '*', '3', 'exe']) await page.click(`#device [data-k="${k}"]`);
  await page.click('#device [data-k=reve]');
  await page.click('#device [data-k=ok]');
  await page.click('#device [data-k=ok]');
  await shot('6-transfert-ti83.png');
  await page.click('.model[data-model=numworks]');
  await page.click('nav button[data-view=settings]');
  await shot('7-reglages-moodle.png');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
