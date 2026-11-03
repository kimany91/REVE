// Lecture des supports de cours : PDF, Word, PowerPoint, OpenDocument, texte, HTML, et ZIP.
const path = require('path');
const AdmZip = require('adm-zip');

const SUPPORTED = ['.pdf', '.docx', '.pptx', '.odt', '.odp', '.txt', '.md', '.html', '.htm'];

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
}

function htmlToBlocks(html) {
  const blocks = [];
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const rx = /<(h[1-6]|p|li|td|div|br)\b[^>]*>([\s\S]*?)(?=<(?:h[1-6]|p|li|td|div|\/body)\b|$)/gi;
  let m;
  while ((m = rx.exec(body))) {
    const text = decodeXml(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const tag = m[1].toLowerCase();
    if (tag[0] === 'h') blocks.push({ h: +tag[1], text });
    else blocks.push({ text: (tag === 'li' ? '• ' : '') + text });
  }
  if (!blocks.length) blocks.push({ text: decodeXml(body.replace(/<[^>]+>/g, '\n')) });
  return blocks;
}

function textToBlocks(text) {
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.length) { blocks.push({ text: buf.join('\n') }); buf = []; } };
  for (const line of text.split(/\r?\n/)) {
    const md = line.match(/^(#{1,4})\s+(.*)/);
    const isChap = /^\s*(chapitre|partie|le[cç]on)\s*[\dIVX]+/i.test(line) && line.length < 90;
    if (md || isChap) { flush(); blocks.push({ h: md ? md[1].length : 1, text: (md ? md[2] : line).trim() }); }
    else buf.push(line);
  }
  flush();
  return blocks;
}

let pdfjs = null;
async function pdfToBlocks(buffer) {
  if (!pdfjs) {
    // pdf.js signale l'absence du module "canvas" (inutile ici pour lire le texte)
    const log = console.log, warn = console.warn;
    console.log = console.warn = () => {};
    try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); } finally { console.log = log; console.warn = warn; }
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let cur = null;
    for (const it of content.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10;
      if (cur && Math.abs(cur.y - y) <= 2) { cur.text += (it.hasEOL || /\s$/.test(cur.text) ? '' : ' ') + it.str; cur.size = Math.max(cur.size, size); }
      else { if (cur) lines.push(cur); cur = { y, size, text: it.str, page: p }; }
    }
    if (cur) lines.push(cur);
    page.cleanup();
  }
  await doc.destroy();
  // taille de police la plus fréquente = texte normal ; plus grand = titre
  const freq = new Map();
  lines.forEach((l) => freq.set(l.size, (freq.get(l.size) || 0) + l.text.length));
  const bodySize = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  // supprime en-têtes/pieds de page répétés
  const rep = new Map();
  lines.forEach((l) => { const k = l.text.trim().replace(/\d+/g, '#'); rep.set(k, (rep.get(k) || 0) + 1); });
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.length) { blocks.push({ text: buf.join('\n') }); buf = []; } };
  for (const l of lines) {
    const t = l.text.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (rep.get(t.replace(/\d+/g, '#')) > Math.max(3, doc.numPages * 0.5) && t.length < 80) continue;
    const ratio = l.size / bodySize;
    if ((ratio >= 1.25 && t.length < 100) || (/^\s*(chapitre|partie)\s*[\dIVX]+/i.test(t) && t.length < 90)) {
      flush();
      blocks.push({ h: ratio >= 1.7 ? 1 : 2, text: t });
    } else buf.push(t);
  }
  flush();
  return blocks;
}

function pptxToBlocks(buffer) {
  const zip = new AdmZip(buffer);
  const slides = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => parseInt(a.entryName.match(/\d+/)[0]) - parseInt(b.entryName.match(/\d+/)[0]));
  const blocks = [];
  for (const s of slides) {
    const xml = s.getData().toString('utf8');
    const shapes = xml.split(/<p:sp>|<p:sp /).slice(1);
    let title = null; const body = [];
    for (const sh of shapes) {
      const isTitle = /<p:ph[^>]*type="(title|ctrTitle)"/.test(sh);
      const paras = sh.split(/<\/a:p>/).map((p) => decodeXml((p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.slice(5, -6)).join(''))).map((t) => t.trim()).filter(Boolean);
      if (isTitle && !title) title = paras.join(' ');
      else body.push(...paras);
    }
    if (title) blocks.push({ h: 2, text: title });
    if (body.length) blocks.push({ text: body.join('\n') });
  }
  return blocks;
}

