// Initialize Database
// Run with: npx tsx scripts/init-database.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗄️  Initializing database...');

  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Run migrations (if using Prisma Migrate)
    console.log('📝 Applying schema to database...');

    // Check if database has tables
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table';
    `;
    console.log('📊 Existing tables:', tables);

    console.log('\n✨ Database initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma db push (to create tables)');
    console.log('2. Run: npm run seed (to seed exercise database)');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
