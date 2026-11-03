// Génère les scripts calculatrice à partir des données de démo (pour tests et captures).
const fs = require('fs');
const path = require('path');
const { buildScript, build8xv } = require('../src/main/calc/generate');
const userData = process.argv[2];
const out = process.argv[3];
const state = JSON.parse(fs.readFileSync(path.join(userData, 'reve.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });
const nw = buildScript(state.subjects, { model: 'numworks', key: 'toolbox' });
fs.writeFileSync(path.join(out, 'reve.py'), nw.code);
const ti = buildScript(state.subjects, { model: 'ti83' });
fs.writeFileSync(path.join(out, 'REVE.py'), ti.code);
fs.writeFileSync(path.join(out, 'REVE.8xv'), build8xv('REVE', ti.code));
console.log('NumWorks', nw.code.length, 'octets ·', nw.T.length, 'chapitres | TI', ti.code.length, 'octets');
