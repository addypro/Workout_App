#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'lib', 'services', 'programs', 'data');

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

function addEdit(edits, start, end, text) {
  edits.push({ start, end, text });
}

function insertPropertyAfter(sourceText, anchorProp, propertyText, edits) {
  const end = anchorProp.getEnd();
  const prefix = sourceText.slice(anchorProp.getFullStart(), anchorProp.getStart());
  const indentMatch = prefix.match(/\n(\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const text = `,\n${indent}${propertyText}`;
  addEdit(edits, end, end, text);
}

function processFile(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];

  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const idProp = getProp(node, 'id');
      const id = idProp && readString(idProp.initializer);
      if (!id) {
        ts.forEachChild(node, visit);
        return;
      }

      const workoutsProp = getProp(node, 'workouts');
      if (!workoutsProp) {
        const anchor = getProp(node, 'equipment') || getProp(node, 'muscleGroups') || idProp;
        if (anchor) {
          insertPropertyAfter(sourceText, anchor, 'workouts: []', edits);
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
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.ts'));
  let changed = 0;
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (processFile(filePath)) {
      changed++;
    }
  }
  console.log(`Added workouts: [] to ${changed} files.`);
}

main();
