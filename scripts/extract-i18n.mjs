#!/usr/bin/env node
// Collects every t('...') / t("...") string literal in src/ into the translation catalog:
//   src/i18n/strings.json        - what the site asks /api/i18n to translate
//   infra/lambda/i18n-strings.json - the only strings the Lambda agrees to translate
//
//   node scripts/extract-i18n.mjs          write both files
//   node scripts/extract-i18n.mjs --check  exit 1 if they are out of date (used by deploy-site.sh)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = [join(root, 'src/i18n/strings.json'), join(root, 'infra/lambda/i18n-strings.json')];

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') yield* sourceFiles(path);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      yield path;
    }
  }
}

// A t( call not preceded by a word character or dot, whose first argument is a plain string literal
const CALL = /(?<![\w.$])t\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;

const strings = new Set();
for (const file of sourceFiles(join(root, 'src'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(CALL)) {
    // Undo the JS escapes the literal may use (\' \" \\ \n)
    const text = JSON.parse(`"${match[2].replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`);
    if (text.trim()) strings.add(text);
  }
}

const json = JSON.stringify([...strings].sort(), null, 2) + '\n';
if (process.argv.includes('--check')) {
  const stale = outputs.filter(path => !existsSync(path) || readFileSync(path, 'utf8') !== json);
  if (stale.length) {
    console.error(`Translation catalog is out of date: run node scripts/extract-i18n.mjs and commit\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Translation catalog up to date (${strings.size} strings)`);
} else {
  for (const path of outputs) writeFileSync(path, json);
  console.log(`Wrote ${strings.size} strings to ${outputs.length} catalogs`);
}
