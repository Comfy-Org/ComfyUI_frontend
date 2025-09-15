#!/usr/bin/env bun

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __dirname = process.cwd()

// Parse the tsc.log file to get all errors
async function parseErrors(file) {
  const logContent = await fs.readFile(file, 'utf-8');
  const lines = logContent.split('\n').filter(line => line.includes('error TS1484'));

  const errors = [];
  for (const line of lines) {
    // Match the format: filepath(line,col): error TS1484: 'TypeName' is a type
    // Note: Some lines may have a number prefix followed by →
    const match = line.match(/(?:\d+→)?(.+?)\((\d+),(\d+)\): error TS1484: '(.+?)' is a type/);
    if (match) {
      const [, filePath, lineNum, colNum, typeName] = match;
      errors.push({
        filePath: path.join(__dirname, filePath.trim()),
        lineNum: parseInt(lineNum),
        colNum: parseInt(colNum),
        typeName
      });
    }
  }

  return errors;
}

// Group errors by file
function groupByFile(errors) {
  const grouped = {};
  for (const error of errors) {
    if (!grouped[error.filePath]) {
      grouped[error.filePath] = [];
    }
    grouped[error.filePath].push(error);
  }
  return grouped;
}

// Process a single file
async function processFile(filePath, errors) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Sort errors by line and column in reverse order to avoid position shifts
    errors.sort((a, b) => {
      if (a.lineNum !== b.lineNum) {
        return b.lineNum - a.lineNum;
      }
      return b.colNum - a.colNum;
    });

    // Process each error
    for (const error of errors) {
      const lineIndex = error.lineNum - 1;
      const line = lines[lineIndex];
      if (!line) continue;

      // Skip if already has 'type' keyword before this position
      const beforePos = line.substring(0, error.colNum - 1);
      if (beforePos.includes('import type') || beforePos.endsWith('{ type ') || beforePos.endsWith(', type ')) {
        continue;
      }

      // Insert "type " at the exact column position (column is 1-based)
      const insertPos = error.colNum - 1;
      lines[lineIndex] = line.substring(0, insertPos) + 'type ' + line.substring(insertPos);
    }

    await fs.writeFile(filePath, lines.join('\n'));
    console.log(`✓ Fixed ${errors.length} type imports in ${path.relative(__dirname, filePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🔧 Fixing TypeScript type-only imports...\n');

  const logFile = path.join(__dirname, 'tsc.log');

  if (!await fs.readFile(logFile, 'utf-8').catch(() => null)) {
    console.error('Unable to read tsc.log');
    console.error('Run this command to generate type errors and rerun this script again:');
    console.error('pnpm typecheck > tsc.log');
    return;
  }

  console.log('Parsing tsc.log for type import errors...\n');
  const errors = await parseErrors(logFile);
  console.log(`Found ${errors.length} type import errors\n`);

  const grouped = groupByFile(errors);
  const files = Object.keys(grouped);
  console.log(`Processing ${files.length} files...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const filePath of files) {
    const success = await processFile(filePath, grouped[filePath]);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✓ Successfully processed: ${successCount} files`);
  if (failCount > 0) {
    console.log(`✗ Failed to process: ${failCount} files`);
  }

  console.log('\n✨ Refactoring complete!');
  console.log('Run "pnpm typecheck" to verify the fixes.');
}

// Run the script
main().catch(console.error);