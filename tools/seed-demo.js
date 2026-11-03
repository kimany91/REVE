// Prépare un dossier de données de démonstration (pour les captures d'écran).
const fs = require('fs');
const path = require('path');
const { readZip } = require('../src/main/extract');
const { summarizeDocuments } = require('../src/main/analyzer/summarize');
(async () => {
  const dir = process.argv[2];
  const zip = path.join(__dirname, '../demo/Cours_demo.zip');
  const { groups } = await readZip(fs.readFileSync(zip), 'Cours_demo.zip');
  const names = { 'Physique - Optique': ['Physique - Optique géométrique', 'moodle', 101], Mathematiques: ['Mathématiques - Analyse', 'moodle', 102], Chimie: ['Chimie des solutions', 'zip', null] };
  let i = 0;
  const subjects = [...groups].map(([g, docs]) => {
    const [name, source, courseId] = names[g] || [g, 'zip', null];
    return { id: 's' + i++, name, source, courseId, zipPath: zip, analyzedAt: Date.parse('2026-11-03'), files: docs.map((d) => d.name),
      chapters: summarizeDocuments(docs).map((c, k) => ({ id: 'c' + i + k, ...c })) };
  });
  const state = {
    settings: { model: 'numworks', key: 'toolbox' },
    moodle: { url: 'https://moodle.universite-demo.fr', mode: 'token', token: 'demo', siteName: 'Moodle Université Démo', user: 'Élève Démo', userid: 1 },
    moodleCourses: [{ id: 101, name: 'Physique - Optique géométrique' }, { id: 102, name: 'Mathématiques - Analyse' }, { id: 103, name: 'Histoire - XXe siècle' }, { id: 104, name: 'Anglais B2' }, { id: 105, name: 'SVT - Génétique' }],
    subjects,
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'reve.json'), JSON.stringify(state, null, 1));
  console.log('ok', subjects.length);
})();
