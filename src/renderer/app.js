// REVE - interface
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TYPES = {
  def: { label: 'Définition', color: 'var(--def)' },
  form: { label: 'Formule', color: 'var(--form)' },
  loi: { label: 'Loi / propriété', color: 'var(--loi)' },
  meth: { label: 'Méthode', color: 'var(--meth)' },
  ex: { label: 'Exemple', color: 'var(--ex)' },
  fait: { label: 'À retenir', color: 'var(--fait)' },
};

const LOOKS = [
  [/optique|lumi[eè]re/i, '🔭', '#5ac8fa'], [/physique|m[ée]canique|[ée]lectri|thermo/i, '⚛️', '#4a9dff'],
  [/math|analyse|alg[eè]bre|g[ée]om[ée]trie|proba|stat/i, '📐', '#ffb734'], [/chimie/i, '🧪', '#3ddc97'],
  [/svt|bio|g[ée]ologie|vivant/i, '🧬', '#7bd88f'], [/histoire/i, '🏛️', '#d4a373'], [/g[ée]o/i, '🌍', '#4fc3f7'],
  [/philo/i, '💭', '#c39bff'], [/fran[cç]ais|litt[ée]rature/i, '📖', '#ff8fab'], [/anglais|english/i, '🇬🇧', '#ff6b81'],
  [/espagnol/i, '🇪🇸', '#ffa53d'], [/allemand/i, '🇩🇪', '#ffd166'], [/info|nsi|algo|programm/i, '💻', '#8b7bff'],
  [/[ée]co|ses|gestion|droit/i, '📈', '#2fd28b'], [/sport|eps/i, '🏃', '#ff9f43'], [/art|musique/i, '🎨', '#f78fb3'],
];
function look(name) {
  for (const [rx, icon, color] of LOOKS) if (rx.test(name)) return { icon, color };
  return { icon: '📘', color: '#8b9cff' };
}

let S = null; // état venant du processus principal
let current = null; // matière ouverte
let calcModel = 'numworks';
let calcSel = new Set();
let sim = null;

function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = 'toast'), err ? 6000 : 3200);
}

async function run(fn, label = 'Un instant…') {
  busy({ label });
  try { return await fn(); } catch (e) { toast(e.message, true); return undefined; } finally { busy(null); }
}
function busy(p) {
  $('#busy').classList.toggle('on', !!p);
  if (p) {
    $('#busy-label').textContent = p.label || '…';
    $('#busy-bar').style.width = p.total ? Math.round(((p.done || 0) / p.total) * 100) + '%' : '15%';
  }
}
window.reve.onProgress((p) => busy(p));

