// Génère le programme TI-Basic « REVE » pour TI-83 Premium CE / TI-84 Plus CE.
// Il apparaît dans [prgm] comme n'importe quel programme (comme SNAKE).
//
// Écran de calcul en couleur -> [math] ouvre les fiches -> [math] revient au calcul.
// Fiches : ◄ ► chapitre, ▲ ▼ page, [entrer] menu des chapitres, [annul] calcul.
const { TOK, tokenize, build8xp } = require('./tokenizer');

const TYPE_COLOR = { def: 'BLUE', form: 'RED', loi: 'MAGENTA', meth: 'GREEN', ex: 'ORANGE', fait: 'DARKGRAY' };
const TYPE_LABEL = { def: 'DEF', form: 'FORM', loi: 'LOI', meth: 'METH', ex: 'EX', fait: 'INFO' };
const SUBJECT_COLORS = ['NAVY', 'RED', 'GREEN', 'MAGENTA', 'ORANGE', 'BLUE', 'BROWN'];

// --- texte : seulement des caractères que la TI sait afficher
const REPL = { '"': "'", '“': "'", '”': "'", '«': "'", '»': "'", '’': "'", '‘': "'", '→': '->', '⇒': '=>', '…': '...', '–': '-', '—': '-', '−': '-', '×': '*', '÷': '/', '≈': '~', ' ': ' ', ' ': ' ', 'œ': 'oe', 'Œ': 'OE', '⟦': '[', '⟧': ']', '•': '-' };
function tiText(s) {
  let out = '';
  for (const ch of String(s)) {
    let c = REPL[ch] !== undefined ? REPL[ch] : ch;
    if (c.length === 1 && !TOK[c]) c = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const x of c) if (TOK[x]) out += x;
  }
  return out.replace(/\s+/g, ' ').trim();
}

// --- largeur approximative (en pixels) de la petite police de la CE
function charW(c) {
  if (' '.includes(c)) return 4;
  if ("il!.,:;|'`".includes(c)) return 3;
  if ('Ijft()[]{}r'.includes(c)) return 5;
  if ('mwMW'.includes(c)) return 8;
  if (/[A-Z0-9]/.test(c)) return 7;
  return 6;
}
const textW = (s) => [...s].reduce((a, c) => a + charW(c), 0);

