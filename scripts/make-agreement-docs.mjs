// Regenerate the readable copies of the seller agreement from data/agreement.json (the source of truth, which
// sellers see in the editor): ../docs/seller-agreement.md and ../docs/prohibited-items.md.
// Usage: node scripts/make-agreement-docs.mjs [path/to/agreement.json] [outDir]
//   --check   write nothing; exit 1 when the docs differ from what the JSON would generate
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const check = process.argv.includes('--check');
const src = resolve(args[0] ?? join(root, 'data/agreement.json'));
const outDir = resolve(args[1] ?? join(root, '..', 'docs'));

export function agreementMarkdown(a) {
  const lines = [
    `# ${a.title}`,
    '',
    `> ${a.status}`,
    '>',
    `> Version ${a.version}. Source of truth: room-app/data/agreement.json (what sellers see). This file is generated from it.`,
    '',
    a.intro,
    '',
  ];
  for (const s of a.sections) {
    lines.push(`## ${s.h}`, '');
    for (const p of s.p) lines.push(p, '');
  }
  lines.push('## Prohibited items', '', 'See prohibited-items.md.', '');
  return lines.join('\n');
}

export function prohibitedMarkdown(a) {
  return [
    '# Prohibited items',
    '',
    `> ${a.status}`,
    '>',
    `> Version ${a.version}. Generated from room-app/data/agreement.json.`,
    '',
    a.prohibitedIntro,
    '',
    ...a.prohibited.map((x) => `- ${x}`),
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = JSON.parse(readFileSync(src, 'utf8'));
  const files = [
    [join(outDir, 'seller-agreement.md'), agreementMarkdown(a)],
    [join(outDir, 'prohibited-items.md'), prohibitedMarkdown(a)],
  ];
  let stale = 0;
  for (const [file, text] of files) {
    const same = existsSync(file) && readFileSync(file, 'utf8') === text;
    if (check) {
      console.log(`${same ? 'up to date' : 'DIFFERS   '}  ${file}`);
      if (!same) stale += 1;
    } else {
      writeFileSync(file, text);
      console.log(`wrote ${file}`);
    }
  }
  process.exit(stale ? 1 : 0);
}
