import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import type {
  PullRequestSummary,
  ReleaseSheriffConfig
} from './release-sheriff'
import {
  fetchOnCallEmails,
  planSheriffActions,
  resolveSheriff
} from './release-sheriff'

function warn(message: string) {
  process.stderr.write(`::warning::${message}\n`)
}

function log(message: string) {
  process.stderr.write(`${message}\n`)
}

function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    process.stdout.write(`${name}=${value}\n`)
    return
  }
  appendFileSync(file, `${name}=${value}\n`)
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: '.github/release-sheriff.json' },
      prs: { type: 'string', default: '' }
    }
  })

  const config = JSON.parse(
    readFileSync(values.config, 'utf8')
  ) as ReleaseSheriffConfig
  const prs = values.prs
    ? (JSON.parse(readFileSync(values.prs, 'utf8')) as PullRequestSummary[])
    : []

  const lookup = await fetchOnCallEmails(config, {
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY
  })
  if (lookup.warning) {
    warn(`${lookup.warning} — using the fallback sheriff.`)
  }

  const resolution = resolveSheriff(lookup.emails, config)
  for (const email of resolution.unmappedEmails) {
    warn(
      `Datadog on-call user ${email} has no githubLoginByEmail entry in .github/release-sheriff.json`
    )
  }

  setOutput('sheriff', resolution.login ?? '')
  setOutput('source', resolution.source)

  if (!resolution.login) {
    warn('No release sheriff could be resolved — nothing will be assigned.')
    setOutput('assign', '')
    setOutput('review', '')
    return
  }

  const actions = planSheriffActions(prs, resolution.login)
  log(
    `Release sheriff: ${resolution.login} (source: ${resolution.source}); ${actions.length} of ${prs.length} candidate PR(s) need attention.`
  )
  for (const action of actions) {
    log(
      `  #${action.number} (${action.scope}) assign=${action.assign} requestReview=${action.requestReview}`
    )
  }

  setOutput(
    'assign',
    actions
      .filter((action) => action.assign)
      .map((action) => action.number)
      .join(' ')
  )
  setOutput(
    'review',
    actions
      .filter((action) => action.requestReview)
      .map((action) => action.number)
      .join(' ')
  )
}

await main()
