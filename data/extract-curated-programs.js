#!/usr/bin/env node
/**
 * Build-time script to extract curated programs from Kaggle dataset.
 * Run this ONCE to generate curated-programs-data.json.
 * Then the app just loads this pre-extracted data - no runtime matching.
 */

const fs = require('fs');
const path = require('path');

// Load Kaggle dataset
const kagglePath = path.join(__dirname, 'workout-programs.json');
const kaggle = JSON.parse(fs.readFileSync(kagglePath, 'utf8'));
const programs = kaggle.programs || [];
console.log('Kaggle programs:', programs.length);

// EXACT program IDs from TypeScript files, mapped to search terms
const curatedPrograms = {
    // Strength programs
    'stronglifts-5x5': 'stronglifts 5x5',
    'starting-strength': 'starting strength',
    'madcow-5x5': 'madcow',
    'texas-method': 'texas method',
    'wendler-531': 'wendler 5/3/1',
    'greyskull-lp': 'greyskull',
    'nSuns-531-lp': 'nsuns',

    // Hypertrophy programs
    'ppl-beginner': 'push pull legs beginner',
    'ppl-6day': 'push pull legs',
    'upper-lower-4day': 'upper lower',
    'phul': 'phul',
    'bro-split': 'bro split',
    'arnold-split': 'arnold',

    // Bodyweight programs
    'bodyweight-home': 'bodyweight home',
    'recommended-routine': 'recommended routine',
    'convict-conditioning': 'convict conditioning',
    'minimalist-strength': 'minimalist',
    'calisthenics-skills': 'calisthenics',

    // Specialized programs
    'full-body-3x': 'full body 3',
    'gzclp': 'gzclp',
    'fierce-5': 'fierce 5',
    'athletic-conditioning': 'athletic conditioning',
    'phat': 'phat',
    'kettlebell-simple': 'simple sinister',

    // More programs
    'couch-to-fit': 'couch to fit',
    'machine-only-beginner': 'machine only',
    'dumbbell-only-ppl': 'dumbbell ppl',
    'dumbbell-full-body': 'dumbbell full body',
    'arm-specialization': 'arm special',
    'back-width-thickness': 'back width',
    'glute-builder': 'glute',
    '30-min-full-body': '30 min',
    'lunch-break-workout': 'lunch',
    'basketball-training': 'basketball',
    'golf-fitness': 'golf',
    'soccer-conditioning': 'soccer',
    'mobility-flexibility': 'mobility',
};

// Normalize for matching
function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Find best match
function findMatch(searchTerm) {
    const norm = normalize(searchTerm);
    const words = norm.split(' ').filter(w => w.length > 0);

    // All words must appear
    let matches = programs.filter(p => {
        if (!p.workouts || p.workouts.length === 0) return false;
        const pn = normalize(p.name);
        return words.every(w => pn.includes(w));
    });

    if (matches.length > 0) {
        // Return the one with most workouts
        return matches.sort((a, b) => (b.workouts?.length || 0) - (a.workouts?.length || 0))[0];
    }

    // Fallback: any key word matches (words > 2 chars)
    matches = programs.filter(p => {
        if (!p.workouts || p.workouts.length === 0) return false;
        const pn = normalize(p.name);
        return words.filter(w => w.length > 2).some(w => pn.includes(w));
    });

    if (matches.length > 0) {
        return matches.sort((a, b) => (b.workouts?.length || 0) - (a.workouts?.length || 0))[0];
    }

    return null;
}

// Extract all curated programs
const extracted = {};
let matched = 0;
let unmatched = 0;

for (const [programId, searchTerm] of Object.entries(curatedPrograms)) {
    const match = findMatch(searchTerm);

    if (match) {
        console.log('✓', programId, '->', match.name, '(' + match.workouts.length + ' workouts)');
        extracted[programId] = {
            kaggleName: match.name,
            workouts: match.workouts
        };
        matched++;
    } else {
        console.log('✗', programId, '- NO MATCH for "' + searchTerm + '"');
        unmatched++;
    }
}

console.log('\n=== Summary ===');
console.log('Matched:', matched);
console.log('Unmatched:', unmatched);

// Save extracted data
const outputPath = path.join(__dirname, 'curated-programs-data.json');
fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2));
console.log('\nSaved to:', outputPath);
console.log('File size:', (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2), 'MB');
