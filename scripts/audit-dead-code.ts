#!/usr/bin/env npx ts-node
/**
 * Dead Code Audit Script
 * 
 * A SAFETY-FIRST, non-destructive static analysis tool that identifies
 * potentially unused files and exports in an Expo Router TypeScript project.
 * 
 * SAFETY PROTOCOLS:
 * 1. Expo Router Immunity: All app/ files are treated as entry points
 * 2. Config Immunity: Root-level configs are whitelisted
 * 3. Asset Immunity: assets/ and dynamic icon refs are ignored
 * 4. Dry Run ONLY: Generates report, NEVER deletes files
 * 
 * Usage: npx ts-node scripts/audit-dead-code.ts
 * Output: DEAD_CODE_REPORT.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { Node, Project } from 'ts-morph';
import { fileURLToPath } from 'url';

// ============================================
// CONFIGURATION
// ============================================

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'DEAD_CODE_REPORT.md');

// Entry points that are ALWAYS considered used
const ENTRY_POINTS = [
    // Expo Router: ALL files in app/ are entry points (file-based routing)
    'app/**/*.tsx',
    'app/**/*.ts',

    // Main entry
    'index.js',
    'index.ts',

    // Expo entry
    'App.tsx',
    'App.js',

    // Scripts (maintenance tools)
    'scripts/*.ts',
    'scripts/*.js',
    'scripts/*.mjs',

    // Supabase (side-effect imports)
    'lib/supabase/client.ts',
    'lib/supabase/server.ts',
];

// Files/patterns that are IMMUNE from dead code detection
const IMMUNE_PATTERNS = [
    // Config files
    /^[^/]+\.config\.(js|ts|mjs)$/,
    /^app\.json$/,
    /^package\.json$/,
    /^tsconfig\.json$/,
    /^\.eslintrc\.(js|json)$/,
    /^babel\.config\.js$/,
    /^metro\.config\.js$/,
    /^tailwind\.config\.(js|ts)$/,
    /^postcss\.config\.js$/,

    // Expo Router special files
    /_layout\.tsx$/,
    /\+not-found\.tsx$/,
    /\+html\.tsx$/,
    /\+native-intent\.tsx$/,

    // Assets
    /^assets\//,

    // Dynamic icon references
    /icon-symbol.*\.tsx$/,

    // Type declaration files
    /\.d\.ts$/,

    // Test files (often not imported but still used)
    /\.(test|spec)\.(ts|tsx|js|jsx)$/,
    /\/__tests__\//,

    // Supabase functions (deployed separately)
    /^supabase\/functions\//,

    // Generated files
    /^\.expo\//,
    /^node_modules\//,
    /^dist\//,
    /^build\//,
];

// ============================================
// TYPES
// ============================================

interface FileNode {
    path: string;
    relativePath: string;
    isEntryPoint: boolean;
    isImmune: boolean;
    imports: string[];
    exports: string[];
    isReachable: boolean;
    reachableVia?: string;
}

interface UnusedExport {
    file: string;
    exportName: string;
    line: number;
}

interface AuditResult {
    totalFiles: number;
    entryPoints: number;
    immuneFiles: number;
    reachableFiles: number;
    candidateFiles: FileNode[];
    unusedExports: UnusedExport[];
    timestamp: string;
}

// ============================================
// HELPERS
// ============================================

function isImmune(relativePath: string): boolean {
    return IMMUNE_PATTERNS.some(pattern => pattern.test(relativePath));
}

function isEntryPoint(relativePath: string): boolean {
    // All files in app/ are entry points (Expo Router)
    if (relativePath.startsWith('app/')) return true;

    // Check other entry point patterns
    return ENTRY_POINTS.some(pattern => {
        const regex = new RegExp(
            '^' + pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\./g, '\\.') + '$'
        );
        return regex.test(relativePath);
    });
}

function getAllTsFiles(dir: string, baseDir: string = dir): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        // Skip node_modules, .git, etc.
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        if (entry.isDirectory()) {
            files.push(...getAllTsFiles(fullPath, baseDir));
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
}

function resolveImport(importPath: string, fromFile: string, project: Project): string | null {
    const fromDir = path.dirname(fromFile);

    // Handle alias imports (@/...)
    if (importPath.startsWith('@/')) {
        return path.join(ROOT_DIR, importPath.replace('@/', ''));
    }

    // Handle relative imports
    if (importPath.startsWith('.')) {
        const resolved = path.resolve(fromDir, importPath);

        // Try various extensions
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
        for (const ext of extensions) {
            const withExt = resolved + ext;
            if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
                return withExt;
            }
        }
    }

    // External module (node_modules) - ignore
    return null;
}

