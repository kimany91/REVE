// Transforme du TI-Basic (texte) en octets pour TI-83 Premium CE / TI-84 Plus CE,
// avec la table officielle des jetons (tokens.json, tirée de TI-Toolkit/tivars).
//
// Dans le texte source :
//   "..."  chaîne "code"  : son contenu est découpé en jetons (sin(, Ans, π…)
//   ⟦...⟧  chaîne "texte" : son contenu est gardé caractère par caractère
const TOK = require('./tokens.json');

const byFirst = new Map();
for (const name of Object.keys(TOK)) {
  const f = name[0];
  if (!byFirst.has(f)) byFirst.set(f, []);
  byFirst.get(f).push(name);
}
for (const list of byFirst.values()) list.sort((a, b) => b.length - a.length);

const hexBytes = (h) => h.match(/../g).map((x) => parseInt(x, 16));

function tokenizeLine(line, out) {
  let i = 0;
  let mode = 'code';
  while (i < line.length) {
    const ch = line[i];
    if (mode === 'text') {
      if (ch === '⟧') { out.push(0x2a); mode = 'code'; i++; continue; }
      const c = String.fromCodePoint(line.codePointAt(i));
      const h = TOK[c];
      if (!h) throw new Error(`Caractère impossible sur TI : « ${c} »`);
      out.push(...hexBytes(h));
      i += c.length;
      continue;
    }
    if (ch === '⟦') { out.push(0x2a); mode = 'text'; i++; continue; }
    let match = null;
    for (const n of byFirst.get(ch) || []) if (line.startsWith(n, i)) { match = n; break; }
    if (!match) throw new Error(`Jeton inconnu : « ${line.slice(i, i + 12)} »`);
    out.push(...hexBytes(TOK[match]));
    i += match.length;
  }
}

function tokenize(lines) {
  const out = [];
  lines.forEach((l, k) => {
    if (k) out.push(0x3f);
    tokenizeLine(l, out);
  });
  return Buffer.from(out);
}

// Fichier .8xp (programme TI-Basic), rangé en RAM pour être visible dans [prgm]
function build8xp(name, tokens) {
  const varName = Buffer.alloc(8);
  Buffer.from(name.toUpperCase().slice(0, 8), 'ascii').copy(varName);
  const varData = Buffer.alloc(2 + tokens.length);
  varData.writeUInt16LE(tokens.length, 0);
  tokens.copy(varData, 2);
  if (varData.length > 0xffef) throw new Error('Programme trop gros pour la calculatrice');
  const entry = Buffer.alloc(17 + varData.length);
  entry.writeUInt16LE(0x0d, 0);
  entry.writeUInt16LE(varData.length, 2);
  entry[4] = 0x05; // programme
  varName.copy(entry, 5);
  entry[13] = 0x0a; // version : fonctions couleur de la CE
  entry[14] = 0; // en RAM
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

module.exports = { tokenize, build8xp, TOK };
