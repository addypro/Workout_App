#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'lib', 'services', 'programs', 'data');
const curatedPath = path.join(repoRoot, 'data', 'curated-programs-data.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getProp(node, key) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  return node.properties.find((prop) => {
    if (!ts.isPropertyAssignment(prop)) return false;
    if (ts.isIdentifier(prop.name)) return prop.name.text === key;
    if (ts.isStringLiteral(prop.name)) return prop.name.text === key;
    return false;
  }) || null;
}

function readString(init) {
  if (!init) return null;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  return null;
}

function buildCuratedIndex(curated) {
  const index = new Map();
  for (const [id, entry] of Object.entries(curated)) {
    const workouts = Array.isArray(entry.workouts) ? entry.workouts : [];
    const byWeek = new Map();
    for (const w of workouts) {
      const week = Number(w.week || 0);
      const day = Number(w.day || 0);
      if (!week || !day) continue;
      if (!byWeek.has(week)) byWeek.set(week, new Set());
      byWeek.get(week).add(day);
    }
    const weeks = [...byWeek.keys()];
    const coverageWeeks = weeks.length ? Math.max(...weeks) : 0;
    let maxDays = 0;
    for (const set of byWeek.values()) {
      if (set.size > maxDays) maxDays = set.size;
    }
    index.set(id, { duration: coverageWeeks, daysPerWeek: maxDays });
  }
  return index;
}

function addEdit(edits, start, end, text) {
  edits.push({ start, end, text });
}

function removeProperty(sourceText, prop, edits) {
  let start = prop.getFullStart();
  let end = prop.getEnd();

  // Extend to include trailing comma if present
  let i = end;
  while (i < sourceText.length && /\s/.test(sourceText[i])) i++;
  if (sourceText[i] === ',') {
    i++;
    while (i < sourceText.length && /\s/.test(sourceText[i])) i++;
    end = i;
  } else {
    // Or remove preceding comma
    let j = start - 1;
    while (j >= 0 && /\s/.test(sourceText[j])) j--;
    if (sourceText[j] === ',') {
      start = j;
    }
  }

  addEdit(edits, start, end, '');
}

function replaceInitializer(sourceText, initializer, newValue, edits) {
  const start = initializer.getStart();
  const end = initializer.getEnd();
  addEdit(edits, start, end, String(newValue));
}

function insertPropertyAfter(sourceText, anchorProp, propertyText, edits) {
  const end = anchorProp.getEnd();
  const insertion = sourceText.slice(end, end);
  const prefix = sourceText.slice(anchorProp.getFullStart(), anchorProp.getStart());
  const indentMatch = prefix.match(/\n(\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const text = `,\n${indent}${propertyText}`;
  addEdit(edits, end, end, text);
}

function processFile(filePath, curatedIndex) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];

  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const idProp = getProp(node, 'id');
      const id = idProp && readString(idProp.initializer);
      if (id && curatedIndex.has(id)) {
        const meta = curatedIndex.get(id);
        const durationProp = getProp(node, 'duration');
        const daysProp = getProp(node, 'daysPerWeek');
        const workoutsProp = getProp(node, 'workouts');

        if (durationProp && ts.isPropertyAssignment(durationProp)) {
          replaceInitializer(sourceText, durationProp.initializer, meta.duration || 0, edits);
        } else if (idProp && meta.duration) {
          insertPropertyAfter(sourceText, idProp, `duration: ${meta.duration}`, edits);
        }

        if (daysProp && ts.isPropertyAssignment(daysProp)) {
          replaceInitializer(sourceText, daysProp.initializer, meta.daysPerWeek || 0, edits);
        } else if (idProp && meta.daysPerWeek) {
          insertPropertyAfter(sourceText, idProp, `daysPerWeek: ${meta.daysPerWeek}`, edits);
        }

        if (workoutsProp) {
          removeProperty(sourceText, workoutsProp, edits);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!edits.length) return false;

  edits.sort((a, b) => b.start - a.start);
  let nextText = sourceText;
  for (const edit of edits) {
    nextText = nextText.slice(0, edit.start) + edit.text + nextText.slice(edit.end);
  }

  if (nextText !== sourceText) {
    fs.writeFileSync(filePath, nextText);
    return true;
  }

  return false;
}

function main() {
  if (!fs.existsSync(curatedPath)) {
    console.error('Missing curated-programs-data.json');
    process.exit(1);
  }

  const curated = readJson(curatedPath);
  const curatedIndex = buildCuratedIndex(curated);

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.ts'));
  let changed = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (processFile(filePath, curatedIndex)) {
      changed++;
    }
  }

  console.log(`Updated ${changed} program data files.`);
}

main();
