// Construit l'app REVE pour calculatrice à partir des fiches de révision.
const fs = require('fs');
const path = require('path');
const { buildTIProgram } = require('./ti/program');

const TYPES = ['def', 'form', 'loi', 'meth', 'ex', 'fait'];

const MODELS = {
  numworks: { name: 'NumWorks', titleCols: 31, textCols: 27, defaultBudget: 16000, template: 'numworks.py', ascii: false },
  ti83: { name: 'TI-83 Premium CE', defaultBudget: 24000 },
};

// Touches possibles pour ouvrir/fermer le mode révision sur NumWorks
const NUMWORKS_KEYS = {
  toolbox: { label: 'Boîte à outils', short: 'outils', code: 'ion.KEY_TOOLBOX' },
  var: { label: 'var', short: 'var', code: 'ion.KEY_VAR' },
  xnt: { label: 'x,n,t', short: 'x,n,t', code: 'ion.KEY_XNT' },
  alpha: { label: 'alpha', short: 'alpha', code: 'ion.KEY_ALPHA' },
  imaginary: { label: 'i', short: 'i', code: 'ion.KEY_IMAGINARY' },
};

const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', Δ: 'Delta', ε: 'epsilon', η: 'eta', λ: 'lambda', ν: 'nu', ρ: 'rho', σ: 'sigma', Σ: 'Somme', τ: 'tau', φ: 'phi', Φ: 'Phi', ω: 'omega', Ω: 'Ohm', ψ: 'psi', χ: 'khi', ξ: 'xi', κ: 'kappa' };
const COMMON = { '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '–': '-', '—': '-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '→': '->', '⇒': '=>', '⇔': '<=>', '√': 'sqrt', '∞': 'inf', 'œ': 'oe', 'Œ': 'OE', '∈': ' dans ', '∫': 'integrale ', '•': '-', ' ': ' ', ' ': ' ', '−': '-' };

function sanitize(s, ascii) {
  let t = '';
  for (const ch of s) {
    if (COMMON[ch] !== undefined) t += COMMON[ch];
    else if (GREEK[ch] && (ascii || !'θπ'.includes(ch))) t += GREEK[ch];
    else t += ch;
  }
  if (ascii) {
    t = t.replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/°/g, ' deg').replace(/[µμ]/g, 'u').replace(/π/g, 'pi').replace(/θ/g, 'theta').replace(/[«»]/g, '"')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/[^\x20-\x7e]/g, '');
  } else {
    t = t.replace(/[^\x20-\x7e¡-ÿπθ]/g, '');
  }
  return t.replace(/\s+/g, ' ').trim();
}

function wrap(text, cols) {
  const out = [];
  let line = '';
  for (let w of text.split(' ')) {
    while (w.length > cols) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, cols)); w = w.slice(cols); }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cols) line += ' ' + w;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

function pyStr(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// subjects : [{ name, chapters: [{ title, points: [{type, text, score}] }] }]
function buildData(subjects, modelId, budget) {
  const m = MODELS[modelId];
  budget = budget || m.defaultBudget;
  const chapters = [];
  const names = [];
  for (const s of subjects) {
    const si = names.length;
    let any = false;
    for (const c of s.chapters) {
      if (c.hidden) continue;
      const pts = c.points.filter((p) => !p.hidden).map((p, i) => ({ ...p, i }));
      if (pts.length) { chapters.push({ si, title: c.title, points: pts }); any = true; }
    }
    if (any) names.push(sanitize(s.name, m.ascii));
  }
  const render = () => {
    const T = []; const L = []; const CS = [];
    for (const c of chapters) {
      const title = sanitize(c.title, m.ascii);
      T.push(title.replace(/^(chapitre|chap\.?|partie|cours|le[cç]on)\s*(\d+)\s*[-:.]?\s*/i, '$2. '));
      CS.push(c.si);
      const lines = [];
      for (const l of wrap(title, m.titleCols)) lines.push('#' + l);
      for (const p of c.points) {
        const ty = Math.max(0, TYPES.indexOf(p.type));
        const wl = wrap(sanitize(p.text, m.ascii), m.textCols);
        wl.forEach((l, k) => lines.push((k === 0 ? String(ty) : ' ') + l));
      }
      L.push(lines);
    }
    const data = 'SN=[' + names.map(pyStr).join(',') + ']\nCS=[' + CS.join(',') + ']\nT=[' + T.map(pyStr).join(',') + ']\nL=[\n' + L.map((ls) => '[' + ls.map(pyStr).join(',\n') + ']').join(',\n') + '\n]\n';
    return { T, L, CS, SN: names, data };
  };
  let r = render();
  let dropped = 0;
  // Trop gros : on retire les points les moins importants (en gardant 1 point par chapitre)
  while (Buffer.byteLength(r.data, 'utf8') > budget) {
    let worst = null;
    for (const c of chapters) {
      if (c.points.length <= 1) continue;
      for (const p of c.points) if (!worst || (p.score ?? 0.5) < (worst.p.score ?? 0.5)) worst = { c, p };
    }
    if (!worst) break;
    worst.c.points.splice(worst.c.points.indexOf(worst.p), 1);
    dropped++;
    r = render();
  }
  return { ...r, dropped, bytes: Buffer.byteLength(r.data, 'utf8') };
}

function buildScript(subjects, opts = {}) {
  const modelId = opts.model || 'numworks';
  if (modelId === 'ti83') {
    const r = buildTIProgram(subjects, opts.budget || MODELS.ti83.defaultBudget);
    return { model: 'ti83', file: r.file, bytes: r.size, dropped: r.dropped, pages: r.pages, chapters: r.chapters };
  }
  const m = MODELS[modelId];
  const built = buildData(subjects, modelId, opts.budget);
  const k = NUMWORKS_KEYS[opts.key] || NUMWORKS_KEYS.toolbox;
  const keyLine = 'KREVE=' + k.code + '\nKN=' + pyStr(k.short) + '\n';
  const tpl = fs.readFileSync(path.join(__dirname, 'templates', m.template), 'utf8');
  const code = tpl.replace('#__DATA__\n', keyLine + built.data);
  return { code, ...built, model: modelId };
}

module.exports = { buildScript, buildData, sanitize, wrap, MODELS, NUMWORKS_KEYS };
