// Aperçu interactif de l'app REVE sur la calculatrice.
// Reproduit l'affichage du script Python envoyé sur la NumWorks / TI.
(function () {
  const CO = ['rgb(0,90,200)', 'rgb(200,30,30)', 'rgb(130,50,170)', 'rgb(0,140,70)', 'rgb(220,120,0)', 'rgb(70,70,70)'];
  const LB_NW = ['DEF ', 'FORM', 'LOI ', 'METH', 'EX  ', '  > '];
  const LB_TI = ['DEF', 'FORM', 'LOI', 'METH', 'EX', '>'];

  function fmt(v) {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error();
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return String(parseFloat(v.toPrecision(10)));
  }
  // Petit analyseur d'expressions (pas d'eval : interdit par la sécurité de l'app)
  const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, exp: Math.exp };
  function evaluate(e, ans) {
    const src = e.replace(/Ans/g, '(' + ans + ')');
    let i = 0;
    const peek = () => src[i];
    const num = () => {
      const m = /^\d*\.?\d+(?:E-?\d+)?|^\d+\./.exec(src.slice(i));
      if (!m) throw new Error();
      i += m[0].length;
      return parseFloat(m[0].replace('E', 'e'));
    };
    const atom = () => {
      if (peek() === '(') { i++; const v = add(); if (peek() === ')') i++; return v; }
      if (peek() === '-') { i++; return -pow(); }
      const w = /^[a-z]+/.exec(src.slice(i));
      if (w) {
        i += w[0].length;
        if (w[0] === 'pi') return Math.PI;
        if (!FN[w[0]] || peek() !== '(') throw new Error();
        i++; const v = add(); if (peek() === ')') i++;
        return FN[w[0]](v);
      }
      return num();
    };
    const pow = () => { const b = atom(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
    const mul = () => { let v = pow(); while (peek() === '*' || peek() === '/') { const o = src[i++]; const r = pow(); v = o === '*' ? v * r : v / r; } return v; };
    const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const o = src[i++]; const r = mul(); v = o === '+' ? v + r : v - r; } return v; };
    try { const v = add(); if (i !== src.length) throw new Error(); return fmt(v); } catch { return 'Erreur'; }
  }

  class CalcSim {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.model = 'numworks';
      this.T = []; this.L = [];
      this.reset();
    }
    reset() { this.mode = 'calc'; this.h = []; this.e = ''; this.ans = '0'; this.c = 0; this.o = 0; this.sel = 0; }
    setData(model, T, L) {
      const changed = model !== this.model;
      this.model = model; this.T = T; this.L = L;
      this.cv.height = model === 'ti83' ? 210 : 222;
      if (changed) this.reset();
      if (this.c >= T.length) { this.c = 0; this.o = 0; }
      this.draw();
    }
    // ----- dessin -----
    R(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); }
    S(t, x, y, c) {
      const ti = this.model === 'ti83';
      this.ctx.fillStyle = c;
      this.ctx.textBaseline = 'top';
      if (ti) { this.ctx.font = '12px "Segoe UI", Arial, sans-serif'; this.ctx.fillText(t, x, y + 2); return; }
      this.ctx.font = '15px "DejaVu Sans Mono", Consolas, Menlo, monospace';
      for (let i = 0; i < t.length; i++) this.ctx.fillText(t[i], x + i * 10 + 1, y + 1);
    }
    draw() {
      const ti = this.model === 'ti83';
      if (!this.T.length && this.mode !== 'calc') this.mode = 'calc';
      if (this.mode === 'calc') return ti ? this.drawCalcTI() : this.drawCalcNW();
      if (this.mode === 'menu') return this.drawMenu();
      return this.drawRev();
    }
    drawCalcNW() {
      this.R(0, 0, 320, 222, '#fff');
      this.R(0, 0, 320, 20, 'rgb(255,183,52)');
      this.S('CALCULS', 125, 1, '#fff');
      let y = 170;
      for (let i = this.h.length - 1; i >= 0 && y >= 40; i--, y -= 40) {
        const [x, r] = this.h[i];
        const rr = r.slice(-31);
        this.S(rr, 316 - 10 * rr.length, y, '#000');
        this.S(x.slice(-31), 4, y - 18, 'rgb(110,110,110)');
        this.R(0, y - 21, 320, 1, 'rgb(238,238,238)');
      }
      this.R(0, 192, 320, 1, 'rgb(110,110,110)');
      this.S(this.e.slice(-30) + '_', 4, 198, '#000');
    }
    drawCalcTI() {
      this.R(0, 0, 320, 210, '#fff');
      this.R(0, 0, 320, 18, 'rgb(40,40,40)');
      this.S('CALCULS', 4, 2, '#fff');
      this.S('REVE: [math]', 150, 2, 'rgb(255,200,60)');
      let y = 150;
      for (let i = this.h.length - 1; i >= 0 && y >= 40; i--, y -= 38) {
        const [x, r] = this.h[i];
        this.S(x.slice(-28), 4, y - 18, 'rgb(110,110,110)');
        this.S('= ' + r.slice(-14), 150, y, '#000');
      }
      this.R(0, 182, 320, 1, 'rgb(110,110,110)');
      this.S(this.e.slice(-28) + '_', 4, 188, '#000');
    }
    drawRev() {
      const ti = this.model === 'ti83';
      const W = 320, H = ti ? 210 : 222, top = ti ? 18 : 20, lh = ti ? 17 : 18, y0 = ti ? 21 : 22, lx = ti ? 42 : 40;
      const BL = 'rgb(46,92,201)';
      this.R(0, 0, W, H, '#fff');
      this.R(0, 0, W, top, BL);
      const p = (this.c + 1) + '/' + this.T.length;
      const t = this.T[this.c] || '';
      if (ti) { this.S(t.slice(0, 27 - p.length), 4, 2, '#fff'); this.S(p, 286 - 6 * p.length, 2, '#fff'); }
      else { this.S(t.slice(0, 31 - p.length), 4, 1, '#fff'); this.S(p, 316 - 10 * p.length, 1, '#fff'); }
      const ls = this.L[this.c] || [];
      let y = y0;
      for (let i = this.o; i < Math.min(this.o + 11, ls.length); i++, y += lh) {
        const l = ls[i], d = l[0];
        if ('012345'.includes(d)) { this.S((ti ? LB_TI : LB_NW)[+d], 0, y, CO[+d]); this.S(l.slice(1), lx, y, '#000'); }
        else if (d === '#') this.S(l.slice(1), 0, y, BL);
        else this.S(l.slice(1), lx, y, '#000');
      }
      const n = ls.length, area = 11 * lh;
      if (n > 11) { const hb = Math.max(10, Math.floor(area * 11 / n)); this.R(316, y0 + Math.floor((area - hb) * this.o / (n - 11)), 4, hb, 'rgb(110,110,110)'); }
    }
    drawMenu() {
      const BL = 'rgb(46,92,201)';
      this.R(0, 0, 320, 222, '#fff');
      this.R(0, 0, 320, 20, BL);
      this.S('CHAPITRES', 115, 1, '#fff');
      const a = Math.max(0, Math.min(this.sel - 5, this.T.length - 11));
      let y = 22;
      for (let i = a; i < Math.min(a + 11, this.T.length); i++, y += 18) {
        if (i === this.sel) { this.R(0, y, 320, 18, BL); this.S(this.T[i].slice(0, 32), 0, y, '#fff'); }
        else this.S(this.T[i].slice(0, 32), 0, y, '#000');
      }
    }
    // ----- touches -----
    key(k) {
      const ti = this.model === 'ti83';
      const n = (this.L[this.c] || []).length;
      if (this.mode === 'calc') {
        if (k === 'reve') { if (this.T.length) this.mode = 'rev'; }
        else if (k === 'del') { this.e = this.e.slice(0, -1); }
        else if (k === 'exe' || (k === 'ok' && !ti)) {
          if (this.e) { const r = evaluate(this.e, this.ans); if (r !== 'Erreur') this.ans = r; this.h.push([this.e, r]); this.h = this.h.slice(ti ? -4 : -5); this.e = ''; }
        } else if (k.length === 1 || /^(sqrt\(|pi|\^2)$/.test(k)) this.e += k;
      } else if (this.mode === 'rev') {
        if (k === 'reve') this.mode = 'calc';
        else if (k === 'down' && this.o < n - 11) this.o++;
        else if (k === 'up' && this.o > 0) this.o--;
        else if (k === 'right') { this.c = (this.c + 1) % this.T.length; this.o = 0; }
        else if (k === 'left') { this.c = (this.c - 1 + this.T.length) % this.T.length; this.o = 0; }
        else if ((k === 'ok' || k === 'exe') && !ti) { this.mode = 'menu'; this.sel = this.c; }
      } else if (this.mode === 'menu') {
        if (k === 'up' && this.sel > 0) this.sel--;
        else if (k === 'down' && this.sel < this.T.length - 1) this.sel++;
        else if (k === 'ok' || k === 'exe') { this.c = this.sel; this.o = 0; this.mode = 'rev'; }
        else if (k === 'reve' || k === 'del') this.mode = 'rev';
      }
      this.draw();
    }
  }
  window.CalcSim = CalcSim;
})();
