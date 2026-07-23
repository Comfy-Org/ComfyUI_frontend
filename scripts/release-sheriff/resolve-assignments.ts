import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import type {
  PullRequestSummary,
  ReleaseSheriffConfig
} from './release-sheriff'
import {
  parseOnCallEmails,
  planSheriffActions,
  resolveSheriff
} from './release-sheriff'

const ONCALL_TIMEOUT_MS = 15_000

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

async function fetchOnCallEmails(
  config: ReleaseSheriffConfig
): Promise<string[]> {
  const { site, scheduleId } = config.datadog
  const apiKey = process.env.DATADOG_API_KEY
  const appKey = process.env.DATADOG_APP_KEY

  if (!scheduleId) {
    warn(
      'No Datadog On-Call schedule configured in .github/release-sheriff.json — using the fallback sheriff.'
    )
    return []
  }

  if (!apiKey || !appKey) {
    warn(
      'DATADOG_API_KEY / DATADOG_APP_KEY are not available — using the fallback sheriff.'
    )
    return []
  }

  const url = new URL(
    `https://api.${site}/api/v2/on-call/schedules/${scheduleId}/responders`
  )
  url.searchParams.set('include', 'responders.shifts.user')
  url.searchParams.set('filter[position]', 'current')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    },
    signal: AbortSignal.timeout(ONCALL_TIMEOUT_MS)
  })

  if (!response.ok) {
    warn(
      `Datadog On-Call responded ${response.status} ${response.statusText} — using the fallback sheriff.`
    )
    return []
  }

  return parseOnCallEmails(await response.json())
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

  const emails = await fetchOnCallEmails(config).catch((error: unknown) => {
    warn(
      `Datadog On-Call lookup failed (${String(error)}) — using the fallback sheriff.`
    )
    return []
  })

  const resolution = resolveSheriff(emails, config)
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
