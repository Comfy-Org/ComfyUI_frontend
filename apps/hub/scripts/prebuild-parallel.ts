/**
 * Parallel prebuild script - runs independent tasks concurrently.
 *
 * Pipeline:
 *   1. sync + sync:tutorials (parallel - both are independent file reads)
 *   2. generate:ai (depends on sync)
 *   3. generate:previews (can run in parallel with generate:ai)
 */

import { spawn } from 'child_process'

interface TaskResult {
  name: string
  duration: number
  success: boolean
  error?: string
}

async function runTask(
  name: string,
  command: string,
  args: string[]
): Promise<TaskResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    console.log(`[START] ${name}`)

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    })

    proc.on('close', (code) => {
      const duration = Date.now() - startTime
      if (code === 0) {
        console.log(`[DONE] ${name} (${(duration / 1000).toFixed(2)}s)`)
        resolve({ name, duration, success: true })
      } else {
        console.error(`[FAIL] ${name} (exit code: ${code})`)
        resolve({ name, duration, success: false, error: `Exit code: ${code}` })
      }
    })

    proc.on('error', (err) => {
      const duration = Date.now() - startTime
      console.error(`[ERROR] ${name}: ${err.message}`)
      resolve({ name, duration, success: false, error: err.message })
    })
  })
}

async function main(): Promise<void> {
  const totalStart = Date.now()
  console.log('🚀 Parallel Prebuild Pipeline\n')

  // Phase 1: Run sync tasks in parallel (they're independent)
  const skipSync = process.env.HUB_SKIP_SYNC === 'true'

  let phase1Results: TaskResult[] = []
  if (skipSync) {
    console.log('📦 Phase 1: Skipped (HUB_SKIP_SYNC=true)')
  } else {
    console.log('📦 Phase 1: Syncing data sources...')
    phase1Results = await Promise.all([
      runTask('sync-templates', 'pnpm', ['run', 'sync']),
      runTask('sync-tutorials', 'pnpm', ['run', 'sync:tutorials'])
    ])

    const phase1Failed = phase1Results.filter((r) => !r.success)
    if (phase1Failed.length > 0) {
      console.error('\n❌ Phase 1 failed. Stopping pipeline.')
      process.exit(1)
    }
  }

  const skipAI = process.env.SKIP_AI_GENERATION === 'true'

  console.log('\n📦 Phase 2: Generating content...')
  if (skipAI) {
    console.log(
      '   (SKIP_AI_GENERATION=true — skipping AI and preview generation)'
    )
  }
  const phase2Tasks = [
    // Search index always runs — it only reads synced data, no AI needed
    runTask('build-search-index', 'pnpm', ['run', 'build:search-index']),
    ...(skipAI
      ? []
      : [
          runTask('generate-ai', 'pnpm', ['run', 'generate:ai']),
          runTask('generate-previews', 'pnpm', ['run', 'generate:previews'])
        ])
  ]
  const phase2Results = await Promise.all(phase2Tasks)

  const phase2Failed = phase2Results.filter((r) => !r.success)
  if (phase2Failed.length > 0) {
    console.warn('\n⚠️  Phase 2: some tasks failed (non-fatal):')
    for (const f of phase2Failed) {
      console.warn(`   - ${f.name}: ${f.error}`)
    }
  }

  // Summary
  const totalDuration = Date.now() - totalStart
  const allResults = [...phase1Results, ...phase2Results]

  console.log(`\n${phase2Failed.length > 0 ? '⚠️' : '✅'} Prebuild complete!`)
  console.log(`\n📊 Timing breakdown:`)
  for (const result of allResults) {
    const status = result.success ? '✓' : '✗'
    console.log(
      `   ${status} ${result.name}: ${(result.duration / 1000).toFixed(2)}s`
    )
  }
  console.log(`   ─────────────────────────`)
  console.log(`   Total: ${(totalDuration / 1000).toFixed(2)}s`)

  // Compare to sequential estimate
  const sequentialEstimate = allResults.reduce((sum, r) => sum + r.duration, 0)
  const savedTime = sequentialEstimate - totalDuration
  if (savedTime > 1000) {
    console.log(`   Saved ~${(savedTime / 1000).toFixed(1)}s vs sequential`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
