/**
 * Setup for i18n collection tests
 * Handles preprocessing of litegraph files that contain TypeScript 'declare' keywords
 */
import { promises as fs } from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

const backupMap = new Map<string, string>()

/**
 * Find all TypeScript files in litegraph that contain 'declare' keywords
 */
async function findFilesWithDeclare(): Promise<string[]> {
  // Search for all .ts files in litegraph src directory
  const pattern = path.join(litegraphSrcDir, '**/*.ts')
  const files = await glob(pattern, {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  })
  
  // Filter to only files that actually contain 'declare' keyword
  const filesWithDeclare = await Promise.all(
    files.map(async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        // Check for class property declarations with 'declare' keyword
        return /^\s*declare\s+/m.test(content) ? filePath : null
      } catch (error) {
        console.warn(`  ⚠ Could not read ${filePath}: ${error.message}`)
        return null
      }
    })
  )
  
  return filesWithDeclare.filter((file): file is string => file !== null)
}

export async function preprocessLitegraph() {
  console.log('Preprocessing litegraph files for i18n collection...')
  
  const filesToProcess = await findFilesWithDeclare()
  
  if (filesToProcess.length === 0) {
    console.log('  ℹ No files with declare keywords found')
    return
  }
  
  console.log(`  Found ${filesToProcess.length} files with declare keywords`)
  
  await Promise.all(
    filesToProcess.map(async (filePath) => {
      const originalContent = await fs.readFile(filePath, 'utf-8')
      
      // Store original content in memory
      backupMap.set(filePath, originalContent)
      
      // Remove 'declare' keyword from class properties
      const modifiedContent = originalContent.replace(
        /^(\s*)declare\s+/gm,
        '$1// @ts-ignore - removed declare for Playwright\n$1'
      )
      
      // Write modified content
      await fs.writeFile(filePath, modifiedContent)
      console.log(`  ✓ Processed ${path.relative(litegraphSrcDir, filePath)}`)
    })
  )
}

export async function restoreLitegraph() {
  if (backupMap.size === 0) {
    return
  }
  
  console.log('Restoring original litegraph files...')
  
  await Promise.all(
    Array.from(backupMap.entries()).map(async ([filePath, originalContent]) => {
      await fs.writeFile(filePath, originalContent)
      console.log(`  ✓ Restored ${path.relative(litegraphSrcDir, filePath)}`)
    })
  )
  
  backupMap.clear()
}