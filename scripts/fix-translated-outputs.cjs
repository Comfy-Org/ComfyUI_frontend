#!/usr/bin/env node

/**
 * Fix malformed outputs arrays in translated nodeDefs.json files
 * 
 * The translation service sometimes converts object structures to arrays with null values:
 * 
 * Expected: { "outputs": { "0": { "name": "image" }, "1": { "name": "mask" } } }
 * Actual:   { "outputs": [ null, null, { "name": "normal" }, { "name": "info" } ] }
 * 
 * This script converts malformed arrays back to the correct object structure.
 */

const fs = require('fs');
const path = require('path');

/**
 * Fix malformed outputs in a node definition object
 * @param {Object} nodeDef - Node definition object
 * @returns {Object} Fixed node definition
 */
function fixNodeDefOutputs(nodeDef) {
  if (!nodeDef.outputs) {
    return nodeDef;
  }

  // If outputs is already an object, no fix needed
  if (!Array.isArray(nodeDef.outputs)) {
    return nodeDef;
  }

  // Convert array to object, filtering out nulls
  const outputsObject = {};
  nodeDef.outputs.forEach((output, index) => {
    if (output !== null && output !== undefined) {
      outputsObject[index.toString()] = output;
    }
  });

  return {
    ...nodeDef,
    outputs: outputsObject
  };
}

/**
 * Fix malformed outputs in all node definitions in a locale file
 * @param {Object} localeData - Parsed locale JSON data
 * @returns {Object} Fixed locale data
 */
function fixLocaleOutputs(localeData) {
  const fixed = {};
  
  for (const [nodeKey, nodeDef] of Object.entries(localeData)) {
    fixed[nodeKey] = fixNodeDefOutputs(nodeDef);
  }
  
  return fixed;
}

/**
 * Process a single nodeDefs.json file
 * @param {string} filePath - Path to the file
 */
function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const fixed = fixLocaleOutputs(data);
    const fixedContent = JSON.stringify(fixed, null, 2);
    
    // Only write if content changed
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent);
      console.log(`  ✓ Fixed malformed outputs in ${filePath}`);
    } else {
      console.log(`  - No changes needed in ${filePath}`);
    }
    
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Find all nodeDefs.json files except the English source
 * @returns {string[]} Array of file paths
 */
function findTranslatedLocaleFiles() {
  const localesDir = path.join(process.cwd(), 'src', 'locales');
  
  if (!fs.existsSync(localesDir)) {
    return [];
  }
  
  const files = [];
  const locales = fs.readdirSync(localesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'en')
    .map(dirent => dirent.name);
  
  for (const locale of locales) {
    const nodeDefsPath = path.join(localesDir, locale, 'nodeDefs.json');
    if (fs.existsSync(nodeDefsPath)) {
      files.push(nodeDefsPath);
    }
  }
  
  return files;
}

/**
 * Main execution
 */
function main() {
  try {
    const files = findTranslatedLocaleFiles();
    
    if (files.length === 0) {
      console.log('No translated nodeDefs.json files found to process.');
      return;
    }
    
    console.log(`Found ${files.length} translated locale files to process:`);
    files.forEach(file => console.log(`  - ${path.relative(process.cwd(), file)}`));
    console.log('');
    
    files.forEach(processFile);
    
    console.log('\n✓ All files processed successfully');
    
  } catch (error) {
    console.error('Error finding files:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}