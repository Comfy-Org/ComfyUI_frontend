#!/usr/bin/env tsx
import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import type { PullRequestSummary } from './backport-label'
import { planBackportLabels } from './backport-label'

function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${name}=${value}\n`)
    return
  }
  appendFileSync(file, `${name}=${value}\n`)
}

function main() {
  const { values } = parseArgs({
    options: {
      prs: { type: 'string', default: 'prs.json' }
    }
  })

  const prs = JSON.parse(
    readFileSync(values.prs, 'utf8')
  ) as PullRequestSummary[]

  const numbers = planBackportLabels(prs)
  process.stderr.write(
    `${prs.length} candidate PR(s); ${numbers.length} missing the backport label.\n`
  )
  for (const number of numbers) {
    process.stderr.write(`  #${number}\n`)
  }

  setOutput('numbers', numbers.join(' '))
}

main()
