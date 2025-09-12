/**
 * Setup for i18n collection tests
 * Handles preprocessing of litegraph files that contain TypeScript 'declare' keywords
 */
import { promises as fs } from 'fs'
import { glob } from 'glob'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

const backupMap = new Map<string, string>()

export async function preprocessLitegraph() {
  console.log('Preprocessing litegraph files for i18n collection...')

  // Search for all .ts files in litegraph src directory
  const pattern = path.join(litegraphSrcDir, '**/*.ts')
  const files = await glob(pattern, {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  })

  let processedCount = 0

  // Process files in parallel - read once and process if needed
  await Promise.all(
    files.map(async (filePath) => {
      try {
        const originalContent = await fs.readFile(filePath, 'utf-8')

        // Check for class property declarations with 'declare' keyword
        if (!/^\s*declare\s+/m.test(originalContent)) {
          return // Skip files without declare keywords
        }

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
        processedCount++
      } catch (error: unknown) {
        console.warn(
          `  ⚠ Could not preprocess file for litegraph ${filePath}: ${String((error as Error)?.message || error)}`
        )
      }
    })
  )

  if (processedCount === 0) {
    console.log('  ℹ No files with declare keywords found')
  } else {
    console.log(`  Processed ${processedCount} files with declare keywords`)
  }
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
