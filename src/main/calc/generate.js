// Construit l'app REVE pour calculatrice à partir des fiches de révision.
const fs = require('fs');
const path = require('path');

const TYPES = ['def', 'form', 'loi', 'meth', 'ex', 'fait'];

const MODELS = {
  numworks: { name: 'NumWorks', titleCols: 31, textCols: 27, defaultBudget: 14000, template: 'numworks.py', ascii: false },
  ti83: { name: 'TI-83 Premium CE', titleCols: 26, textCols: 22, defaultBudget: 7000, template: 'ti.py', ascii: true },
};

// Touches possibles pour ouvrir/fermer le mode révision sur NumWorks
const NUMWORKS_KEYS = {
  toolbox: { label: 'Boîte à outils', code: 'ion.KEY_TOOLBOX' },
  var: { label: 'var', code: 'ion.KEY_VAR' },
  xnt: { label: 'x,n,t', code: 'ion.KEY_XNT' },
  alpha: { label: 'alpha', code: 'ion.KEY_ALPHA' },
  imaginary: { label: 'i', code: 'ion.KEY_IMAGINARY' },
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
  // copie des points avec leurs priorités
  const chapters = [];
  for (const s of subjects) for (const c of s.chapters) {
    if (c.hidden) continue;
    const pts = c.points.filter((p) => !p.hidden).map((p, i) => ({ ...p, i }));
    if (pts.length) chapters.push({ subject: s.name, title: c.title, points: pts });
  }
  const render = () => {
    const T = []; const L = [];
    for (const c of chapters) {
      const subj = sanitize(c.subject, m.ascii);
      const title = sanitize(c.title, m.ascii);
      T.push(subj.split(/\s+-\s+|\s+/)[0].slice(0, 10) + ': ' + title);
      const lines = [];
      for (const l of wrap(subj + ' > ' + title, m.titleCols)) lines.push('#' + l);
      for (const p of c.points) {
        const ty = Math.max(0, TYPES.indexOf(p.type));
        const wl = wrap(sanitize(p.text, m.ascii), m.textCols);
        wl.forEach((l, k) => lines.push((k === 0 ? String(ty) : ' ') + l));
      }
      L.push(lines);
    }
    const data = 'T=[' + T.map(pyStr).join(',') + ']\nL=[\n' + L.map((ls) => '[' + ls.map(pyStr).join(',\n') + ']').join(',\n') + '\n]\n';
    return { T, L, data };
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
  const m = MODELS[modelId];
  const built = buildData(subjects, modelId, opts.budget);
  let keyLine;
  if (modelId === 'numworks') keyLine = 'KREVE=' + (NUMWORKS_KEYS[opts.key] || NUMWORKS_KEYS.toolbox).code + '\n';
  else keyLine = 'KREVE=-1\n';
  const tpl = fs.readFileSync(path.join(__dirname, 'templates', m.template), 'utf8');
  const code = tpl.replace('#__DATA__\n', keyLine + built.data);
  return { code, ...built, model: modelId };
}

// Fichier .8xv (variable d'application Python) pour TI-83 Premium CE / TI-84 Plus CE
function build8xv(name, code) {
  const varName = Buffer.alloc(8);
  Buffer.from(name.toUpperCase().slice(0, 8), 'ascii').copy(varName);
  const content = Buffer.concat([Buffer.from('PYCD', 'ascii'), Buffer.from([0]), Buffer.from(code.replace(/\r?\n/g, '\n'), 'latin1')]);
  const varData = Buffer.alloc(2 + content.length);
  varData.writeUInt16LE(content.length, 0);
  content.copy(varData, 2);
  if (varData.length > 0xffef) throw new Error('Script trop gros pour la calculatrice');
  const entry = Buffer.alloc(17 + varData.length);
  entry.writeUInt16LE(0x0d, 0);
  entry.writeUInt16LE(varData.length, 2);
  entry[4] = 0x15; // AppVar
  varName.copy(entry, 5);
  entry[13] = 0; // version
  entry[14] = 0x80; // archivée
  entry.writeUInt16LE(varData.length, 15);
  varData.copy(entry, 17);
  const header = Buffer.alloc(55);
  header.write('**TI83F*', 0, 'ascii');
  header[8] = 0x1a; header[9] = 0x0a; header[10] = 0x00;
  header.write('REVE - fiches de revision', 11, 'ascii');
  header.writeUInt16LE(entry.length, 53);
  let sum = 0;
  for (const b of entry) sum = (sum + b) & 0xffff;
  const cs = Buffer.alloc(2);
  cs.writeUInt16LE(sum, 0);
  return Buffer.concat([header, entry, cs]);
}

module.exports = { buildScript, buildData, build8xv, sanitize, wrap, MODELS, NUMWORKS_KEYS };
