import { lanes } from './lanes.ts'
import type { LabelEvent, RuntimeConfig } from './types.ts'

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function positiveIntegerEnv(name: string): number {
  const parsed = Number(requiredEnv(name))
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function labelEventEnv(): LabelEvent | undefined {
  const actor = process.env.FAST_LANE_EVENT_ACTOR?.trim()
  const label = process.env.FAST_LANE_EVENT_LABEL?.trim()
  if (
    process.env.GITHUB_EVENT_NAME !== 'pull_request_target' ||
    process.env.FAST_LANE_EVENT_ACTION !== 'labeled' ||
    !actor ||
    !label
  ) {
    return
  }
  return { actor: actor.toLowerCase(), label: label.toLowerCase() }
}

export function loadRuntimeConfig(): RuntimeConfig {
  const laneId = requiredEnv('FAST_LANE')
  const lane = lanes.find((candidate) => candidate.id === laneId)
  if (!lane) throw new Error(`FAST_LANE ${laneId} is not a configured lane`)

  return {
    repository: requiredEnv('GITHUB_REPOSITORY'),
    pullRequestNumber: positiveIntegerEnv('PR_NUMBER'),
    eventHeadSha: requiredEnv('PR_HEAD_SHA'),
    labelEvent: labelEventEnv(),
    defaultBranch: requiredEnv('FAST_LANE_DEFAULT_BRANCH'),
    lane
  }
}
