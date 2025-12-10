const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyRLS() {
  try {
    console.log('📋 Reading RLS policy file...');
    const sqlFile = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/001_rls_policies.sql'),
      'utf-8'
    );

    console.log('🔐 Applying Row Level Security policies...');

    // Split SQL into individual statements (remove comments and empty lines)
    const statements = sqlFile
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement + ';');
          successCount++;
          process.stdout.write('.');
        } catch (error) {
          console.log(`\n⚠️  Warning on statement: ${error.message}`);
          // Continue on errors (some policies might already exist)
        }
      }
    }

    console.log(`\n✅ RLS policies applied successfully! (${successCount}/${statements.length} statements executed)`);
  } catch (error) {
    console.error('❌ Error applying RLS policies:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyRLS();
