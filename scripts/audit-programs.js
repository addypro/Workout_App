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

function getProp(obj, key) {
  return obj.properties.find((prop) => {
    if (!ts.isPropertyAssignment(prop)) return false;
    if (ts.isIdentifier(prop.name)) return prop.name.text === key;
    if (ts.isStringLiteral(prop.name)) return prop.name.text === key;
    return false;
  });
}

function readString(init) {
  if (!init) return null;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  return null;
}

function readNumber(init) {
  if (!init) return null;
  if (ts.isNumericLiteral(init)) return Number(init.text);
  if (ts.isPrefixUnaryExpression(init) && ts.isNumericLiteral(init.operand)) {
    const sign = init.operator === ts.SyntaxKind.MinusToken ? -1 : 1;
    return sign * Number(init.operand.text);
  }
  return null;
}

function readWorkouts(init) {
  if (!init || !ts.isArrayLiteralExpression(init)) return [];
  const workouts = [];
  for (const elem of init.elements) {
    if (!ts.isObjectLiteralExpression(elem)) continue;
    const weekProp = getProp(elem, 'week');
    const dayProp = getProp(elem, 'day');
    const exercisesProp = getProp(elem, 'exercises');
    const week = readNumber(weekProp && weekProp.initializer);
    const day = readNumber(dayProp && dayProp.initializer);
    let exercisesCount = null;
    if (exercisesProp && ts.isArrayLiteralExpression(exercisesProp.initializer)) {
      exercisesCount = exercisesProp.initializer.elements.filter((e) => ts.isObjectLiteralExpression(e)).length;
    }
    workouts.push({ week, day, exercisesCount });
  }
  return workouts;
}

function extractProgramsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const programs = [];

  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        if (!decl.name.text.endsWith('_PROGRAMS')) continue;
        if (!decl.initializer || !ts.isArrayLiteralExpression(decl.initializer)) continue;
        for (const elem of decl.initializer.elements) {
          if (!ts.isObjectLiteralExpression(elem)) continue;
          const idProp = getProp(elem, 'id');
          const nameProp = getProp(elem, 'name');
          const durationProp = getProp(elem, 'duration');
          const daysProp = getProp(elem, 'daysPerWeek');
          const workoutsProp = getProp(elem, 'workouts');
          const id = readString(idProp && idProp.initializer);
          if (!id) continue;
          const program = {
            id,
            name: readString(nameProp && nameProp.initializer) || id,
            duration: readNumber(durationProp && durationProp.initializer),
            daysPerWeek: readNumber(daysProp && daysProp.initializer),
            embeddedWorkouts: readWorkouts(workoutsProp && workoutsProp.initializer),
          };
          programs.push(program);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return programs;
}

function indexWorkouts(workouts) {
  const byWeek = new Map();
  for (const w of workouts) {
    if (typeof w.week !== 'number' || typeof w.day !== 'number') continue;
    if (!byWeek.has(w.week)) byWeek.set(w.week, new Set());
    byWeek.get(w.week).add(w.day);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const coverageWeeks = weeks.length ? Math.max(...weeks) : 0;
  return { byWeek, weeks, coverageWeeks };
}

function summarizeProgram(program, curated) {
  const curatedEntry = curated[program.id];
  const curatedWorkouts = curatedEntry && Array.isArray(curatedEntry.workouts) ? curatedEntry.workouts : [];
  const useCurated = curatedWorkouts.length > 0;
  const workouts = useCurated ? curatedWorkouts : program.embeddedWorkouts;
  const source = useCurated ? 'curated' : 'embedded';

  const indexed = indexWorkouts(workouts);
  const duration = program.duration || indexed.coverageWeeks || 0;
  const daysPerWeek = program.daysPerWeek || null;

  const issues = [];

  if (duration && indexed.coverageWeeks < duration) {
    issues.push({
      type: 'missing_weeks',
      detail: `Coverage ${indexed.coverageWeeks} < duration ${duration}`,
    });
  }

  if (duration && indexed.coverageWeeks > duration) {
    issues.push({
      type: 'extra_weeks',
      detail: `Coverage ${indexed.coverageWeeks} > duration ${duration}`,
    });
  }

  if (daysPerWeek && indexed.byWeek.size > 0) {
    for (const [week, daysSet] of indexed.byWeek.entries()) {
      const dayCount = daysSet.size;
      if (dayCount !== daysPerWeek) {
        issues.push({
          type: 'day_mismatch',
          detail: `Week ${week} has ${dayCount} days (expected ${daysPerWeek})`,
        });
      }
    }
  }

  // Check empty workouts (no exercises) where possible
  const emptyWorkoutCount = workouts.filter((w) => Array.isArray(w.exercises) && w.exercises.length === 0).length;
  if (emptyWorkoutCount > 0) {
    issues.push({
      type: 'empty_workouts',
      detail: `${emptyWorkoutCount} workouts have 0 exercises`,
    });
  }

  return {
    id: program.id,
    name: program.name,
    duration: program.duration || null,
    daysPerWeek: program.daysPerWeek || null,
    source,
    coverageWeeks: indexed.coverageWeeks,
    issues,
  };
}

function main() {
  const curated = fs.existsSync(curatedPath) ? readJson(curatedPath) : {};
  const programFiles = fs.readdirSync(dataDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(dataDir, f));

  let programs = [];
  for (const file of programFiles) {
    programs = programs.concat(extractProgramsFromFile(file));
  }

  const results = programs.map((p) => summarizeProgram(p, curated));
  const withIssues = results.filter((r) => r.issues.length > 0);

  withIssues.sort((a, b) => b.issues.length - a.issues.length || a.name.localeCompare(b.name));

  const report = {
    totalPrograms: results.length,
    programsWithIssues: withIssues.length,
    issues: withIssues,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
