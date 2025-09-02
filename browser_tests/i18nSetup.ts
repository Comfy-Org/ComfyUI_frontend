/**
 * Setup for i18n collection tests
 * Handles preprocessing of litegraph files that contain TypeScript 'declare' keywords
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const litegraphSrcDir = path.join(rootDir, 'src/lib/litegraph/src')

const filesToProcess = [
  'LGraphNode.ts',
  'widgets/BaseWidget.ts',
  'subgraph/SubgraphInput.ts',
  'subgraph/SubgraphNode.ts',
  'subgraph/SubgraphOutput.ts',
  'subgraph/EmptySubgraphInput.ts',
  'subgraph/EmptySubgraphOutput.ts'
]

const backupMap = new Map<string, string>()

export async function preprocessLitegraph() {
  console.log('Preprocessing litegraph files for i18n collection...')
  
  for (const relativePath of filesToProcess) {
    const filePath = path.join(litegraphSrcDir, relativePath)
    
    if (fs.existsSync(filePath)) {
      const originalContent = fs.readFileSync(filePath, 'utf-8')
      
      // Only process if file contains 'declare' keywords
      if (originalContent.includes('declare ')) {
        // Store original content in memory
        backupMap.set(filePath, originalContent)
        
        // Remove 'declare' keyword from class properties
        const modifiedContent = originalContent.replace(
          /^(\s*)declare\s+/gm,
          '$1// @ts-ignore - removed declare for Playwright\n$1'
        )
        
        // Write modified content
        fs.writeFileSync(filePath, modifiedContent)
        console.log(`  ✓ Processed ${relativePath}`)
      }
    }
  }
}

export async function restoreLitegraph() {
  console.log('Restoring original litegraph files...')
  
  for (const [filePath, originalContent] of backupMap.entries()) {
    fs.writeFileSync(filePath, originalContent)
    console.log(`  ✓ Restored ${path.relative(litegraphSrcDir, filePath)}`)
  }
  
  backupMap.clear()
}