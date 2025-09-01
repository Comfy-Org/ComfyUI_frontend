#!/usr/bin/env node
/**
 * Restore script for litegraph after Playwright tests
 * This script restores the original TypeScript files from backups
 */
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

async function restoreLitegraph() {
  console.log('Restoring original litegraph files...')

  try {
    const filesToRestore = [
      'LGraphNode.ts',
      'widgets/BaseWidget.ts',
      'subgraph/SubgraphInput.ts',
      'subgraph/SubgraphNode.ts',
      'subgraph/SubgraphOutput.ts',
      'subgraph/EmptySubgraphInput.ts',
      'subgraph/EmptySubgraphOutput.ts'
    ]

    let restoredCount = 0

    for (const relativePath of filesToRestore) {
      const filePath = path.join(litegraphSrcDir, relativePath)
      const backupPath = filePath + '.backup'

      if (await fs.pathExists(backupPath)) {
        const backupContent = await fs.readFile(backupPath, 'utf-8')
        await fs.writeFile(filePath, backupContent)
        await fs.remove(backupPath)
        restoredCount++
        console.log(`  ✓ Restored ${relativePath}`)
      }
    }

    console.log(`✅ Restored ${restoredCount} files successfully`)
  } catch (error) {
    console.error('❌ Failed to restore litegraph:', error.message)
    // eslint-disable-next-line no-undef
    process.exit(1)
  }
}

// Run the restore
restoreLitegraph().catch(console.error)
