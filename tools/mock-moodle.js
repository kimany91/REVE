// Faux serveur Moodle pour tester la connexion et le téléchargement des cours (tests uniquement).
const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const zip = new AdmZip(path.join(__dirname, '../demo/Cours_demo.zip'));
const FILES = {
  'optique.pdf': zip.readFile('Mes cours/Physique - Optique/Optique_geometrique_CM.pdf'),
  'analyse.docx': zip.readFile('Mes cours/Mathematiques/Analyse_chapitres_4_5.docx'),
};
const TOKEN = 'TOKEN123';

function start(port = 0) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const logged = /sess=ok/.test(req.headers.cookie || '');
    const base = `http://127.0.0.1:${srv.address().port}`;
    if (u.pathname === '/admin/tool/mobile/launch.php') {
      if (!logged) { res.writeHead(302, { Location: '/login/index.php' }); return res.end(); }
      const t = Buffer.from('signature:::' + TOKEN + ':::private').toString('base64');
      res.writeHead(302, { Location: 'moodlemobile://token=' + t }); return res.end();
    }
    if (u.pathname === '/login/index.php') {
      if (req.method === 'POST') { res.writeHead(303, { 'Set-Cookie': 'sess=ok; Path=/', Location: '/admin/tool/mobile/launch.php' }); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<html><body><h1>Moodle Démo</h1><form id="login" method="post"><input name="username" id="username"><input name="password" type="password" id="password"><button id="loginbtn">Connexion</button></form></body></html>');
    }
    if (u.pathname === '/webservice/rest/server.php') {
      let body = '';
      req.on('data', (c) => (body += c));
      return req.on('end', () => {
        const p = new URLSearchParams(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (p.get('wstoken') !== TOKEN) return res.end(JSON.stringify({ exception: 'x', message: 'Jeton invalide' }));
        const fn = p.get('wsfunction');
        if (fn === 'core_webservice_get_site_info') return res.end(JSON.stringify({ sitename: 'Moodle Lycée Démo', fullname: 'Élève Test', userid: 7 }));
        if (fn === 'core_enrol_get_users_courses') return res.end(JSON.stringify([{ id: 11, fullname: 'Physique - Optique', shortname: 'OPT' }, { id: 12, fullname: 'Mathématiques', shortname: 'MATH' }]));
        if (fn === 'core_course_get_contents') {
          const f = p.get('courseid') === '11' ? 'optique.pdf' : 'analyse.docx';
          return res.end(JSON.stringify([{ name: 'Cours', modules: [{ modname: 'resource', name: 'Support', contents: [{ type: 'file', filename: f, filepath: '/', fileurl: `${base}/webservice/pluginfile.php/1/${f}?forcedownload=1`, filesize: FILES[f].length }] }, { modname: 'url', name: 'Lien', contents: [{ type: 'url', fileurl: 'https://exemple.fr' }] }] }]));
        }
        res.end(JSON.stringify({ exception: 'x', message: 'fonction inconnue ' + fn }));
      });
    }
    const m = u.pathname.match(/^\/webservice\/pluginfile\.php\/1\/(.+)$/);
    if (m && u.searchParams.get('token') === TOKEN && FILES[m[1]]) {
      res.writeHead(200, { 'Content-Type': m[1].endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${m[1]}"` });
      return res.end(FILES[m[1]]);
    }
    res.writeHead(404); res.end('404');
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}
module.exports = { start };
if (require.main === module) start(8099).then(() => console.log('Faux Moodle sur http://127.0.0.1:8099'));
