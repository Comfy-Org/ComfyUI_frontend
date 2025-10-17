#!/usr/bin/env node
/**
 * Benchmark script to compare Prettier performance with and without @prettier/plugin-oxc
 *
 * Usage: node scripts/benchmark-prettier.js
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const RUNS = 3
const PRETTIER_RC = '.prettierrc'
const PRETTIER_RC_BACKUP = '.prettierrc.backup'

function runCommand(command) {
  const start = performance.now()
  try {
    execSync(command, { stdio: 'pipe', encoding: 'utf-8' })
  } catch (error) {
    // Prettier exits with code 1 if files need formatting, which is fine for benchmarking
  }
  const end = performance.now()
  return end - start
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function benchmark(name, config) {
  console.log(`\n🔄 Running benchmark: ${name}`)

  // Write config
  fs.writeFileSync(PRETTIER_RC, JSON.stringify(config, null, 2))

  // Warm up
  console.log('  Warming up...')
  runCommand("prettier --check './**/*.{js,ts,tsx,vue,mts}'")

  // Run benchmark
  const times = []
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  Run ${i + 1}/${RUNS}... `)
    const time = runCommand("prettier --check './**/*.{js,ts,tsx,vue,mts}'")
    times.push(time)
    console.log(`${time.toFixed(2)}ms`)
  }

  return {
    times,
    median: median(times),
    average: average(times),
    min: Math.min(...times),
    max: Math.max(...times)
  }
}

async function main() {
  console.log('📊 Prettier Performance Benchmark')
  console.log('='.repeat(60))

  // Read current config
  const currentConfig = JSON.parse(fs.readFileSync(PRETTIER_RC, 'utf-8'))

  // Backup current config
  fs.copyFileSync(PRETTIER_RC, PRETTIER_RC_BACKUP)

  try {
    // Config without oxc plugin
    const configWithoutOxc = {
      ...currentConfig,
      overrides: currentConfig.overrides.map((override) => ({
        ...override,
        options: {
          ...override.options,
          plugins: override.options.plugins.filter(
            (p) => p !== '@prettier/plugin-oxc'
          )
        }
      }))
    }

    // Config with oxc plugin
    const configWithOxc = currentConfig

    // Run benchmarks
    const resultsWithoutOxc = benchmark(
      'Without @prettier/plugin-oxc',
      configWithoutOxc
    )
    const resultsWithOxc = benchmark('With @prettier/plugin-oxc', configWithOxc)

    // Print results
    console.log('\n' + '='.repeat(60))
    console.log('📈 Results Summary')
    console.log('='.repeat(60))

    console.log('\nWithout @prettier/plugin-oxc:')
    console.log(`  Median:  ${resultsWithoutOxc.median.toFixed(2)}ms`)
    console.log(`  Average: ${resultsWithoutOxc.average.toFixed(2)}ms`)
    console.log(`  Min:     ${resultsWithoutOxc.min.toFixed(2)}ms`)
    console.log(`  Max:     ${resultsWithoutOxc.max.toFixed(2)}ms`)

    console.log('\nWith @prettier/plugin-oxc:')
    console.log(`  Median:  ${resultsWithOxc.median.toFixed(2)}ms`)
    console.log(`  Average: ${resultsWithOxc.average.toFixed(2)}ms`)
    console.log(`  Min:     ${resultsWithOxc.min.toFixed(2)}ms`)
    console.log(`  Max:     ${resultsWithOxc.max.toFixed(2)}ms`)

    const improvement =
      ((resultsWithoutOxc.median - resultsWithOxc.median) /
        resultsWithoutOxc.median) *
      100
    const absoluteDiff = resultsWithoutOxc.median - resultsWithOxc.median

    console.log('\n' + '='.repeat(60))
    console.log('🎯 Performance Improvement')
    console.log('='.repeat(60))

    if (improvement > 0) {
      console.log(
        `✅ ${improvement.toFixed(2)}% faster (${absoluteDiff.toFixed(2)}ms saved)`
      )
    } else {
      console.log(
        `⚠️  ${Math.abs(improvement).toFixed(2)}% slower (${Math.abs(absoluteDiff).toFixed(2)}ms overhead)`
      )
    }
  } finally {
    // Restore original config
    fs.copyFileSync(PRETTIER_RC_BACKUP, PRETTIER_RC)
    fs.unlinkSync(PRETTIER_RC_BACKUP)
    console.log('\n✅ Original configuration restored')
  }
}

main().catch(console.error)
