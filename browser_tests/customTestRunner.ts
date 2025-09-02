#!/usr/bin/env node
/**
 * Custom test runner for optimized sharding
 * This script determines which tests to run based on shard configuration
 */
import { spawn } from 'child_process'

import { NO_SHARD_PROJECTS, getShardTests } from './shardConfig'

const projectName = process.env.PLAYWRIGHT_PROJECT || 'chromium'
const shardInfo = process.env.PLAYWRIGHT_SHARD

// Parse shard information from environment variable (format: "current/total")
let shardIndex = 1
let totalShards = 1

if (shardInfo) {
  const [current, total] = shardInfo.split('/').map(Number)
  shardIndex = current
  totalShards = total
}

// Check if this project should skip sharding
if (NO_SHARD_PROJECTS.includes(projectName)) {
  // For projects that don't need sharding, only run on shard 1
  if (shardIndex > 1) {
    console.log(
      `Skipping shard ${shardIndex}/${totalShards} for project ${projectName} (no sharding needed)`
    )
    process.exit(0)
  }
  console.log(`Running all tests for project ${projectName} (no sharding)`)
} else {
  console.log(
    `Running shard ${shardIndex}/${totalShards} for project ${projectName}`
  )
}

// Get the test files for this shard
const shardTests = getShardTests(shardIndex, totalShards, projectName)

// Build the Playwright command
const args = ['playwright', 'test', `--project=${projectName}`]

if (shardTests && shardTests.length > 0) {
  // Add specific test files for this shard
  shardTests.forEach((testFile) => {
    args.push(`browser_tests/tests/${testFile}`)
  })
} else if (shardTests === null) {
  // Run all tests (no custom sharding)
  // Don't add any test file filters
} else {
  // Empty shard - no tests to run
  console.log(`No tests assigned to shard ${shardIndex}/${totalShards}`)
  process.exit(0)
}

// Add CI-specific options if running in CI
if (process.env.CI) {
  args.push('--reporter=github')
}

// Execute Playwright with the constructed arguments
console.log(`Executing: npx ${args.join(' ')}`)
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
