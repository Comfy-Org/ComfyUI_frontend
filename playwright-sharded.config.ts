import { defineConfig } from '@playwright/test'

import { getShardPattern } from './browser_tests/shardConfig.generated'
import baseConfig from './playwright.config'

/**
 * Optimized Playwright configuration for CI with balanced sharding
 * Uses pre-calculated shard distribution for even test execution times
 */

// Parse shard information from Playwright CLI
const shardInfo =
  process.env.SHARD ||
  process.argv.find((arg) => arg.includes('--shard='))?.split('=')[1]
const [currentShard, totalShards] = shardInfo
  ? shardInfo.split('/').map(Number)
  : [1, 1]

// Get test patterns for current shard
const testMatch = totalShards === 5 ? getShardPattern(currentShard) : undefined

console.log(`🎯 Shard ${currentShard}/${totalShards} configuration`)
if (testMatch) {
  console.log(`📋 Running tests:`, testMatch)
}

export default defineConfig({
  ...baseConfig,

  // Use optimized test distribution for 5-shard setup
  ...(testMatch && { testMatch }),

  // Optimize parallel execution based on shard content
  fullyParallel: true,
  workers: process.env.CI ? (currentShard === 1 ? 2 : 4) : baseConfig.workers,

  // Adjust timeouts for heavy tests
  timeout: currentShard === 1 ? 20000 : 15000,

  // Optimize retries
  retries: process.env.CI ? (currentShard === 1 ? 2 : 3) : 0
})
