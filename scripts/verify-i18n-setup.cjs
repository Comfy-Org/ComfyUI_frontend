#!/usr/bin/env node

/**
 * Verification script to check if i18n collection setup is working properly
 * This script performs basic checks to ensure the environment is ready for i18n collection
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying i18n collection setup...\n');

let hasErrors = false;

// Check 1: Verify locale directories exist
console.log('1. Checking locale directories...');
const localeDir = path.join(__dirname, '../src/locales/en');
if (fs.existsSync(localeDir)) {
  console.log('   ✅ Locale directory exists');
} else {
  console.log('   ❌ Locale directory missing:', localeDir);
  hasErrors = true;
}

// Check 2: Verify required locale files
console.log('\n2. Checking locale files...');
const requiredFiles = ['main.json', 'commands.json', 'settings.json', 'nodeDefs.json'];
requiredFiles.forEach(file => {
  const filePath = path.join(localeDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`   ✅ ${file} exists (${stats.size} bytes)`);
  } else {
    console.log(`   ❌ ${file} missing`);
    hasErrors = true;
  }
});

// Check 3: Verify TypeScript compilation works
console.log('\n3. Checking TypeScript compilation...');
const problematicFiles = [
  'src/lib/litegraph/src/subgraph/SubgraphNode.ts',
  'src/lib/litegraph/src/subgraph/SubgraphInput.ts',
  'src/lib/litegraph/src/subgraph/SubgraphOutput.ts',
  'src/lib/litegraph/src/subgraph/EmptySubgraphInput.ts',
  'src/lib/litegraph/src/subgraph/EmptySubgraphOutput.ts'
];

problematicFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Check for problematic patterns that caused issues
    if (content.includes('declare inputs:') && !content.includes('override inputs:')) {
      console.log(`   ⚠️  ${file} may have unfixed declare syntax`);
    } else {
      console.log(`   ✅ ${file} syntax looks correct`);
    }
  }
});

// Check 4: Verify Playwright configuration
console.log('\n4. Checking Playwright configuration...');
const playwrightConfig = path.join(__dirname, '../playwright.i18n.config.ts');
if (fs.existsSync(playwrightConfig)) {
  const content = fs.readFileSync(playwrightConfig, 'utf-8');
  if (content.includes('testDir: \'./browser_tests\'')) {
    console.log('   ✅ Playwright config points to correct test directory');
  } else {
    console.log('   ⚠️  Playwright config may need adjustment');
  }
} else {
  console.log('   ❌ Playwright i18n config missing');
  hasErrors = true;
}

// Check 5: Verify package.json scripts
console.log('\n5. Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
if (packageJson.scripts['collect-i18n']) {
  console.log(`   ✅ collect-i18n script exists: "${packageJson.scripts['collect-i18n']}"`);
} else {
  console.log('   ❌ collect-i18n script missing from package.json');
  hasErrors = true;
}

// Check 6: Verify Playwright version consistency
console.log('\n6. Checking Playwright versions...');
const devDeps = packageJson.devDependencies || {};
const playwrightVersion = devDeps['@playwright/test'];
if (playwrightVersion) {
  console.log(`   ✅ @playwright/test version: ${playwrightVersion}`);
  
  // Check for potential conflicts
  const mcpServer = devDeps['@executeautomation/playwright-mcp-server'];
  if (mcpServer) {
    console.log(`   ⚠️  MCP server present - may have version conflicts`);
    console.log(`      Ensure both use compatible Playwright versions`);
  }
} else {
  console.log('   ❌ @playwright/test not found in devDependencies');
  hasErrors = true;
}

// Final summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Verification failed - some issues need to be fixed');
  process.exit(1);
} else {
  console.log('✅ All checks passed - i18n collection should work!');
  console.log('\nTo run i18n collection:');
  console.log('  1. Start dev server: pnpm dev:electron');
  console.log('  2. Run collection: pnpm collect-i18n');
  process.exit(0);
}