function wrapPx(text, maxPx) {
  const out = [];
  let line = '';
  for (let w of text.split(' ')) {
    while (textW(w) > maxPx) { // mot trop long : on le coupe
      let k = w.length;
      while (k > 1 && textW(w.slice(0, k)) > maxPx) k--;
      if (line) { out.push(line); line = ''; }
      out.push(w.slice(0, k)); w = w.slice(k);
    }
    const cand = line ? line + ' ' + w : w;
    if (textW(cand) <= maxPx) line = cand;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}
const clip = (s, px) => { let t = s; while (t && textW(t) > px) t = t.slice(0, -1); return t.length < s.length ? t.replace(/\s+$/, '') + '..' : t; };

// --- étiquettes de 2 caractères
const PAGE_FIRST = 'UYZGHJNOBDI';
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pageLabel = (n) => PAGE_FIRST[Math.floor(n / 36)] + B36[n % 36];
const LINES_PER_PAGE = 10;
const ROW0 = 31;
const LH = 12;

function buildPages(subjects) {
  const chapters = [];
  subjects.forEach((s, si) => s.chapters.forEach((c) => {
    if (c.hidden) return;
    const pts = c.points.filter((p) => !p.hidden);
    if (pts.length) chapters.push({ si, subject: tiText(s.name), title: tiText(c.title), points: pts.map((p) => ({ ...p, text: tiText(p.text) })) });
  }));
  const pages = [];
  chapters.forEach((c, ci) => {
    c.firstPage = pages.length;
    let cur = [];
    for (const p of c.points) {
      const wl = wrapPx(p.text, 222).map((t, k) => ({ type: k === 0 ? p.type : null, text: t }));
      if (cur.length && cur.length + wl.length > LINES_PER_PAGE) { pages.push({ ci, lines: cur }); cur = []; }
      for (const l of wl) { if (cur.length === LINES_PER_PAGE) { pages.push({ ci, lines: cur }); cur = []; } cur.push(l); }
    }
    if (cur.length) pages.push({ ci, lines: cur });
    c.pageCount = pages.length - c.firstPage;
  });
  return { chapters, pages };
}

function generate(subjects) {
  const { chapters, pages } = buildPages(subjects);
  const L = [];
  const add = (...x) => L.push(...x);
  const nSub = subjects.length;

  // ---------- démarrage
  add('StoreGDB 9', 'FnOff ', 'PlotsOff ', 'AxesOff', 'GridOff', 'LabelOff',
    '0→Xmin', '264→Xmax', '⁻164→Ymin', '0→Ymax',
    '0→P', '0→H', '0→A', '0→R', '0→S', '0→T',
    '""→Str1', '⟦ ⟧→Str4', '⟦ ⟧→Str5', '⟦ ⟧→Str6');

  // ---------- écran de calcul
  add('Lbl C0', 'ClrDraw',
    'TextColor(NAVY)', 'Text(2,4,⟦REVE⟧)',
    'TextColor(GRAY)', 'Text(2,40,⟦calculatrice⟧)',
    'TextColor(ORANGE)', 'Text(2,176,⟦[math] fiches⟧)',
    'Horizontal ⁻15,NAVY', 'Horizontal ⁻16,NAVY');
  [[3, 'Str6', 'T', 24], [2, 'Str5', 'S', 60], [1, 'Str4', 'R', 96]].forEach(([n, sv, rv, y]) => {
    add(`If H≥${n}`, 'Then', 'TextColor(GRAY)', `Text(${y},4,${sv})`, 'TextColor(BLACK)', `Text(${y + 12},150,⟦=⟧)`, `Text(${y + 12},160,${rv})`, 'End');
  });
  add('Horizontal ⁻129,LTGRAY',
    'TextColor(GRAY)', 'Text(153,4,⟦[annul] efface  [suppr] corrige  [2nde] √ π⟧)');
  add('Lbl L0',
    'If length(Str1)>30', 'Then', 'sub(Str1,length(Str1)-29,30)→Str2', 'Else', 'Str1→Str2', 'End',
    'TextColor(BLACK)', 'Text(136,4,⟦> ⟧+Str2+⟦_                              ⟧)');
  add('Lbl K0', '0→K', 'Repeat K', 'getKey→K', 'End',
    'If K=41', 'Goto F0',
    'If K=45 and length(Str1)=0', 'Goto X0',
    'If K=45', '""→Str1',
    'If K=23 and length(Str1)=1', '""→Str1',
    'If K=23 and length(Str1)>1', 'sub(Str1,1,length(Str1)-1)→Str1',
    'If K=21', 'Then', '0→K', 'Repeat K', 'getKey→K', 'End',
    'If K=61', 'Str1+"√("→Str1',
    'If K=104', 'Str1+"Ans"→Str1',
    'If K=55', 'Str1+"π"→Str1',
    '0→K', 'End');
  const KEYS = [[102, '0'], [92, '1'], [93, '2'], [94, '3'], [82, '4'], [83, '5'], [84, '6'], [72, '7'], [73, '8'], [74, '9'],
    [103, '.'], [95, '+'], [85, '-'], [75, '*'], [65, '/'], [55, '^'], [63, '('], [64, ')'], [62, ','],
    [61, '²'], [104, '⁻'], [52, 'sin('], [53, 'cos('], [54, 'tan('], [71, 'log('], [81, 'ln(']];
  for (const [k, s] of KEYS) add(`If K=${k}`, `Str1+"${s}"→Str1`);
  add('If K=105 and length(Str1)>0', 'Goto E0', 'Goto L0');

  // ---------- calcul (avec vérifications pour éviter les erreurs)
  add('Lbl E0',
    'sub(Str1,length(Str1),1)→Str2',
    'If inString("+-*/^(⁻,√(sin(cos(tan(log(ln(",Str2)', 'Goto L0',
    '0→B', '0→J',
    'For(I,1,length(Str1))',
    'sub(Str1,I,1)→Str2',
    'B+(inString("(√(sin(cos(tan(log(ln(",Str2)>0)-(Str2=")")→B',
    'If B<0', '1→J',
    'End',
    'If J', 'Goto L0',
    'A', 'expr(Str1)→A',
    'Str5→Str6', 'Str4→Str5', 'Str1→Str4',
    'S→T', 'R→S', 'A→R',
    'min(3,H+1)→H', '""→Str1', 'Goto C0');

  // ---------- quitter (remet les réglages du graphique comme avant)
  add('Lbl X0', 'RecallGDB 9', 'ClrDraw', 'ClrHome', 'Disp ⟦REVE : bonnes revisions !⟧', 'Stop');

  // ---------- fiches : menu des matières puis des chapitres
  add('Lbl F0', 'If P>0', 'Goto V0', 'Goto M0');
  const menu = (lbl, title, items, back) => {
    // Menu( : 9 choix max -> pages de 7 choix + « Suite » + « Retour »
    const chunks = [];
    for (let i = 0; i < items.length; i += 7) chunks.push(items.slice(i, i + 7));
    chunks.forEach((ch, k) => {
      const me = k === 0 ? lbl : lbl[0] + B36[(B36.indexOf(lbl[1]) + k) % 36];
      const next = lbl[0] + B36[(B36.indexOf(lbl[1]) + k + 1) % 36];
      const opts = ch.map(([t, l]) => `⟦${clip(t, 140)}⟧,${l}`);
      if (k < chunks.length - 1) opts.push(`⟦Suite...⟧,${next}`);
      opts.push(`⟦Retour au calcul⟧,${back}`);
      add(`Lbl ${me}`, `Menu(⟦${clip(title, 120)}⟧,${opts.join(',')})`);
    });
  };
  const subjLabel = (si) => 'S' + B36[si * 4 % 36]; // 4 étiquettes par matière pour les menus longs
  if (nSub <= 1) add('Lbl M0', `Goto ${subjLabel(0)}`);
  else menu('M0', 'REVE : MATIERES', subjects.map((s, si) => [tiText(s.name), subjLabel(si)]), 'C0');
  subjects.forEach((s, si) => {
    const items = chapters.map((c, ci) => ({ c, ci })).filter((x) => x.c.si === si)
      .map(({ c }) => [c.title.replace(/^(chapitre|chap\.?|partie|cours|le[cç]on)\s*\d+\s*[-:.]?\s*/i, '') || c.title, pageLabel(c.firstPage)]);
    if (!items.length) add(`Lbl ${subjLabel(si)}`, 'Goto C0');
    else menu(subjLabel(si), tiText(s.name).toUpperCase(), items, 'C0');
  });

  // ---------- affichage d'une page
  add('Lbl V0');
  pages.forEach((_, n) => add(`If P=${n + 1}`, `Goto ${pageLabel(n)}`));
  add('Goto C0');
  add('Lbl W0', '0→K', 'Repeat K', 'getKey→K', 'End',
    'If K=26', 'N→P', 'If K=24', 'M→P', 'If K=34', 'D→P', 'If K=25', 'U→P',
    'If K=41 or K=45', 'Goto C0',
    'If K=105', 'Goto F1',
    'If K=26 or K=24 or K=34 or K=25', 'Goto V0',
    'Goto W0');
  // [entrer] : menu des chapitres de la matière en cours (mémorisée dans Z)
  add('Lbl F1');
  subjects.forEach((_, si) => add(`If Z=${si}`, `Goto ${subjLabel(si)}`));
  add('Goto M0');

  pages.forEach((pg, n) => {
    const c = chapters[pg.ci];
    const col = SUBJECT_COLORS[c.si % SUBJECT_COLORS.length];
    const nextC = chapters[(pg.ci + 1) % chapters.length].firstPage + 1;
    const prevC = chapters[(pg.ci - 1 + chapters.length) % chapters.length].firstPage + 1;
    const pageInCh = n - c.firstPage + 1;
    const info = `Ch ${pg.ci + 1}/${chapters.length}` + (c.pageCount > 1 ? `  p${pageInCh}/${c.pageCount}` : '');
    add(`Lbl ${pageLabel(n)}`, `${n + 1}→P`, `${c.si}→Z`, 'ClrDraw',
      `TextColor(${col})`, `Text(2,4,⟦${clip(c.subject.toUpperCase(), 180)}⟧)`,
      'TextColor(GRAY)', `Text(2,${262 - textW(info)},⟦${info}⟧)`,
      'TextColor(BLACK)', `Text(14,4,⟦${clip(c.title, 256)}⟧)`,
      `Horizontal ⁻27,${col}`, `Horizontal ⁻28,${col}`);
    let cur = 'BLACK';
    const color = (x) => { if (x !== cur) { add(`TextColor(${x})`); cur = x; } };
    pg.lines.forEach((l, k) => {
      const y = ROW0 + k * LH;
      if (l.type) { color(TYPE_COLOR[l.type] || 'DARKGRAY'); add(`Text(${y},4,⟦${TYPE_LABEL[l.type] || '*'}⟧)`); }
      color('BLACK');
      add(`Text(${y},40,⟦${l.text}⟧)`);
    });
    color('GRAY');
    add('Text(153,4,⟦◄► chapitre  ▲▼ page  [entrer] menu  [math] calcul⟧)'.replace('◄►', TOK['◄'] ? '◄►' : '<>').replace('▲▼', TOK['▲'] ? '▲▼' : '^v'));
    add(`${nextC}→N`, `${prevC}→M`,
      `${Math.min(n + 2, c.firstPage + c.pageCount)}→D`,
      `${Math.max(n, c.firstPage + 1)}→U`, 'Goto W0');
  });
  return { lines: L, chapters, pages };
}

// Construit REVE.8xp en retirant d'abord les points les moins importants si c'est trop gros
function buildTIProgram(subjects, budget = 24000) {
  const subs = JSON.parse(JSON.stringify(subjects));
  let dropped = 0;
  for (;;) {
    const g = generate(subs);
    const tokens = tokenize(g.lines);
    if (tokens.length <= budget) return { file: build8xp('REVE', tokens), size: tokens.length, dropped, ...g };
    let worst = null;
    for (const s of subs) for (const c of s.chapters) {
      const vis = c.points.filter((p) => !p.hidden);
      if (vis.length <= 1) continue;
      for (const p of vis) if (!worst || (p.score ?? 0.5) < (worst.score ?? 0.5)) worst = p;
    }
    if (!worst) return { file: build8xp('REVE', tokens), size: tokens.length, dropped, ...g };
    worst.hidden = true;
    dropped++;
  }
}

module.exports = { generate, buildTIProgram, tiText, wrapPx, textW, TYPE_LABEL, TYPE_COLOR };
