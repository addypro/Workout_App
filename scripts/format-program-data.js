#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'lib', 'services', 'programs', 'data');

function formatFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\n/);
  let changed = false;

  const next = lines.flatMap((line) => {
    const trimmed = line.trim();
    if (trimmed.endsWith('},') && trimmed.includes(':') && !trimmed.startsWith('}')) {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const closingIndent = indent.endsWith('  ') ? indent.slice(0, -2) : indent;
      const content = line.replace(/},\s*$/, ',');
      changed = true;
      return [content, `${closingIndent}},`];
    }
    return [line];
  });

  if (changed) {
    fs.writeFileSync(filePath, next.join('\n'));
  }

  return changed;
}

function main() {
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.ts'));
  let changedCount = 0;
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (formatFile(filePath)) {
      changedCount++;
    }
  }
  console.log(`Formatted ${changedCount} program data files.`);
}

main();