// ============================================
// MAIN ANALYSIS
// ============================================

async function analyzeProject(): Promise<AuditResult> {
    console.log('🔍 Starting dead code audit...\n');

    const project = new Project({
        tsConfigFilePath: path.join(ROOT_DIR, 'tsconfig.json'),
        skipAddingFilesFromTsConfig: true,
    });

    // Get all TypeScript/JavaScript files
    const allFiles = getAllTsFiles(ROOT_DIR);
    console.log(`📁 Found ${allFiles.length} source files`);

    // Build file graph
    const fileGraph = new Map<string, FileNode>();

    for (const filePath of allFiles) {
        const relativePath = path.relative(ROOT_DIR, filePath);

        const node: FileNode = {
            path: filePath,
            relativePath,
            isEntryPoint: isEntryPoint(relativePath),
            isImmune: isImmune(relativePath),
            imports: [],
            exports: [],
            isReachable: false,
        };

        // Parse the file to extract imports
        try {
            const sourceFile = project.addSourceFileAtPath(filePath);

            // Get imports
            for (const imp of sourceFile.getImportDeclarations()) {
                const moduleSpecifier = imp.getModuleSpecifierValue();
                const resolved = resolveImport(moduleSpecifier, filePath, project);
                if (resolved) {
                    node.imports.push(resolved);
                }
            }

            // Get dynamic imports
            sourceFile.forEachDescendant((descendant) => {
                if (Node.isCallExpression(descendant)) {
                    const expr = descendant.getExpression();
                    if (expr.getText() === 'import' || expr.getText() === 'require') {
                        const args = descendant.getArguments();
                        if (args.length > 0 && Node.isStringLiteral(args[0])) {
                            const moduleSpecifier = args[0].getLiteralValue();
                            const resolved = resolveImport(moduleSpecifier, filePath, project);
                            if (resolved) {
                                node.imports.push(resolved);
                            }
                        }
                    }
                }
            });

            // Get exports
            for (const exp of sourceFile.getExportedDeclarations()) {
                node.exports.push(exp[0]);
            }

        } catch (error) {
            // File couldn't be parsed - mark as immune to be safe
            node.isImmune = true;
        }

        fileGraph.set(filePath, node);
    }

    // Mark entry points and immune files as reachable
    for (const [filePath, node] of fileGraph) {
        if (node.isEntryPoint || node.isImmune) {
            node.isReachable = true;
            node.reachableVia = node.isEntryPoint ? 'entry-point' : 'immune';
        }
    }

    // Propagate reachability through imports (BFS)
    const queue: string[] = [...fileGraph.entries()]
        .filter(([_, node]) => node.isReachable)
        .map(([path, _]) => path);

    while (queue.length > 0) {
        const currentPath = queue.shift()!;
        const currentNode = fileGraph.get(currentPath);
        if (!currentNode) continue;

        for (const importPath of currentNode.imports) {
            const importedNode = fileGraph.get(importPath);
            if (importedNode && !importedNode.isReachable) {
                importedNode.isReachable = true;
                importedNode.reachableVia = currentNode.relativePath;
                queue.push(importPath);
            }
        }
    }

    // Collect results
    const candidateFiles = [...fileGraph.values()]
        .filter(node => !node.isReachable && !node.isImmune);

    const result: AuditResult = {
        totalFiles: allFiles.length,
        entryPoints: [...fileGraph.values()].filter(n => n.isEntryPoint).length,
        immuneFiles: [...fileGraph.values()].filter(n => n.isImmune).length,
        reachableFiles: [...fileGraph.values()].filter(n => n.isReachable).length,
        candidateFiles: candidateFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
        unusedExports: [], // TODO: Implement unused export detection
        timestamp: new Date().toISOString(),
    };

    console.log(`\n✅ Analysis complete:`);
    console.log(`   Entry points: ${result.entryPoints}`);
    console.log(`   Immune files: ${result.immuneFiles}`);
    console.log(`   Reachable files: ${result.reachableFiles}`);
    console.log(`   Candidates for removal: ${result.candidateFiles.length}`);

    return result;
}

// ============================================
// REPORT GENERATION
// ============================================

