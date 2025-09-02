/**
 * Custom sharding configuration for Playwright tests
 * Balances test execution time across shards based on test complexity
 */

export interface ShardConfig {
  testFiles: string[]
  weight: number // Estimated relative execution time
}

// Group tests by execution characteristics
export const HEAVY_SCREENSHOT_TESTS = [
  'interaction.spec.ts', // 61 tests, 81 screenshots - heaviest test file
]

export const MEDIUM_SCREENSHOT_TESTS = [
  'widget.spec.ts', // 17 tests with screenshots
  'rightClickMenu.spec.ts', // 11 tests with screenshots
  'nodeSearchBox.spec.ts', // 23 tests with screenshots
  'groupNode.spec.ts', // 17 tests with screenshots
]

export const LIGHT_SCREENSHOT_TESTS = [
  'colorPalette.spec.ts',
  'primitiveNode.spec.ts',
  'nodeDisplay.spec.ts',
  'graphCanvasMenu.spec.ts',
  'nodeBadge.spec.ts',
  'noteNode.spec.ts',
  'domWidget.spec.ts',
  'templates.spec.ts',
  'selectionToolbox.spec.ts',
  'execution.spec.ts',
  'rerouteNode.spec.ts',
  'copyPaste.spec.ts',
  'loadWorkflowInMedia.spec.ts',
]

export const HEAVY_LOGIC_TESTS = [
  'subgraph.spec.ts', // 23 tests, complex logic
  'dialog.spec.ts', // 21 tests
  'sidebar/workflows.spec.ts', // 18 tests
  'sidebar/nodeLibrary.spec.ts', // 18 tests
]

export const MEDIUM_LOGIC_TESTS = [
  'remoteWidgets.spec.ts', // 14 tests
  'useSettingSearch.spec.ts', // 13 tests
  'sidebar/queue.spec.ts', // 12 tests
  'nodeHelp.spec.ts', // 12 tests
  'extensionAPI.spec.ts', // 11 tests
  'bottomPanelShortcuts.spec.ts', // 11 tests
  'featureFlags.spec.ts', // 9 tests
  'menu.spec.ts', // 9 tests
]

export const LIGHT_LOGIC_TESTS = [
  'backgroundImageUpload.spec.ts',
  'browserTabTitle.spec.ts',
  'changeTracker.spec.ts',
  'chatHistory.spec.ts',
  'commands.spec.ts',
  'customIcons.spec.ts',
  'graph.spec.ts',
  'keybindings.spec.ts',
  'litegraphEvent.spec.ts',
  'minimap.spec.ts',
  'releaseNotifications.spec.ts',
  'subgraph-rename-dialog.spec.ts',
  'userSelectView.spec.ts',
  'versionMismatchWarnings.spec.ts',
  'workflowTabThumbnail.spec.ts',
  'actionbar.spec.ts',
]

// Optimized shard distribution for chromium tests
export const CHROMIUM_SHARDS: ShardConfig[] = [
  {
    // Shard 1: Heavy screenshot test (interaction.spec.ts alone)
    testFiles: HEAVY_SCREENSHOT_TESTS,
    weight: 100
  },
  {
    // Shard 2: Medium screenshot tests
    testFiles: MEDIUM_SCREENSHOT_TESTS,
    weight: 80
  },
  {
    // Shard 3: Light screenshot tests
    testFiles: LIGHT_SCREENSHOT_TESTS,
    weight: 70
  },
  {
    // Shard 4: Heavy logic tests
    testFiles: HEAVY_LOGIC_TESTS,
    weight: 75
  },
  {
    // Shard 5: Medium and light logic tests
    testFiles: [...MEDIUM_LOGIC_TESTS, ...LIGHT_LOGIC_TESTS],
    weight: 65
  }
]

// No sharding needed for these projects
export const NO_SHARD_PROJECTS = [
  'mobile-chrome',
  'chromium-0.5x',
  'chromium-2x'
]

/**
 * Get the test files for a specific shard
 * @param shardIndex 1-based shard index
 * @param totalShards Total number of shards
 * @param projectName Name of the Playwright project
 */
export function getShardTests(shardIndex: number, totalShards: number, projectName: string): string[] | null {
  // For projects that don't need sharding, return null to run all tests
  if (NO_SHARD_PROJECTS.includes(projectName)) {
    return null
  }

  // For chromium project, use custom sharding
  if (projectName === 'chromium' && totalShards === 5) {
    const shard = CHROMIUM_SHARDS[shardIndex - 1]
    return shard ? shard.testFiles : []
  }

  // Fallback to default sharding for other configurations
  return null
}

/**
 * Get a grep pattern to filter tests for a specific shard
 * @param shardIndex 1-based shard index
 * @param totalShards Total number of shards
 * @param projectName Name of the Playwright project
 */
export function getShardGrep(shardIndex: number, totalShards: number, projectName: string): RegExp | null {
  const tests = getShardTests(shardIndex, totalShards, projectName)
  
  if (!tests || tests.length === 0) {
    return null
  }

  // Create a regex pattern that matches any of the test files
  const pattern = tests.map(file => file.replace(/\./g, '\\.')).join('|')
  return new RegExp(pattern)
}