#!/usr/bin/env node
/**
 * Prebuild script for litegraph to ensure compatibility with Playwright
 * This script removes TypeScript 'declare' keyword that Playwright/Babel can't handle
 * The files remain as TypeScript but with the problematic syntax removed
 */
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

async function prebuildLitegraph() {
  console.log('Pre-processing litegraph for Playwright compatibility...')

  try {
    // Find all TypeScript files that use 'declare'
    const filesToProcess = [
      'LGraphNode.ts',
      'widgets/BaseWidget.ts',
      'subgraph/SubgraphInput.ts',
      'subgraph/SubgraphNode.ts',
      'subgraph/SubgraphOutput.ts',
      'subgraph/EmptySubgraphInput.ts',
      'subgraph/EmptySubgraphOutput.ts'
    ]

    let processedCount = 0

    for (const relativePath of filesToProcess) {
      const filePath = path.join(litegraphSrcDir, relativePath)

      if (await fs.pathExists(filePath)) {
        const originalContent = await fs.readFile(filePath, 'utf-8')

        // Remove 'declare' keyword from class properties
        // This regex matches 'declare' at the start of a line (with optional whitespace)
        const modifiedContent = originalContent.replace(
          /^(\s*)declare\s+/gm,
          '$1// @ts-ignore\n$1'
        )

        if (originalContent !== modifiedContent) {
          // Create backup
          const backupPath = filePath + '.backup'
          if (!(await fs.pathExists(backupPath))) {
            await fs.writeFile(backupPath, originalContent)
          }

          // Write modified content
          await fs.writeFile(filePath, modifiedContent)
          processedCount++
          console.log(`  ✓ Processed ${relativePath}`)
        }
      }
    }

    console.log(`✅ Pre-processed ${processedCount} files successfully`)
  } catch (error) {
    console.error('❌ Failed to pre-process litegraph:', error.message)
    // eslint-disable-next-line no-undef
    process.exit(1)
  }
}

// Run the prebuild
prebuildLitegraph().catch(console.error)
