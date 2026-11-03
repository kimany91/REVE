// Test rapide : analyse le ZIP de démo et affiche les fiches produites.
const fs = require('fs');
const path = require('path');
const { readZip } = require('../src/main/extract');
const { summarizeDocuments } = require('../src/main/analyzer/summarize');
(async () => {
  const zip = process.argv[2] || path.join(__dirname, '../demo/Cours_demo.zip');
  const { groups, fileCount } = await readZip(fs.readFileSync(zip), path.basename(zip));
  console.log(fileCount, 'fichiers lus');
  for (const [subject, docs] of groups) {
    console.log('\n=== ' + subject);
    for (const ch of summarizeDocuments(docs)) {
      console.log('  # ' + ch.title);
      for (const p of ch.points) console.log(`    [${p.type}] ${p.text}  (${p.score})`);
    }
  }
})();
