import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runFastLane } from './automation.ts'
import { loadRuntimeConfig, requiredEnv } from './config.ts'
import { createGitHubClient } from './github.ts'

function summary(message: string): void {
  process.stdout.write(`${message}\n`)
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) fs.appendFileSync(summaryPath, `${message}\n`)
}

export async function main(): Promise<void> {
  const config = loadRuntimeConfig()
  const github = createGitHubClient(
    requiredEnv('FAST_LANE_TOKEN'),
    config.repository
  )
  await runFastLane(github, config, summary)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main()
}
