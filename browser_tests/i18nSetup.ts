/**
 * Setup for i18n collection tests
 * Handles preprocessing of files that contain TypeScript 'declare' keywords
 */
import { promises as fs } from 'fs'
import { glob } from 'glob'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')
const scriptsSrcDir = path.join(rootDir, 'src/scripts')

const backupMap = new Map<string, string>()

export async function preprocessLitegraph() {
  console.log('Preprocessing litegraph files for i18n collection...')

  // Search for all .ts files in litegraph src directory and scripts directory
  const patterns = [
    path.join(litegraphSrcDir, '**/*.ts'),
    path.join(scriptsSrcDir, '**/*.ts')
  ]
  
  const files = (
    await Promise.all(
      patterns.map((pattern) =>
        glob(pattern, {
          ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
        })
      )
    )
  ).flat()

  let processedCount = 0

  // Process files in parallel - read once and process if needed
  await Promise.all(
    files.map(async (filePath) => {
      try {
        const originalContent = await fs.readFile(filePath, 'utf-8')

        // Check if file needs any modifications
        const hasDeclareKeywords = /^\s*declare\s+/m.test(originalContent)
        const hasCssImports = /^(\s*)import\s+['"].*\.css['"];?$/m.test(originalContent)
        
        if (!hasDeclareKeywords && !hasCssImports) {
          return // Skip files that don't need modifications
        }

        // Store original content in memory
        backupMap.set(filePath, originalContent)

        let modifiedContent = originalContent
        
        // Remove 'declare' keyword from class properties if present
        if (hasDeclareKeywords) {
          modifiedContent = modifiedContent.replace(
            /^(\s*)declare\s+/gm,
            '$1// @ts-ignore - removed declare for Playwright\n$1'
          )
        }
        
        // Comment out CSS imports to avoid Babel parsing errors
        if (hasCssImports) {
          modifiedContent = modifiedContent.replace(
            /^(\s*)import\s+['"].*\.css['"];?$/gm,
            '$1// CSS import commented for Playwright: $&'
          )
        }

        // Write modified content
        await fs.writeFile(filePath, modifiedContent)
        const relativePath = filePath.includes(litegraphSrcDir)
          ? path.relative(litegraphSrcDir, filePath)
          : path.relative(scriptsSrcDir, filePath)
        console.log(`  ✓ Processed ${relativePath}`)
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
      const relativePath = filePath.includes(litegraphSrcDir)
        ? path.relative(litegraphSrcDir, filePath)
        : path.relative(scriptsSrcDir, filePath)
      console.log(`  ✓ Restored ${relativePath}`)
    })
  )

  backupMap.clear()
}
