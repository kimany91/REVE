// Entraîne REVE-Net sur tools/dataset.js et écrit src/main/analyzer/model.json
const fs = require('fs');
const path = require('path');
const { Net, featurize, CATS } = require('../src/main/analyzer/nn');
const data = require('./dataset');

const samples = data.map(([t, imp, cat]) => ({ x: featurize(t), imp, cat: CATS.indexOf(cat), t }));
const net = new Net(24);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

for (let epoch = 0; epoch < 400; epoch++) {
  for (let i = samples.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [samples[i], samples[j]] = [samples[j], samples[i]]; }
  let loss = 0;
  const lr = 0.08 * (1 - epoch / 450);
  for (const s of samples) loss += net.train(s.x, s.imp, s.cat, lr);
  if (epoch % 100 === 0) console.log('epoch', epoch, 'loss', (loss / samples.length).toFixed(4));
}
let okImp = 0, okCat = 0;
for (const s of samples) {
  const o = net.forward(s.x);
  if ((o.imp > 0.5 ? 1 : 0) === s.imp) okImp++;
  let b = 0; for (let k = 1; k < o.p.length; k++) if (o.p[k] > o.p[b]) b = k;
  if (b === s.cat) okCat++;
}
console.log(`précision importance ${(okImp / samples.length * 100).toFixed(1)}% · catégorie ${(okCat / samples.length * 100).toFixed(1)}%`);
fs.writeFileSync(path.join(__dirname, '../src/main/analyzer/model.json'), JSON.stringify(net.toJSON()));
console.log('model.json écrit');