function generateReport(result: AuditResult): string {
    const lines: string[] = [];

    lines.push('# Dead Code Audit Report');
    lines.push('');
    lines.push(`> Generated: ${result.timestamp}`);
    lines.push('');
    lines.push('> ⚠️ **This is a READ-ONLY report.** No files have been deleted.');
    lines.push('> Review each candidate carefully before manual removal.');
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Files Analyzed | ${result.totalFiles} |`);
    lines.push(`| Entry Points (routes, scripts) | ${result.entryPoints} |`);
    lines.push(`| Immune Files (configs, assets) | ${result.immuneFiles} |`);
    lines.push(`| Reachable via Imports | ${result.reachableFiles} |`);
    lines.push(`| **Candidates for Removal** | **${result.candidateFiles.length}** |`);
    lines.push('');

    // Candidates
    if (result.candidateFiles.length === 0) {
        lines.push('## ✅ No Dead Code Found');
        lines.push('');
        lines.push('All project files are either:');
        lines.push('- Direct entry points (Expo routes, scripts)');
        lines.push('- Imported by other files');
        lines.push('- Immune (configs, assets, type declarations)');
    } else {
        lines.push('## ⚠️ Candidates for Removal');
        lines.push('');
        lines.push('These files were not imported by any reachable code.');
        lines.push('**Verify each one before deleting:**');
        lines.push('');

        // Group by directory
        const byDir = new Map<string, FileNode[]>();
        for (const file of result.candidateFiles) {
            const dir = path.dirname(file.relativePath);
            if (!byDir.has(dir)) byDir.set(dir, []);
            byDir.get(dir)!.push(file);
        }

        for (const [dir, files] of [...byDir.entries()].sort()) {
            lines.push(`### \`${dir}/\``);
            lines.push('');
            for (const file of files) {
                lines.push(`- [ ] \`${path.basename(file.relativePath)}\``);
            }
            lines.push('');
        }
    }

    // Verification guide
    lines.push('---');
    lines.push('');
    lines.push('## How to Verify Candidates');
    lines.push('');
    lines.push('Before removing any file, check for these **false positive** scenarios:');
    lines.push('');
    lines.push('### 1. Dynamic Imports');
    lines.push('```typescript');
    lines.push('// This import won\'t be detected statically:');
    lines.push('const module = await import(`./modules/${name}`);');
    lines.push('```');
    lines.push('**Action:** Search for dynamic import patterns using the file name.');
    lines.push('');
    lines.push('### 2. Re-exports from Barrel Files');
    lines.push('```typescript');
    lines.push('// index.ts might export from the "unused" file');
    lines.push('export * from \'./utils\';');
    lines.push('```');
    lines.push('**Action:** Check if any `index.ts` re-exports the file.');
    lines.push('');
    lines.push('### 3. Used Only in Tests');
    lines.push('Test files are immune, but their direct imports are tracked.');
    lines.push('**Action:** Search for the file in `__tests__/` or `*.test.ts` files.');
    lines.push('');
    lines.push('### 4. Used in Package Scripts');
    lines.push('```json');
    lines.push('{ "scripts": { "migrate": "ts-node lib/db/migrate.ts" } }');
    lines.push('```');
    lines.push('**Action:** Check `package.json` scripts for direct references.');
    lines.push('');
    lines.push('### 5. Referenced in Configs');
    lines.push('Metro, Babel, or other tools might reference files.');
    lines.push('**Action:** Search in `*.config.js` files.');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Safe Removal Process');
    lines.push('');
    lines.push('1. ✅ Verify the file is truly unused (see above)');
    lines.push('2. 🔍 Search the entire codebase: `grep -r "filename" .`');
    lines.push('3. 🧪 Run tests after removal: `npm test`');
    lines.push('4. 📦 Build the project: `npx expo export`');
    lines.push('5. 🚀 Test the app on device');
    lines.push('');

    return lines.join('\n');
}

// ============================================
// MAIN
// ============================================

async function main() {
    try {
        const result = await analyzeProject();
        const report = generateReport(result);

        fs.writeFileSync(OUTPUT_FILE, report);
        console.log(`\n📄 Report saved to: ${OUTPUT_FILE}`);

        if (result.candidateFiles.length > 0) {
            console.log('\n⚠️  Review the report carefully before removing any files!');
        }
    } catch (error) {
        console.error('❌ Audit failed:', error);
        process.exit(1);
    }
}

main();