function show(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $$('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view || (view === 'subject' && b.dataset.view === 'subjects')));
  if (view === 'calc') renderCalc();
  if (view === 'settings') renderSettings();
  $('#main').scrollTop = 0;
}
$$('nav button').forEach((b) => (b.onclick = () => { if (b.dataset.view === 'subjects') renderSubjects(); show(b.dataset.view); }));

async function refreshState() {
  S = await window.reve.state();
  renderMoodlePill();
}

// ---------- Moodle ----------
function renderMoodlePill() {
  const m = S.moodle;
  const p = $('#moodle-pill');
  p.className = 'moodle-pill' + (m.connected ? ' on' : '');
  p.innerHTML = m.connected
    ? `<span class="dot"></span><div><b>Moodle connecté</b><small>${esc(m.siteName || m.url)}</small></div>`
    : `<span class="dot"></span><div><b>Se connecter à Moodle</b><small>Récupère tes cours automatiquement</small></div>`;
}
$('#moodle-pill').onclick = () => show('settings');

async function connectMoodle() {
  const url = $('#moodle-url').value.trim() || S.moodle.url;
  if (!url) { toast("Écris d'abord l'adresse du Moodle de ton école.", true); $('#moodle-url').focus(); return; }
  try {
    toast('Une fenêtre de connexion Moodle va s\'ouvrir…');
    S = await window.reve.moodleLogin(url);
    renderMoodlePill(); renderSettings();
    toast('Connecté à Moodle ✔');
    await loadCourses();
    renderSubjects(); show('subjects');
  } catch (e) { toast(e.message, true); }
}
async function loadCourses() {
  if (!S.moodle.connected) return;
  const courses = await run(() => window.reve.moodleCourses(), 'Récupération de tes cours Moodle…');
  if (courses) { S.moodleCourses = courses; toast(`${courses.length} cours trouvés sur Moodle`); }
}
$('#btn-refresh').onclick = async () => {
  if (!S.moodle.connected) return show('settings');
  await loadCourses(); await refreshState(); renderSubjects();
};

function renderSettings() {
  $('#moodle-url').value = S.moodle.url || '';
  const st = $('#moodle-status');
  if (S.moodle.connected) {
    st.innerHTML = `<b>● Connecté</b> à ${esc(S.moodle.siteName || S.moodle.url)} en tant que <b>${esc(S.moodle.user || '')}</b> · <a href="#" id="logout">Se déconnecter</a>`;
    $('#logout').onclick = async (e) => { e.preventDefault(); S = await window.reve.moodleLogout(); renderMoodlePill(); renderSettings(); toast('Déconnecté'); };
    $('#btn-connect').textContent = 'Se reconnecter';
  } else {
    st.textContent = 'Pas encore connecté.';
    $('#btn-connect').textContent = 'Se connecter';
  }
}
$('#btn-connect').onclick = connectMoodle;
$('#moodle-url').onkeydown = (e) => { if (e.key === 'Enter') connectMoodle(); };

// ---------- Matières ----------
function subjectStats(s) {
  const pts = s.chapters.flatMap((c) => c.points);
  const by = {};
  pts.forEach((p) => (by[p.type] = (by[p.type] || 0) + 1));
  return { chapters: s.chapters.length, points: pts.length, by };
}

function renderSubjects() {
  const q = $('#search').value.trim().toLowerCase();
  const grid = $('#subjects-grid');
  const items = [];
  const known = new Set(S.subjects.map((s) => s.courseId).filter(Boolean));
  for (const s of S.subjects) items.push({ kind: 'subject', s, name: s.name });
  for (const c of S.moodleCourses || []) if (!known.has(c.id)) items.push({ kind: 'course', c, name: c.name });
  const shown = items.filter((i) => !q || i.name.toLowerCase().includes(q));
  $('#subjects-sub').textContent = S.subjects.length
    ? `${S.subjects.length} matière${S.subjects.length > 1 ? 's' : ''} prête${S.subjects.length > 1 ? 's' : ''} à réviser` + ((S.moodleCourses || []).length ? ` · ${(S.moodleCourses || []).length} cours sur Moodle` : '')
    : 'Tous tes cours, résumés et triés par chapitre.';
  if (!items.length) {
    grid.innerHTML = `<div class="empty"><div class="big">🌙</div><h2>Aucune matière pour l'instant</h2>
      <p>Connecte ton Moodle pour récupérer tes cours, ou importe un ZIP de cours.</p><br>
      <button class="btn" id="e-moodle">🎓 Se connecter à Moodle</button> &nbsp; <button class="btn ghost" id="e-zip">📥 Importer un ZIP</button></div>`;
    $('#e-moodle').onclick = () => show('settings');
    $('#e-zip').onclick = () => show('import');
    return;
  }
  grid.innerHTML = '';
  for (const it of shown) {
    const { icon, color } = look(it.name);
    const el = document.createElement('div');
    el.style.setProperty('--c', color);
    if (it.kind === 'subject') {
      const st = subjectStats(it.s);
      const total = st.points || 1;
      el.className = 'subject';
      el.innerHTML = `<div class="subject-icon">${icon}</div><h3>${esc(it.s.name)}</h3>
        <div class="meta">${st.chapters} chapitre${st.chapters > 1 ? 's' : ''} · ${st.points} points clés</div>
        <div class="bars">${Object.keys(TYPES).map((t) => st.by[t] ? `<i style="width:${(st.by[t] / total) * 100}%;background:${TYPES[t].color}"></i>` : '').join('')}</div>
        <div class="foot"><span class="tag ${it.s.source === 'moodle' ? 'moodle' : 'zip'}">${it.s.source === 'moodle' ? 'Moodle' : 'ZIP'}</span><span class="meta">Réviser →</span></div>`;
      el.onclick = () => openSubject(it.s.id);
    } else {
      el.className = 'subject pending';
      el.innerHTML = `<div class="subject-icon">${icon}</div><h3>${esc(it.c.name)}</h3>
        <div class="meta">Sur Moodle · pas encore téléchargé</div>
        <div class="foot"><span class="tag moodle">Moodle</span><button class="mini-btn">⬇ Télécharger le ZIP</button></div>`;
      el.onclick = () => downloadCourse(it.c.id, it.c.name);
    }
    grid.appendChild(el);
  }
}
$('#search').oninput = renderSubjects;
$('#btn-import-top').onclick = () => show('import');

async function downloadCourse(id, name) {
  const sub = await run(() => window.reve.moodleDownload(id, name), `Téléchargement de « ${name} »…`);
  if (!sub) return;
  await refreshState();
  toast(`« ${name} » téléchargé et résumé ✔`);
  openSubject(sub.id);
}

// ---------- Détail d'une matière ----------
function openSubject(id) {
  current = S.subjects.find((s) => s.id === id);
  if (!current) return;
  const { icon, color } = look(current.name);
  $('#d-icon').textContent = icon;
  $('#d-icon').style.setProperty('--c', color);
  $('#d-title').textContent = current.name;
  const st = subjectStats(current);
  const when = current.analyzedAt ? new Date(current.analyzedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  $('#d-sub').textContent = `${st.chapters} chapitres · ${st.points} points clés · résumé le ${when}`;
  $('#d-dl').textContent = current.source === 'moodle' ? '⬇ Télécharger le ZIP des cours' : '⬇ Enregistrer le ZIP';
  $('#legend').innerHTML = Object.values(TYPES).map((t) => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('') + '<span style="margin-left:auto">Double-clic pour corriger · 👁 pour retirer de la calculatrice</span>';
  renderChapters();
  show('subject');
}

function renderChapters() {
  const box = $('#chapters');
  box.innerHTML = '';
  current.chapters.forEach((c, ci) => {
    const el = document.createElement('div');
    el.className = 'chapter' + (ci === 0 ? ' open' : '');
    el.innerHTML = `<div class="chapter-head"><div class="num">${ci + 1}</div><h3>${esc(c.title)}</h3><span class="count">${c.points.filter((p) => !p.hidden).length} points</span><span class="chev">▶</span></div><div class="points"></div>`;
    $('.chapter-head', el).onclick = () => el.classList.toggle('open');
    const pts = $('.points', el);
    c.points.forEach((p, pi) => {
      const t = TYPES[p.type] || TYPES.fait;
      const row = document.createElement('div');
      row.className = 'point' + (p.hidden ? ' hidden' : '');
      row.innerHTML = `<span class="type" style="--t:${t.color}">${t.label}</span><div class="txt">${esc(p.text)}</div>
        <div class="tools"><button title="Changer le type">🏷</button><button title="Afficher / retirer de la calculatrice">👁</button></div>`;
      const txt = $('.txt', row);
      txt.ondblclick = () => { txt.contentEditable = 'true'; txt.focus(); };
      txt.onblur = () => { txt.contentEditable = 'false'; const v = txt.textContent.trim(); if (v && v !== p.text) { p.text = v; saveCurrent('Point corrigé'); } };
      txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } };
      const [bType, bHide] = $$('.tools button', row);
      bHide.onclick = () => { p.hidden = !p.hidden; row.classList.toggle('hidden', p.hidden); saveCurrent(p.hidden ? 'Retiré de la calculatrice' : 'Remis sur la calculatrice'); };
      bType.onclick = () => { const keys = Object.keys(TYPES); p.type = keys[(keys.indexOf(p.type) + 1) % keys.length]; renderChapters(); saveCurrent(); };
      pts.appendChild(row);
    });
    box.appendChild(el);
  });
}

async function saveCurrent(msg) {
  try { await window.reve.updateSubject(current); if (msg) toast(msg); } catch (e) { toast(e.message, true); }
}
$('#back').onclick = () => { renderSubjects(); show('subjects'); };
$('#d-title').onblur = () => { const v = $('#d-title').textContent.trim(); if (v && v !== current.name) { current.name = v; saveCurrent('Matière renommée'); } };
$('#d-title').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#d-title').blur(); } };
$('#d-dl').onclick = async () => {
  if (current.source === 'moodle' && current.courseId && S.moodle.connected) {
    const sub = await run(() => window.reve.moodleDownload(current.courseId, current.name), 'Téléchargement des supports…');
    if (!sub) return;
    await refreshState();
    current = S.subjects.find((s) => s.id === sub.id);
    renderChapters();
  }
  const p = await window.reve.saveZip(current.id).catch((e) => toast(e.message, true));
  if (p) toast('ZIP enregistré : ' + p);
};
$('#d-calc').onclick = () => { calcSel = new Set([current.id]); show('calc'); };
$('#d-del').onclick = async () => {
  if (!confirm(`Supprimer « ${current.name} » de REVE ? (tes fichiers ne sont pas touchés)`)) return;
  S = await window.reve.deleteSubject(current.id);
  renderSubjects(); show('subjects');
};

// ---------- Import ----------
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', async (e) => {
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  afterImport(await run(() => window.reve.importFiles(files), 'Décompression…'));
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
$('#btn-pick').onclick = async () => afterImport(await run(() => window.reve.importDialog(), 'Décompression…'));
async function afterImport(subs) {
  if (!subs || !subs.length) return;
  await refreshState();
  toast(`${subs.length} matière${subs.length > 1 ? 's' : ''} analysée${subs.length > 1 ? 's' : ''} ✔`);
  renderSubjects();
  if (subs.length === 1) openSubject(subs[0].id); else show('subjects');
}

// ---------- Calculatrice ----------
function renderCalc() {
  if (!sim) {
    sim = new window.CalcSim($('#screen'));
    $$('#device [data-k]').forEach((b) => (b.onclick = () => sim.key(b.dataset.k)));
  }
  calcModel = S.settings.model || 'numworks';
  $$('.model').forEach((m) => m.classList.toggle('active', m.dataset.model === calcModel));
  if (!calcSel.size) S.subjects.forEach((s) => calcSel.add(s.id));
  const chips = $('#calc-subjects');
  chips.innerHTML = S.subjects.length ? '' : '<p class="hint">Aucune matière : importe d\'abord des cours.</p>';
  for (const s of S.subjects) {
    const { icon, color } = look(s.name);
    const c = document.createElement('button');
    c.className = 'chip' + (calcSel.has(s.id) ? ' on' : '');
    c.style.setProperty('--c', color);
    c.innerHTML = `${icon} ${esc(s.name)}`;
    c.onclick = () => { calcSel.has(s.id) ? calcSel.delete(s.id) : calcSel.add(s.id); c.classList.toggle('on'); updatePreview(); };
    chips.appendChild(c);
  }
  const sel = $('#calc-key');
  sel.innerHTML = Object.entries(S.numworksKeys).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
  sel.value = S.settings.key || 'toolbox';
  const ti = calcModel === 'ti83';
  $('#key-row').style.display = ti ? 'none' : '';
  $('#ti-key-hint').style.display = ti ? '' : 'none';
  const budget = (S.settings.budget && S.settings.budget[calcModel]) || S.models[calcModel].budget;
  $('#calc-budget').value = budget;
  $('#device').className = 'device' + (ti ? ' ti' : '');
  $('#device-brand').textContent = ti ? 'TI-83 Premium CE' : 'NumWorks';
  $('#k-reve').textContent = ti ? 'math (REVE)' : 'REVE (' + S.numworksKeys[sel.value] + ')';
  $('#k-reve').classList.add('pulse-key');
  $('#btn-send').textContent = ti ? '💾 Créer le fichier REVE.8xv' : '⚡ Envoyer par USB';
  $('#btn-export').style.display = ti ? 'none' : '';
  $('#send-hint').innerHTML = ti
    ? 'Ensuite, ouvre <b>TI Connect CE</b> (gratuit), branche la calculatrice et glisse <b>REVE.8xv</b> dedans (ou REVE.py, TI Connect le convertit). Sur la TI : <b>[prgm]</b> → Python App → REVE.'
    : 'Branche la NumWorks en USB et clique sur Envoyer. Sur la calculatrice : <b>Python</b> → <b>reve.py</b>.';
  updatePreview();
}

let previewTimer = null;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const budget = +$('#calc-budget').value;
    $('#budget-val').textContent = (budget / 1000).toFixed(1) + ' Ko';
    const ids = [...calcSel];
    if (!ids.length) { sim.setData(calcModel, [], []); $('#calc-info').textContent = 'Choisis au moins une matière.'; return; }
    try {
      const r = await window.reve.calcBuild({ model: calcModel, subjectIds: ids, key: $('#calc-key').value, budget });
      sim.setData(calcModel, r.T, r.L);
      $('#calc-info').innerHTML = `${r.T.length} chapitres · ${(r.bytes / 1000).toFixed(1)} Ko de fiches` + (r.dropped ? ` · <b>${r.dropped} points secondaires retirés</b> pour tenir dans la mémoire (augmente la place si tu veux tout garder)` : ' · tout rentre ✔');
    } catch (e) { toast(e.message, true); }
  }, 120);
}
$$('.model').forEach((m) => (m.onclick = async () => { S = await window.reve.setSettings({ model: m.dataset.model }); renderCalc(); }));
$('#calc-key').onchange = async () => { S = await window.reve.setSettings({ key: $('#calc-key').value }); renderCalc(); };
$('#calc-budget').oninput = () => updatePreview();
$('#calc-budget').onchange = async () => { S = await window.reve.setSettings({ budget: { ...(S.settings.budget || {}), [calcModel]: +$('#calc-budget').value } }); };
function calcOpts() { return { model: calcModel, subjectIds: [...calcSel], key: $('#calc-key').value, budget: +$('#calc-budget').value }; }
$('#btn-send').onclick = async () => {
  if (!calcSel.size) return toast('Choisis au moins une matière.', true);
  if (calcModel === 'ti83') {
    const files = await window.reve.calcExport(calcOpts()).catch((e) => toast(e.message, true));
    if (files) toast('Fichiers créés dans Documents/REVE ✔');
    return;
  }
  const r = await window.reve.calcNumworks(calcOpts()).catch((e) => toast(e.message, true));
  if (r && r.sent) toast('REVE est sur ta NumWorks ✔');
};
$('#btn-export').onclick = async () => {
  if (!calcSel.size) return toast('Choisis au moins une matière.', true);
  const files = await window.reve.calcExport(calcOpts()).catch((e) => toast(e.message, true));
  if (files) toast('reve.py créé dans Documents/REVE ✔ (à envoyer via my.numworks.com)');
};
document.addEventListener('keydown', (e) => {
  if (!$('#view-calc').classList.contains('active') || !sim || e.target.matches('input, select, [contenteditable=true]')) return;
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'exe', Backspace: 'del', r: 'reve', R: 'reve', Tab: 'reve' };
  const k = map[e.key] || (/^[0-9+\-*/().]$/.test(e.key) ? e.key : null);
  if (k) { e.preventDefault(); sim.key(k); }
});

// ---------- Démarrage ----------
(async () => {
  await refreshState();
  renderSubjects();
  const v = new URLSearchParams(location.search).get('view');
  if (v) show(v);
})();
