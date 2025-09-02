import { defineConfig } from '@playwright/test'

import baseConfig from './playwright.config'

/**
 * Optimized Playwright configuration with intelligent sharding
 * This configuration improves test distribution to balance execution time
 */

// Helper to determine if we should apply custom test filtering
const shardInfo = process.env.SHARD
  ? process.env.SHARD.split('/').map(Number)
  : null
const currentShard = shardInfo?.[0] || 1
const totalShards = shardInfo?.[1] || 1
const projectName = process.env.TEST_PROJECT || 'chromium'

// Define test groups for better distribution
const testGroups = {
  // Heavy tests (run in separate shards)
  heavy: [
    '**/interaction.spec.ts' // 61 tests with 81 screenshots
  ],
  // Medium-heavy tests
  mediumHeavy: [
    '**/subgraph.spec.ts', // 23 complex tests
    '**/widget.spec.ts', // 17 tests with screenshots
    '**/nodeSearchBox.spec.ts' // 23 tests with screenshots
  ],
  // Medium tests
  medium: [
    '**/dialog.spec.ts',
    '**/groupNode.spec.ts',
    '**/rightClickMenu.spec.ts',
    '**/sidebar/workflows.spec.ts',
    '**/sidebar/nodeLibrary.spec.ts'
  ],
  // Light tests
  light: [
    '**/colorPalette.spec.ts',
    '**/primitiveNode.spec.ts',
    '**/nodeDisplay.spec.ts',
    '**/graphCanvasMenu.spec.ts',
    '**/nodeBadge.spec.ts',
    '**/noteNode.spec.ts',
    '**/domWidget.spec.ts',
    '**/templates.spec.ts',
    '**/selectionToolbox.spec.ts',
    '**/execution.spec.ts',
    '**/rerouteNode.spec.ts',
    '**/copyPaste.spec.ts',
    '**/loadWorkflowInMedia.spec.ts'
  ],
  // Very light tests
  veryLight: [
    '**/backgroundImageUpload.spec.ts',
    '**/browserTabTitle.spec.ts',
    '**/changeTracker.spec.ts',
    '**/chatHistory.spec.ts',
    '**/commands.spec.ts',
    '**/customIcons.spec.ts',
    '**/graph.spec.ts',
    '**/keybindings.spec.ts',
    '**/litegraphEvent.spec.ts',
    '**/minimap.spec.ts',
    '**/releaseNotifications.spec.ts',
    '**/remoteWidgets.spec.ts',
    '**/useSettingSearch.spec.ts',
    '**/sidebar/queue.spec.ts',
    '**/nodeHelp.spec.ts',
    '**/extensionAPI.spec.ts',
    '**/bottomPanelShortcuts.spec.ts',
    '**/featureFlags.spec.ts',
    '**/menu.spec.ts',
    '**/subgraph-rename-dialog.spec.ts',
    '**/userSelectView.spec.ts',
    '**/versionMismatchWarnings.spec.ts',
    '**/workflowTabThumbnail.spec.ts',
    '**/actionbar.spec.ts'
  ]
}

// Custom test patterns for each shard (when running with 5 shards)
const shardPatterns: Record<number, string[]> = {
  1: testGroups.heavy, // Shard 1: Only interaction.spec.ts
  2: testGroups.mediumHeavy, // Shard 2: Medium-heavy tests
  3: testGroups.medium, // Shard 3: Medium tests
  4: testGroups.light, // Shard 4: Light tests
  5: testGroups.veryLight // Shard 5: Very light tests
}

// Determine which tests to run based on shard
let testMatch: string[] | undefined
if (
  projectName === 'chromium' &&
  totalShards === 5 &&
  shardPatterns[currentShard]
) {
  testMatch = shardPatterns[currentShard]
}

export default defineConfig({
  ...baseConfig,
  // Override testMatch if we have custom shard patterns
  ...(testMatch && { testMatch }),

  // Increase workers for lighter test shards
  use: {
    ...baseConfig.use,
    // More parallel workers for shards with lighter tests
    ...(currentShard >= 4 &&
      projectName === 'chromium' && {
        workers: process.env.CI ? 4 : 2
      })
  },

  // Optimize retries based on shard content
  retries: process.env.CI ? (currentShard === 1 ? 2 : 3) : 0,

  // Project-specific optimizations
  projects:
    baseConfig.projects?.map((project) => {
      // For non-chromium projects that don't need sharding
      if (
        ['mobile-chrome', 'chromium-0.5x', 'chromium-2x'].includes(
          project.name || ''
        )
      ) {
        return {
          ...project,
          // These projects should only run when not sharding or on first shard
          ...(totalShards > 1 && currentShard > 1 && { testMatch: [] })
        }
      }

      return project
    }) || []
})
