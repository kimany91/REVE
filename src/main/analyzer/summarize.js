// Transforme des documents de cours en fiches de révision triées par chapitre.
// Étapes : découpage en chapitres -> phrases -> note REVE-Net + TextRank -> sélection -> simplification.
const { classify } = require('./nn');

const CHAPTER_RX = /^\s*(chapitre|chap\.?|partie|le[cç]on|s[ée]quence|th[èe]me|module|unit[ée]|cours|cm|section)\s*[\dIVXLC]+\b/i;


function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function cleanTitle(name) {
  let t = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(\d+\s*[-.]\s*)/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function splitSentences(text) {
  const out = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/^[\s•▪◦●○■□➢➤►\-–*·]+/, '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const parts = line.split(/(?<=[.!?;])\s+(?=[A-ZÀ-ÖØ-Ý0-9«(])/);
    for (const p of parts) if (p.trim().length >= 4) out.push(p.trim());
  }
  return out;
}

// Rassemble les lignes coupées par la mise en page des PDF.
function mergeBrokenLines(text) {
  return text.replace(/([a-zà-ÿ,’'])\n(?=[a-zà-ÿ])/g, '$1 ');
}

function tokens(s) {
  return (stripAccents(s.toLowerCase()).match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w));
}
const STOP = new Set('les des une est dans pour par que qui sur avec son ses aux pas plus sont cette ces ont elle elles ils nous vous leur mais comme tout tous etre fait peut entre alors donc ainsi aussi tres bien sans sous apres avant lorsque quand dont celle celui cela ceci'.split(' '));

// TextRank simplifié : centralité de chaque phrase dans le chapitre.
function textRank(sentences) {
  const n = sentences.length;
  if (n === 0) return [];
  const toks = sentences.map((s) => tokens(s));
  const df = new Map();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const vecs = toks.map((t) => {
    const m = new Map();
    t.forEach((w) => m.set(w, (m.get(w) || 0) + 1));
    let norm = 0;
    for (const [w, c] of m) { const v = c * Math.log(1 + n / df.get(w)); m.set(w, v); norm += v * v; }
    return { m, norm: Math.sqrt(norm) || 1 };
  });
  const sim = (a, b) => { let s = 0; for (const [w, v] of a.m) if (b.m.has(w)) s += v * b.m.get(w); return s / (a.norm * b.norm); };
  const W = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const s = sim(vecs[i], vecs[j]); W[i][j] = s; W[j][i] = s; }
  const out = W.map((row) => row.reduce((a, b) => a + b, 0) || 1);
  let r = new Float32Array(n).fill(1 / n);
  for (let it = 0; it < 25; it++) {
    const nr = new Float32Array(n).fill(0.15 / n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (W[j][i]) nr[i] += 0.85 * r[j] * W[j][i] / out[j];
    r = nr;
  }
  const max = Math.max(...r) || 1;
  return Array.from(r, (x) => x / max);
}

// Raccourcit une phrase pour qu'elle reste simple et précise.
function simplify(s) {
  let t = s
    .replace(/^(en effet|ainsi|de plus|par ailleurs|donc|alors|enfin|or|en fait|d'autre part|tout d'abord|ensuite|notons que|on remarque que|on constate que|il faut savoir que|il est important de noter que|rappelons que|retenons que)\s*,?\s*/i, '')
    .replace(/\s*\((?:[^()]{40,})\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 190) {
    const cut = t.slice(0, 190);
    const idx = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('; '), cut.lastIndexOf(' : '));
    t = (idx > 90 ? cut.slice(0, idx) : cut.slice(0, cut.lastIndexOf(' '))) + '…';
  }
  t = t.replace(/[.;,:]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Découpe un document (blocs titre/texte) en chapitres.
function documentToChapters(doc) {
  const blocks = doc.blocks;
  const headingIdx = blocks.map((b, i) => (b.h && (CHAPTER_RX.test(b.text) || (b.h === 1 && blocks.filter((x) => x.h === 1).length > 1)) ? i : -1)).filter((i) => i >= 0);
  const chapters = [];
  if (headingIdx.length >= 2) {
    if (headingIdx[0] > 0) {
      const pre = blocks.slice(0, headingIdx[0]);
      if (pre.some((b) => !b.h && b.text.length > 200)) chapters.push({ title: cleanTitle(doc.name), blocks: pre });
    }
    headingIdx.forEach((start, k) => {
      const end = k + 1 < headingIdx.length ? headingIdx[k + 1] : blocks.length;
      chapters.push({ title: blocks[start].text.trim().slice(0, 70), blocks: blocks.slice(start + 1, end) });
    });
  } else {
    const firstH = blocks.find((b) => b.h && b.text.length > 3 && b.text.length < 80 && !/^(sommaire|plan|table)/i.test(b.text));
    const fromName = cleanTitle(doc.name);
    const title = /^(cours|cm|td|chap|chapitre|doc|document|support|slides?)\s*\d*$/i.test(fromName) && firstH ? firstH.text : fromName;
    chapters.push({ title, blocks });
  }
  return chapters;
}

function summarizeChapter(ch, opts = {}) {
  const sentences = [];
  for (const b of ch.blocks) {
    if (b.h) continue; // les sous-titres servent au découpage, pas au résumé
    for (const s of splitSentences(mergeBrokenLines(b.text))) sentences.push({ text: s, heading: false });
  }
  const body = sentences.filter((s) => !s.heading && s.text.length >= 8 && s.text.length <= 600);
  // dédoublonnage
  const seen = new Set();
  const uniq = body.filter((s) => { const k = stripAccents(s.text.toLowerCase()).replace(/[^a-z0-9]/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
  const tr = textRank(uniq.map((s) => s.text));
  const scored = uniq.map((s, i) => {
    const c = classify(s.text);
    let score = 0.6 * c.importance + 0.3 * tr[i] + (c.type === 'bruit' ? -0.5 : 0.1);
    if (c.type === 'ex') score -= 0.12;
    return { ...s, ...c, score, order: i };
  });
  const maxPts = opts.maxPoints || Math.max(4, Math.min(14, Math.ceil(uniq.length * 0.7)));
  const chosen = scored.filter((s) => s.score > 0.55).sort((a, b) => b.score - a.score).slice(0, maxPts).sort((a, b) => a.order - b.order);
  return {
    title: ch.title,
    points: chosen.map((s) => ({ type: s.type === 'bruit' ? 'fait' : s.type, text: simplify(s.text), score: Math.round(s.score * 100) / 100 })),
    stats: { sentences: uniq.length },
  };
}

function summarizeDocuments(docs, opts = {}) {
  const chapters = [];
  for (const doc of docs) {
    if (!doc.blocks || !doc.blocks.length) continue;
    for (const ch of documentToChapters(doc)) {
      const s = summarizeChapter(ch, opts);
      if (s.points.length) chapters.push(s);
    }
  }
  // Tri par numéro de chapitre quand il y en a un
  const num = (t) => { const m = t.match(/(?:chapitre|chap\.?|partie|cm|cours|le[cç]on|s[ée]quence)\s*(\d+)/i) || t.match(/^(\d+)\b/); return m ? parseInt(m[1], 10) : null; };
  if (chapters.every((c) => num(c.title) !== null)) chapters.sort((a, b) => num(a.title) - num(b.title));
  return chapters;
}

module.exports = { summarizeDocuments, summarizeChapter, splitSentences, simplify, cleanTitle };
