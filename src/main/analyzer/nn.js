// REVE-Net : petit réseau de neurones (perceptron multicouche) intégré.
// Il note chaque phrase d'un cours : est-elle importante ? de quel type est-elle ?
// Tout tourne en local, sans internet et sans service externe.

const HASH_DIM = 192;
const CATS = ['def', 'form', 'loi', 'meth', 'ex', 'fait', 'bruit'];

function strip(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % HASH_DIM;
}

const RX = {
  def: /\b(on appelle|on nomme|on definit|se definit|est defini|est appele|designe|definition|est dite?|signifie|c'est-a-dire)\b/,
  loi: /\b(theoreme|loi|propriete|principe|regle|corollaire|lemme|postulat|toujours|si .* alors)\b/,
  meth: /\b(methode|pour (calculer|determiner|resoudre|trouver|montrer|demontrer|analyser|etudier|tracer)|etapes?|on commence|il faut|on utilise|on applique)\b/,
  ex: /\b(exemple|par ex|ex ?:|illustr|prenons|cas de)\b/,
  noise: /(page \d|https?:|www\.|@|\bcf\.|copyright|©|tous droits|merci|bonjour|bienvenue|sommaire|table des matieres|\btd\b|\btp\b|exercice \d|seance|voir annexe|mail|professeur|universite|lycee|version du|a faire pour|moodle)/,
  unit: /\b\d+([.,]\d+)?\s?(m|cm|mm|km|s|ms|kg|g|n|j|w|v|a|hz|nm|mol|l|pa|k|°c|dioptries?|ω|ohms?)\b/,
  date: /\b(1[0-9]{3}|20[0-9]{2})\b/,
};

function featurize(sentence) {
  const v = new Float32Array(HASH_DIM + 16);
  const s = strip(sentence);
  const words = s.match(/[a-z0-9²³']+/g) || [];
  for (const w of words) v[hash('w:' + w)] += 1;
  for (let i = 0; i + 1 < words.length; i++) v[hash('b:' + words[i] + ' ' + words[i + 1])] += 0.7;
  // normalisation L2 de la partie "mots"
  let n = 0;
  for (let i = 0; i < HASH_DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < HASH_DIM; i++) v[i] /= n;

  const o = HASH_DIM;
  const len = sentence.length;
  v[o + 0] = Math.min(len / 200, 1.5);
  v[o + 1] = len < 25 ? 1 : 0;
  v[o + 2] = /=/.test(sentence) ? 1 : 0;
  v[o + 3] = (sentence.match(/[0-9]/g) || []).length / Math.max(len, 1) * 5;
  v[o + 4] = RX.def.test(s) ? 1 : 0;
  v[o + 5] = RX.loi.test(s) ? 1 : 0;
  v[o + 6] = RX.meth.test(s) ? 1 : 0;
  v[o + 7] = RX.ex.test(s) ? 1 : 0;
  v[o + 8] = RX.noise.test(s) ? 1 : 0;
  v[o + 9] = RX.unit.test(s) ? 1 : 0;
  v[o + 10] = /[²³^√∫∑Δλγπθαβµμ×÷]|\b(sin|cos|tan|log|ln|exp|lim)\b/.test(sentence) ? 1 : 0;
  v[o + 11] = /\?\s*$/.test(sentence) ? 1 : 0;
  v[o + 12] = /^[A-ZÉÈ0-9\s'\-:]+$/.test(sentence) && len < 60 ? 1 : 0;
  v[o + 13] = /:/.test(sentence) ? 1 : 0;
  v[o + 14] = RX.date.test(s) ? 1 : 0;
  v[o + 15] = words.length > 4 && /\b(est|sont|vaut|egal|egale)\b/.test(s) ? 1 : 0;
  return v;
}

const INPUT_DIM = HASH_DIM + 16;

class Net {
  constructor(hidden = 24, weights = null) {
    this.H = hidden;
    this.O = 1 + CATS.length;
    if (weights) {
      Object.assign(this, weights);
      this.W1 = Float32Array.from(weights.W1);
      this.b1 = Float32Array.from(weights.b1);
      this.W2 = Float32Array.from(weights.W2);
      this.b2 = Float32Array.from(weights.b2);
    } else {
      let seed = 42;
      const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
      this.W1 = Float32Array.from({ length: INPUT_DIM * hidden }, () => rnd() * 0.3);
      this.b1 = new Float32Array(hidden);
      this.W2 = Float32Array.from({ length: hidden * this.O }, () => rnd() * 0.3);
      this.b2 = new Float32Array(this.O);
    }
  }

  forward(x) {
    const { H, O, W1, b1, W2, b2 } = this;
    const h = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let s = b1[j];
      for (let i = 0; i < INPUT_DIM; i++) if (x[i] !== 0) s += x[i] * W1[i * H + j];
      h[j] = Math.tanh(s);
    }
    const z = new Float32Array(O);
    for (let k = 0; k < O; k++) {
      let s = b2[k];
      for (let j = 0; j < H; j++) s += h[j] * W2[j * O + k];
      z[k] = s;
    }
    const imp = 1 / (1 + Math.exp(-z[0]));
    let m = -Infinity;
    for (let k = 1; k < O; k++) m = Math.max(m, z[k]);
    let sum = 0;
    const p = new Float32Array(CATS.length);
    for (let k = 1; k < O; k++) { p[k - 1] = Math.exp(z[k] - m); sum += p[k - 1]; }
    for (let k = 0; k < p.length; k++) p[k] /= sum;
    return { h, imp, p };
  }

  // Un pas de descente de gradient (utilisé seulement pendant l'entraînement)
  train(x, yImp, yCat, lr) {
    const { H, O, W1, b1, W2, b2 } = this;
    const { h, imp, p } = this.forward(x);
    const dz = new Float32Array(O);
    dz[0] = imp - yImp;
    for (let k = 0; k < CATS.length; k++) dz[k + 1] = p[k] - (k === yCat ? 1 : 0);
    const dh = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let s = 0;
      for (let k = 0; k < O; k++) { s += dz[k] * W2[j * O + k]; W2[j * O + k] -= lr * dz[k] * h[j]; }
      dh[j] = s * (1 - h[j] * h[j]);
    }
    for (let k = 0; k < O; k++) b2[k] -= lr * dz[k];
    for (let j = 0; j < H; j++) {
      b1[j] -= lr * dh[j];
      for (let i = 0; i < INPUT_DIM; i++) if (x[i] !== 0) W1[i * H + j] -= lr * dh[j] * x[i];
    }
    return -Math.log(yImp ? imp + 1e-9 : 1 - imp + 1e-9) - Math.log(p[yCat] + 1e-9);
  }

  toJSON() {
    const r = (a) => Array.from(a, (x) => Math.round(x * 10000) / 10000);
    return { H: this.H, O: this.O, W1: r(this.W1), b1: r(this.b1), W2: r(this.W2), b2: r(this.b2) };
  }
}

let cached = null;
function loadModel() {
  if (!cached) cached = new Net(24, require('./model.json'));
  return cached;
}

function classify(sentence) {
  const out = loadModel().forward(featurize(sentence));
  let best = 0;
  for (let k = 1; k < out.p.length; k++) if (out.p[k] > out.p[best]) best = k;
  return { importance: out.imp, type: CATS[best], confidence: out.p[best] };
}

module.exports = { Net, featurize, classify, CATS, INPUT_DIM };
