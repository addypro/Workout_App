#!/usr/bin/env node
/**
 * Test PDF Extraction Edge Function
 * 
 * Tests:
 * 1. First upload - should extract and return tokens used
 * 2. Second upload - should return cached result (0 tokens)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dahuiaqdbaenlsiniykx.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

async function testPDFExtraction(pdfPath: string, testName: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${testName}`);
    console.log(`FILE: ${path.basename(pdfPath)}`);
    console.log('='.repeat(60));

    // Read and encode PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64 = pdfBuffer.toString('base64');
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    console.log(`📄 File size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔑 Content hash: ${hash.slice(0, 16)}...`);

    // Call edge function
    console.log('\n📤 Calling edge function...');
    const startTime = Date.now();

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/extract-program-pdf`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    base64,
                    filename: path.basename(pdfPath),
                    mimeType: 'application/pdf',
                }),
            }
        );

        const result = await response.json();
        const elapsed = Date.now() - startTime;

        console.log(`\n⏱️ Response time: ${elapsed}ms`);
        console.log(`📥 Status: ${response.status}`);

        if (result.success) {
            console.log('\n✅ EXTRACTION SUCCESSFUL');
            console.log(`   Cached: ${result.cached ? 'YES (0 tokens)' : 'NO (new extraction)'}`);
            console.log(`   Tokens used: ${result.tokensUsed || 0}`);
            console.log(`   Processing time: ${result.processingTimeMs}ms`);

            if (result.program) {
                console.log(`\n📋 EXTRACTED PROGRAM:`);
                console.log(`   Name: ${result.program.name}`);
                console.log(`   Weeks: ${result.program.weeks?.length || 0}`);
                console.log(`   Days/week: ${result.program.daysPerWeek || result.program.weeks?.[0]?.days?.length || 0}`);

                // Show first week structure
                const week1 = result.program.weeks?.[0];
                if (week1) {
                    console.log(`\n   Week 1 Structure:`);
                    for (const day of week1.days || []) {
                        const exCount = day.exercises?.length || 0;
                        console.log(`     - ${day.name}: ${exCount} exercises`);
                    }
                }

                // Count total exercises
                const totalExercises = result.program.weeks?.reduce((sum: number, week: any) =>
                    sum + (week.days?.reduce((daySum: number, day: any) =>
                        daySum + (day.exercises?.length || 0), 0) || 0), 0) || 0;
                console.log(`\n   Total exercises: ${totalExercises}`);
            }

            if (result.classification) {
                console.log(`\n🏷️ CLASSIFICATION:`);
                console.log(`   Is workout: ${result.classification.isWorkoutProgram}`);
                console.log(`   Confidence: ${(result.classification.confidence * 100).toFixed(0)}%`);
                console.log(`   Type: ${result.classification.programType || 'unknown'}`);
            }
        } else if (result.rejected) {
            console.log('\n⚠️ PDF REJECTED (not a workout program)');
            console.log(`   Reason: ${result.reason}`);
        } else {
            console.log('\n❌ EXTRACTION FAILED');
            console.log(`   Error: ${result.error}`);
        }

        return result;
    } catch (error: any) {
        console.log(`\n❌ REQUEST FAILED: ${error.message}`);
        return null;
    }
}

async function main() {
    const pdfPath = process.argv[2] || 'pdfcoffee.com-john-meadows-program-creeping-death-v2pdf.pdf';

    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ File not found: ${pdfPath}`);
        process.exit(1);
    }

    // Test 1: First upload (should extract)
    console.log('\n🧪 TEST 1: First Upload (fresh extraction)');
    const result1 = await testPDFExtraction(pdfPath, 'Fresh Extraction');

    if (result1?.success) {
        // Test 2: Second upload (should hit cache)
        console.log('\n🧪 TEST 2: Second Upload (should be cached)');
        const result2 = await testPDFExtraction(pdfPath, 'Cache Hit Test');

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Test 1 - Fresh: ${result1.tokensUsed || 'N/A'} tokens, ${result1.cached ? 'CACHED' : 'FRESH'}`);
        console.log(`   Test 2 - Cache: ${result2?.tokensUsed || 0} tokens, ${result2?.cached ? 'CACHED ✅' : 'NOT CACHED ❌'}`);
    }
}

main().catch(console.error);
