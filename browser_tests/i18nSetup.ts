/**
 * Setup for i18n collection tests
 * Handles preprocessing of litegraph files that contain TypeScript 'declare' keywords
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

const backupMap = new Map<string, string>()

/**
 * Find all TypeScript files in litegraph that contain 'declare' keywords
 */
function findFilesWithDeclare(): string[] {
  // Search for all .ts files in litegraph src directory
  const pattern = path.join(litegraphSrcDir, '**/*.ts')
  const files = globSync(pattern, {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  })
  
  // Filter to only files that actually contain 'declare' keyword
  return files.filter(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      // Check for class property declarations with 'declare' keyword
      return /^\s*declare\s+/m.test(content)
    } catch (error) {
      console.warn(`  ⚠ Could not read ${filePath}: ${error.message}`)
      return false
    }
  })
}

export async function preprocessLitegraph() {
  console.log('Preprocessing litegraph files for i18n collection...')
  
  const filesToProcess = findFilesWithDeclare()
  
  if (filesToProcess.length === 0) {
    console.log('  ℹ No files with declare keywords found')
    return
  }
  
  console.log(`  Found ${filesToProcess.length} files with declare keywords`)
  
  for (const filePath of filesToProcess) {
    const originalContent = fs.readFileSync(filePath, 'utf-8')
    
    // Store original content in memory
    backupMap.set(filePath, originalContent)
    
    // Remove 'declare' keyword from class properties
    const modifiedContent = originalContent.replace(
      /^(\s*)declare\s+/gm,
      '$1// @ts-ignore - removed declare for Playwright\n$1'
    )
    
    // Write modified content
    fs.writeFileSync(filePath, modifiedContent)
    console.log(`  ✓ Processed ${path.relative(litegraphSrcDir, filePath)}`)
  }
}

export async function restoreLitegraph() {
  if (backupMap.size === 0) {
    return
  }
  
  console.log('Restoring original litegraph files...')
  
  for (const [filePath, originalContent] of backupMap.entries()) {
    fs.writeFileSync(filePath, originalContent)
    console.log(`  ✓ Restored ${path.relative(litegraphSrcDir, filePath)}`)
  }
  
  backupMap.clear()
}