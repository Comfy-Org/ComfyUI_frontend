#!/usr/bin/env node
/**
 * Script to analyze test distribution and create optimized shard configurations
 * Run with: node browser_tests/scripts/optimizeSharding.js
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test weights based on empirical data and test characteristics
const TEST_WEIGHTS = {
  'interaction.spec.ts': 180, // Very heavy - 61 tests with 81 screenshots
  'subgraph.spec.ts': 60, // Heavy - 23 complex tests
  'widget.spec.ts': 50, // Medium-heavy - screenshots
  'nodeSearchBox.spec.ts': 45, // Medium-heavy - screenshots
  'dialog.spec.ts': 40,
  'groupNode.spec.ts': 40,
  'rightClickMenu.spec.ts': 35,
  'sidebar/workflows.spec.ts': 35,
  'sidebar/nodeLibrary.spec.ts': 35,
  'colorPalette.spec.ts': 30,
  'nodeDisplay.spec.ts': 25,
  'primitiveNode.spec.ts': 25,
  'templates.spec.ts': 25,
  'remoteWidgets.spec.ts': 25,
  'useSettingSearch.spec.ts': 25,
  'nodeHelp.spec.ts': 25,
  'extensionAPI.spec.ts': 20,
  'bottomPanelShortcuts.spec.ts': 20,
  'featureFlags.spec.ts': 20,
  'sidebar/queue.spec.ts': 20,
  'graphCanvasMenu.spec.ts': 20,
  'nodeBadge.spec.ts': 20,
  'noteNode.spec.ts': 15,
  'domWidget.spec.ts': 15,
  'selectionToolbox.spec.ts': 15,
  'execution.spec.ts': 15,
  'rerouteNode.spec.ts': 15,
  'copyPaste.spec.ts': 15,
  'loadWorkflowInMedia.spec.ts': 15,
  'menu.spec.ts': 15,
  // Light tests
  'backgroundImageUpload.spec.ts': 10,
  'browserTabTitle.spec.ts': 10,
  'changeTracker.spec.ts': 10,
  'chatHistory.spec.ts': 10,
  'commands.spec.ts': 10,
  'customIcons.spec.ts': 10,
  'graph.spec.ts': 10,
  'keybindings.spec.ts': 10,
  'litegraphEvent.spec.ts': 10,
  'minimap.spec.ts': 10,
  'releaseNotifications.spec.ts': 10,
  'subgraph-rename-dialog.spec.ts': 10,
  'userSelectView.spec.ts': 10,
  'versionMismatchWarnings.spec.ts': 10,
  'workflowTabThumbnail.spec.ts': 10,
  'actionbar.spec.ts': 10
}

/**
 * Get all test files from the browser_tests directory
 */
function getTestFiles() {
  const testsDir = path.join(__dirname, '..', 'tests')
  const files = []

  function scanDir(dir, prefix = '') {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const relativePath = prefix ? `${prefix}/${item}` : item

      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath, relativePath)
      } else if (item.endsWith('.spec.ts')) {
        files.push(relativePath)
      }
    }
  }

  scanDir(testsDir)
  return files
}

/**
 * Create balanced shards based on test weights
 */
function createBalancedShards(testFiles, numShards) {
  // Create test entries with weights
  const tests = testFiles.map((file) => ({
    file,
    weight: TEST_WEIGHTS[file] || 15 // Default weight for unknown tests
  }))

  // Sort tests by weight (heaviest first)
  tests.sort((a, b) => b.weight - a.weight)

  // Initialize shards
  const shards = Array.from({ length: numShards }, () => ({
    tests: [],
    totalWeight: 0
  }))

  // Distribute tests using a greedy algorithm (assign to shard with least weight)
  for (const test of tests) {
    // Find shard with minimum weight
    let minShard = shards[0]
    for (const shard of shards) {
      if (shard.totalWeight < minShard.totalWeight) {
        minShard = shard
      }
    }

    // Add test to the lightest shard
    minShard.tests.push(test.file)
    minShard.totalWeight += test.weight
  }

  return shards
}

/**
 * Print shard configuration
 */
function printShardConfig(shards) {
  console.log('\n=== Optimized Shard Configuration ===\n')

  shards.forEach((shard, index) => {
    console.log(`Shard ${index + 1} (weight: ${shard.totalWeight})`)
    console.log('  Tests:')
    shard.tests.forEach((test) => {
      const weight = TEST_WEIGHTS[test] || 15
      console.log(`    - ${test} (weight: ${weight})`)
    })
    console.log()
  })

  // Print weight balance analysis
  const weights = shards.map((s) => s.totalWeight)
  const maxWeight = Math.max(...weights)
  const minWeight = Math.min(...weights)
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length

  console.log('=== Balance Analysis ===')
  console.log(`Max weight: ${maxWeight}`)
  console.log(`Min weight: ${minWeight}`)
  console.log(`Avg weight: ${avgWeight.toFixed(1)}`)
  console.log(
    `Imbalance: ${(((maxWeight - minWeight) / avgWeight) * 100).toFixed(1)}%`
  )
}

/**
 * Generate TypeScript configuration file
 */
function generateConfigFile(shards) {
  const config = `/**
 * Auto-generated shard configuration for balanced test distribution
 * Generated on: ${new Date().toISOString()}
 */

export const OPTIMIZED_SHARDS = ${JSON.stringify(
    shards.map((s) => s.tests),
    null,
    2
  )}

export function getShardTests(shardIndex: number): string[] {
  return OPTIMIZED_SHARDS[shardIndex - 1] || []
}

export function getShardPattern(shardIndex: number): string[] {
  return getShardTests(shardIndex).map(test => \`**/\${test}\`)
}
`

  const configPath = path.join(__dirname, '..', 'shardConfig.generated.ts')
  fs.writeFileSync(configPath, config)
  console.log(`\n✅ Generated configuration file: ${configPath}`)
}

// Main execution
function main() {
  const numShards = parseInt(process.argv[2]) || 5

  console.log(`Analyzing test distribution for ${numShards} shards...`)

  const testFiles = getTestFiles()
  console.log(`Found ${testFiles.length} test files`)

  const shards = createBalancedShards(testFiles, numShards)
  printShardConfig(shards)
  generateConfigFile(shards)
}

main()
