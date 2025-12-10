const fs = require('fs');
const path = require('path');

// Read the full exercises database
const fullExercises = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/exercises-full.json'), 'utf-8')
);

// Convert to app format
const appExercises = fullExercises.map(ex => {
  // Extract aliases from similar exercise names or variations
  const aliases = [];
  const name = ex['Exercise'];

  // Add common variations as aliases
  if (name.includes('Bodyweight')) {
    aliases.push(name.replace('Bodyweight ', ''));
  }
  if (name.includes('Dumbbell')) {
    aliases.push(name.replace('Dumbbell', 'DB'));
  }
  if (name.includes('Barbell')) {
    aliases.push(name.replace('Barbell', 'BB'));
  }

  return {
    name: ex['Exercise'],
    aliases: aliases.filter(a => a !== name),
    category: ex['Target Muscle Group '] || ex['Body Region'],
    equipment: [ex['Primary Equipment ']].concat(
      ex['Secondary Equipment'] && ex['Secondary Equipment'] !== 'None' ? [ex['Secondary Equipment']] : []
    ).filter(Boolean),
    muscleGroups: [
      ex['Prime Mover Muscle'],
      ex['Secondary Muscle'],
      ex['Tertiary Muscle']
    ].filter(Boolean),
    difficulty: ex['Difficulty Level'],
    videoUrl: ex['Short YouTube Demonstration'] && ex['Short YouTube Demonstration'].includes('http')
      ? ex['Short YouTube Demonstration']
      : null,
    mechanics: ex['Mechanics'],
    movementPattern: ex['Movement Pattern #1']
  };
});

// Save simplified version
fs.writeFileSync(
  path.join(__dirname, '../data/exercises.json'),
  JSON.stringify(appExercises, null, 2)
);

console.log(`✅ Created exercises.json with ${appExercises.length} exercises`);
console.log('\nSample exercise:');
console.log(JSON.stringify(appExercises[0], null, 2));

// Stats
const categories = {};
appExercises.forEach(ex => {
  const cat = ex.category || 'Unknown';
  categories[cat] = (categories[cat] || 0) + 1;
});

console.log('\n📊 Exercises by category:');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