function odfToBlocks(buffer) {
  const zip = new AdmZip(buffer);
  const xml = zip.readAsText('content.xml');
  const html = xml.replace(/<text:h[^>]*text:outline-level="(\d)"[^>]*>/g, '<h$1>').replace(/<\/text:h>/g, '</h1>')
    .replace(/<text:p[^>]*>/g, '<p>').replace(/<\/text:p>/g, '</p>');
  return htmlToBlocks(html);
}

async function fileToBlocks(name, buffer) {
  const ext = path.extname(name).toLowerCase();
  try {
    if (ext === '.pdf') return await pdfToBlocks(buffer);
    if (ext === '.docx') { const mammoth = require('mammoth'); const r = await mammoth.convertToHtml({ buffer }); return htmlToBlocks(r.value); }
    if (ext === '.pptx') return pptxToBlocks(buffer);
    if (ext === '.odt' || ext === '.odp') return odfToBlocks(buffer);
    if (ext === '.html' || ext === '.htm') return htmlToBlocks(buffer.toString('utf8'));
    if (ext === '.txt' || ext === '.md') return textToBlocks(buffer.toString('utf8'));
  } catch (e) {
    console.warn('Lecture impossible :', name, e.message);
  }
  return [];
}

const SUBJECT_WORDS = /(math|physique|chimie|optique|m[ée]canique|svt|bio|g[ée]ologie|histoire|g[ée]o|philo|fran[cç]ais|anglais|espagnol|allemand|info|nsi|[ée]co|ses|droit|[ée]lectr|thermo|algo|stat|proba|analyse|alg[eè]bre|litt[ée]rature|langue)/i;

// Lit un ZIP (et les ZIP qu'il contient) et regroupe les fichiers par matière.
async function readZip(buffer, zipName, onProgress = () => {}, opts = {}) {
  const files = [];
  const walk = (buf, prefix) => {
    const zip = new AdmZip(buf);
    for (const e of zip.getEntries()) {
      if (e.isDirectory || /(^|\/)(__MACOSX|\.)/.test(e.entryName)) continue;
      const full = prefix + e.entryName;
      const ext = path.extname(full).toLowerCase();
      if (ext === '.zip') walk(e.getData(), full.replace(/\.zip$/i, '') + '/');
      else if (SUPPORTED.includes(ext)) files.push({ path: full, data: e.getData() });
    }
  };
  walk(buffer, '');
  // Sans dossier commun : regarder si les dossiers de 1er niveau ressemblent à des matières
  const parts = files.map((f) => f.path.split('/'));
  let depth = 0;
  while (parts.length && parts.every((p) => p.length > depth + 1 && p[depth] === parts[0][depth])) depth++;
  const tops = [...new Set(parts.filter((p) => p.length > depth + 1).map((p) => p[depth]))];
  const bySubject = !opts.single && tops.length >= 2 && tops.filter((t) => SUBJECT_WORDS.test(t)).length >= Math.ceil(tops.length / 2);

  const groups = new Map();
  let i = 0;
  for (const f of files) {
    const p = f.path.split('/');
    const subject = opts.single ? zipName.replace(/\.zip$/i, '') : bySubject && p.length > depth + 1 ? p[depth] : (depth > 0 ? p[depth - 1] : zipName.replace(/\.zip$/i, ''));
    onProgress({ step: 'lecture', file: p[p.length - 1], done: i++, total: files.length });
    const blocks = await fileToBlocks(f.path, f.data);
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push({ name: p[p.length - 1], blocks });
  }
  return { groups, fileCount: files.length };
}

module.exports = { fileToBlocks, readZip, SUPPORTED, SUBJECT_WORDS };
