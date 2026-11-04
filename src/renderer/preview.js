// Aperçu interactif de l'app REVE sur la calculatrice (copie fidèle de ce que
// font le script NumWorks et le programme TI-Basic envoyés).
(function () {
  const FN = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, exp: Math.exp };
  function fmt(v) {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error();
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return String(parseFloat(v.toPrecision(10)));
  }
  // Petit analyseur d'expressions (pas d'eval : interdit par la sécurité de l'app)
  function evaluate(e, ans, deg) {
    const src = e.replace(/Ans/g, '(' + ans + ')').replace(/√\(/g, 'sqrt(').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/⁻/g, '-');
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
        i++; let v = add(); if (peek() === ')') i++;
        if (deg && /^(sin|cos|tan)$/.test(w[0])) v = (v * Math.PI) / 180;
        return FN[w[0]](v);
      }
      return num();
    };
    const pow = () => { const b = atom(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
    const mul = () => { let v = pow(); while (peek() === '*' || peek() === '/') { const o = src[i++]; const r = pow(); v = o === '*' ? v * r : v / r; } return v; };
    const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const o = src[i++]; const r = mul(); v = o === '+' ? v + r : v - r; } return v; };
    try { const v = add(); if (i !== src.length) throw new Error(); return fmt(v); } catch { return 'Erreur'; }
  }

  // ---------------------------------------------------------------- NumWorks
  const NW = {
    W: '#fff', N: 'rgb(30,30,40)', G: 'rgb(120,120,130)', LG: 'rgb(232,232,238)', OR: 'rgb(255,183,52)',
    SC: ['rgb(46,92,201)', 'rgb(214,64,64)', 'rgb(0,140,90)', 'rgb(140,70,190)', 'rgb(230,120,0)', 'rgb(0,130,170)'],
    CO: ['rgb(46,110,230)', 'rgb(214,50,50)', 'rgb(140,70,190)', 'rgb(0,150,80)', 'rgb(235,130,0)', 'rgb(110,110,120)'],
    LB: ['DEF', 'FORM', 'LOI', 'METH', 'EX', 'INFO'],
  };
  // ---------------------------------------------------------------- TI-83 Premium CE
  const TIC = { BLUE: '#0000ff', RED: '#ff0000', BLACK: '#000', MAGENTA: '#ff00ff', GREEN: '#009e00', ORANGE: '#ff8c00', BROWN: '#964b00', NAVY: '#000080', GRAY: '#808080', DARKGRAY: '#505050', LTGRAY: '#d2d2d2' };
  const TI_TYPE = { def: ['DEF', 'BLUE'], form: ['FORM', 'RED'], loi: ['LOI', 'MAGENTA'], meth: ['METH', 'GREEN'], ex: ['EX', 'ORANGE'], fait: ['INFO', 'DARKGRAY'] };
  const TI_SUBJ = ['NAVY', 'RED', 'GREEN', 'MAGENTA', 'ORANGE', 'BLUE', 'BROWN'];

  class CalcSim {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.model = null;
      this.d = null;
      this.keyName = 'outils';
    }
    reset() {
      this.mode = 'calc'; this.h = []; this.e = ''; this.ans = '0';
      this.c = -1; this.o = 0; this.list = null; this.p = 0; this.subj = 0;
    }
    setData(model, data, keyName) {
      if (model !== this.model) { this.model = model; this.reset(); }
      this.d = data; this.keyName = keyName || this.keyName;
      this.cv.width = 320; this.cv.height = model === 'ti83' ? 240 : 222;
      const n = model === 'ti83' ? (data.pages || []).length : (data.T || []).length;
      if (this.mode !== 'calc' && !n) this.mode = 'calc';
      if (model === 'ti83' && this.p > n) this.p = 0;
      if (model !== 'ti83' && this.c >= n) { this.c = -1; this.o = 0; }
      this.draw();
    }
    R(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); }
    S(t, x, y, c, bg) { // police NumWorks 10x18
      if (bg) this.R(x, y, t.length * 10, 18, bg);
      this.ctx.fillStyle = c; this.ctx.textBaseline = 'top';
      this.ctx.font = '15px "DejaVu Sans Mono", Consolas, Menlo, monospace';
      for (let i = 0; i < t.length; i++) this.ctx.fillText(t[i], x + i * 10 + 1, y + 1);
    }
    T(row, col, t, color) { // Text( de la TI (zone graphique 265x165 à l'écran en 27,50)
      this.ctx.font = '10px "Segoe UI", Arial, sans-serif'; this.ctx.textBaseline = 'top';
      const w = this.ctx.measureText(t).width;
      this.R(27 + col, 50 + row, Math.min(w, 265 - col), 12, '#fff');
      this.ctx.save(); this.ctx.beginPath(); this.ctx.rect(27, 50, 265, 165); this.ctx.clip();
      this.ctx.fillStyle = TIC[color] || color; this.ctx.fillText(t, 27 + col, 50 + row);
      this.ctx.restore();
    }
    hline(y, color) { this.R(27, 50 + y, 265, 1, TIC[color]); }

    draw() { if (this.model === 'ti83') this.drawTI(); else this.drawNW(); }

    // ======================= NumWorks
    bar(t, c, r = '') { this.R(0, 0, 320, 20, c); this.S(t.slice(0, 31 - r.length), 4, 1, NW.W); if (r) this.S(r, 316 - 10 * r.length, 1, NW.W); }
    foot(t) { t = t.slice(0, 32); this.R(0, 204, 320, 18, NW.LG); this.S(t, 160 - 5 * t.length, 204, NW.G); }
    drawNW() {
      const d = this.d || {};
      this.R(0, 0, 320, 222, NW.W);
      if (this.mode === 'calc') {
        this.bar('REVE  calculs', NW.OR, this.keyName);
        let y = 158;
        for (let i = this.h.length - 1; i >= 0 && y >= 40; i--, y -= 40) {
          const [x, r] = this.h[i];
          this.S(x.slice(-31), 4, y - 18, NW.G);
          const rr = r.slice(-31); this.S(rr, 316 - 10 * rr.length, y, NW.N);
          this.R(0, y - 21, 320, 1, NW.LG);
        }
        this.R(0, 180, 320, 2, NW.OR);
        this.S((this.e + '_').slice(-31), 4, 184, NW.N);
        this.foot(this.keyName + ': fiches  <x: effacer');
      } else if (this.mode === 'list') {
        const { title, color, items, s } = this.list;
        this.bar(title, color, `${s + 1}/${items.length}`);
        const a = Math.max(0, Math.min(s - 4, items.length - 9));
        let y = 22;
        for (let i = a; i < Math.min(a + 9, items.length); i++, y += 20) {
          if (i === s) { this.R(0, y, 320, 20, color); this.S(items[i].slice(0, 31), 6, y + 1, NW.W); }
          else { this.S(items[i].slice(0, 31), 6, y + 1, NW.N); this.R(6, y + 19, 308, 1, NW.LG); }
        }
        this.foot('OK: ouvrir  ' + this.keyName + ': calcul');
      } else {
        const c = this.c; const sc = NW.SC[d.CS[c] % NW.SC.length];
        this.bar(d.SN[d.CS[c]] || '', sc, `${c + 1}/${d.T.length}`);
        const ls = d.L[c]; let y = 22;
        for (let i = this.o; i < Math.min(this.o + 10, ls.length); i++, y += 18) {
          const l = ls[i]; const k = l[0];
          if ('012345'.includes(k)) { const j = +k; this.R(0, y + 1, 38, 16, NW.CO[j]); const lb = NW.LB[j].slice(0, 4); this.S(lb, 19 - 5 * lb.length, y, NW.W); this.S(l.slice(1), 42, y, NW.N); }
          else if (k === '#') { this.S(l.slice(1), 4, y, sc); this.R(4, y + 18, 312, 1, sc); }
          else this.S(l.slice(1), 42, y, NW.N);
        }
        const n = ls.length;
        if (n > 10) { const hb = Math.max(12, Math.floor(180 * 10 / n)); this.R(316, 22 + Math.floor((180 - hb) * this.o / (n - 10)), 4, hb, NW.G); }
        this.foot('<> chapitre  ^v lire  OK menu');
      }
    }
    nwChapters(m) { const d = this.d; return d.T.map((_, i) => i).filter((i) => d.CS[i] === m); }
    openList(kind, sel) {
      const d = this.d;
      if (kind === 'subjects') this.list = { kind, title: 'REVE : matieres', color: NW.OR, items: d.SN, s: sel };
      else { const ch = this.nwChapters(this.subj); this.list = { kind, ch, title: d.SN[this.subj], color: NW.SC[this.subj % NW.SC.length], items: ch.map((i) => d.T[i]), s: sel }; }
      this.mode = 'list';
    }
    keyNW(k) {
      const d = this.d;
      if (this.mode === 'calc') {
        if (k === 'reve') {
          if (!d.T.length) return;
          if (this.c >= 0) this.mode = 'page';
          else if (d.SN.length > 1) this.openList('subjects', 0);
          else { this.subj = 0; this.openList('chapters', 0); }
        } else if (k === 'del') { if (this.e) this.e = this.e.replace(/(sqrt\(|sin\(|cos\(|tan\(|exp\(|log\(|ln\(|Ans|pi|\^2|.)$/, ''); else this.h = []; }
        else if (k === 'exe' || k === 'ok') { if (this.e) { const r = evaluate(this.e, this.ans); if (r !== 'Erreur') this.ans = r; this.h.push([this.e, r]); this.h = this.h.slice(-4); this.e = ''; } }
        else if (k.length === 1) this.e += k;
      } else if (this.mode === 'list') {
        const L = this.list; const n = L.items.length;
        if (k === 'up') L.s = (L.s - 1 + n) % n;
        else if (k === 'down') L.s = (L.s + 1) % n;
        else if (k === 'reve') this.mode = this.c >= 0 && L.kind === 'chapters' && L.fromPage ? 'page' : 'calc';
        else if (k === 'ok' || k === 'exe' || k === 'right') {
          if (L.kind === 'subjects') { this.subj = L.s; this.openList('chapters', 0); }
          else { this.c = L.ch[L.s]; this.o = 0; this.mode = 'page'; }
        } else if (k === 'del' || k === 'left') {
          if (L.kind === 'chapters' && !L.fromPage && d.SN.length > 1) this.openList('subjects', this.subj);
          else this.mode = L.fromPage ? 'page' : 'calc';
        }
      } else {
        const n = d.L[this.c].length;
        if (k === 'reve') this.mode = 'calc';
        else if (k === 'down' && this.o < n - 10) this.o = Math.min(n - 10, this.o + 9);
        else if (k === 'up' && this.o > 0) this.o = Math.max(0, this.o - 9);
        else if (k === 'right') { this.c = (this.c + 1) % d.T.length; this.o = 0; }
        else if (k === 'left') { this.c = (this.c - 1 + d.T.length) % d.T.length; this.o = 0; }
        else if (k === 'ok' || k === 'exe') { this.subj = d.CS[this.c]; const ch = this.nwChapters(this.subj); this.openList('chapters', ch.indexOf(this.c)); this.list.fromPage = true; }
      }
    }

    // ======================= TI-83 Premium CE (programme TI-Basic)
    drawTI() {
      const d = this.d || { pages: [], chapters: [], subjects: [] };
      this.R(0, 0, 320, 240, '#fff');
      this.R(0, 0, 320, 32, 'rgb(90,90,96)');
      this.ctx.font = 'bold 10px Arial, sans-serif'; this.ctx.fillStyle = '#fff'; this.ctx.textBaseline = 'top';
      this.ctx.fillText('NORMAL FLOTT AUTO RÉEL DEGRÉ MP', 6, 4); this.ctx.fillText('REVE', 6, 18);
      if (this.mode === 'menu') {
        const L = this.list;
        this.ctx.font = '15px "DejaVu Sans Mono", Consolas, monospace';
        this.R(0, 34, 320, 18, '#000'); this.ctx.fillStyle = '#fff'; this.ctx.fillText(' ' + L.title.slice(0, 24), 4, 35);
        L.items.forEach((it, i) => {
          const y = 54 + i * 18; const sel = i === L.s;
          if (sel) this.R(4, y, 20, 18, '#000');
          this.ctx.fillStyle = sel ? '#fff' : '#000'; this.ctx.fillText(String(i + 1), 8, y + 1);
          this.ctx.fillStyle = '#000'; this.ctx.fillText(':' + it[0].slice(0, 24), 22, y + 1);
        });
        return;
      }
      if (this.mode === 'calc') {
        this.T(2, 4, 'REVE', 'NAVY'); this.T(2, 40, 'calculatrice', 'GRAY'); this.T(2, 176, '[math] fiches', 'ORANGE');
        this.hline(15, 'NAVY'); this.hline(16, 'NAVY');
        const ys = [96, 60, 24];
        this.h.slice(-3).reverse().forEach(([x, r], i) => { this.T(ys[i], 4, x, 'GRAY'); this.T(ys[i] + 12, 150, '=', 'BLACK'); this.T(ys[i] + 12, 160, r, 'BLACK'); });
        this.hline(129, 'LTGRAY');
        this.T(136, 4, '> ' + this.e.slice(-30) + '_', 'BLACK');
        this.T(153, 4, '[annul] efface  [suppr] corrige  [2nde] √ π', 'GRAY');
        return;
      }
      const pg = d.pages[this.p - 1]; const c = d.chapters[pg.ci];
      const col = TI_SUBJ[c.si % TI_SUBJ.length];
      const info = `Ch ${pg.ci + 1}/${d.chapters.length}` + (c.pageCount > 1 ? `  p${this.p - c.firstPage}/${c.pageCount}` : '');
      this.T(2, 4, c.subject.toUpperCase().slice(0, 30), col);
      this.ctx.font = '10px "Segoe UI", Arial, sans-serif';
      this.T(2, 262 - this.ctx.measureText(info).width, info, 'GRAY');
      this.T(14, 4, c.title, 'BLACK');
      this.hline(27, col); this.hline(28, col);
      pg.lines.forEach((l, k) => {
        const y = 31 + k * 12;
        if (l.type) { const [lb, cc] = TI_TYPE[l.type] || TI_TYPE.fait; this.T(y, 4, lb, cc); }
        this.T(y, 40, l.text, 'BLACK');
      });
      this.T(153, 4, '◄► chapitre  ▲▼ page  [entrer] menu  [math] calcul', 'GRAY');
    }
    tiMenu(kind) {
      const d = this.d;
      const many = d.subjects.length > 1;
      if (kind === 'subjects') this.list = { kind, title: 'REVE : MATIERES', items: d.subjects.map((s, i) => [s, i]).concat([['Retour au calcul', -1]]), s: 0 };
      else {
        const items = d.chapters.map((c, i) => [c.title.replace(/^(chapitre|chap\.?|partie|cours|le[cç]on)\s*\d+\s*[-:.]?\s*/i, '') || c.title, i]).filter((x) => d.chapters[x[1]].si === this.subj);
        this.list = { kind, title: (d.subjects[this.subj] || '').toUpperCase(), items: items.concat([['Retour au calcul', -1]]), s: 0 };
      }
      this.mode = 'menu';
      this.list.many = many;
    }
    keyTI(k) {
      const d = this.d;
      const map = { reve: 'math', exe: 'enter', ok: 'enter', del: 'del' };
      k = map[k] || k;
      if (this.mode === 'calc') {
        if (k === 'math') {
          if (!d.pages.length) return;
          if (this.p > 0) this.mode = 'page';
          else if (d.subjects.length > 1) this.tiMenu('subjects');
          else { this.subj = 0; this.tiMenu('chapters'); }
        } else if (k === 'del') this.e = this.e.replace(/(√\(|sin\(|cos\(|tan\(|log\(|ln\(|Ans|.)$/, '');
        else if (k === 'enter') {
          if (this.e && !/[+\-*/^(⁻,]$|(√|sin|cos|tan|log|ln)\($/.test(this.e)) {
            const r = evaluate(this.e, this.ans, true);
            if (r !== 'Erreur') { this.ans = r; this.h.push([this.e, r]); this.h = this.h.slice(-3); this.e = ''; }
          }
        } else if (k.length === 1) this.e += k;
      } else if (this.mode === 'menu') {
        const L = this.list; const n = L.items.length;
        if (k === 'up') L.s = (L.s - 1 + n) % n;
        else if (k === 'down') L.s = (L.s + 1) % n;
        else if (k === 'enter' || k === 'right') {
          const v = L.items[L.s][1];
          if (v < 0) this.mode = 'calc';
          else if (L.kind === 'subjects') { this.subj = v; this.tiMenu('chapters'); }
          else { this.p = d.chapters[v].firstPage + 1; this.mode = 'page'; }
        } else if (k === 'math') this.mode = 'calc';
      } else {
        const pg = d.pages[this.p - 1]; const c = d.chapters[pg.ci]; const nc = d.chapters.length;
        if (k === 'math') this.mode = 'calc';
        else if (k === 'right') this.p = d.chapters[(pg.ci + 1) % nc].firstPage + 1;
        else if (k === 'left') this.p = d.chapters[(pg.ci - 1 + nc) % nc].firstPage + 1;
        else if (k === 'down') this.p = Math.min(this.p + 1, c.firstPage + c.pageCount);
        else if (k === 'up') this.p = Math.max(this.p - 1, c.firstPage + 1);
        else if (k === 'enter') { this.subj = c.si; this.tiMenu('chapters'); }
      }
    }
    key(k) {
      if (!this.d) return;
      if (this.model === 'ti83') this.keyTI(k); else this.keyNW(k);
      this.draw();
    }
  }
  window.CalcSim = CalcSim;
})();
