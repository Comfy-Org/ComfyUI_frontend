import fs from 'node:fs'

import { isRecord } from './github.ts'
import { MERGE_METHODS, MERGE_MODES } from './types.ts'
import type { FastLaneConfig, LabelEvent, RuntimeConfig } from './types.ts'

function isOneOf<T extends string>(
  values: readonly T[],
  value: string
): value is T {
  return values.some((candidate) => candidate === value)
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  context: string
): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${context}.${key} must be a non-empty string`)
  }
  return value.trim()
}

function stringArray(
  record: Record<string, unknown>,
  key: string,
  context: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {}
): string[] {
  const value = record[key]
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== 'string' || !item.trim())
  ) {
    throw new Error(`${context}.${key} must be an array of non-empty strings`)
  }
  return value.map((item) => item.trim())
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${context} must be an object`)
  return value
}

export function parseFastLaneConfig(value: unknown): FastLaneConfig {
  const root = record(value, 'fast lane config')
  if (root.schemaVersion !== 1) {
    throw new Error('fast lane config.schemaVersion must be 1')
  }

  const approval = record(root.approval, 'fast lane config.approval')
  const approvalName = (key: string) =>
    requiredString(approval, key, 'fast lane config.approval').toLowerCase()
  const approvalLogins = (key: string) => [
    ...new Set(
      stringArray(approval, key, 'fast lane config.approval', {
        allowEmpty: true
      }).map((login) => login.toLowerCase())
    )
  ]
  const merge = record(root.merge, 'fast lane config.merge')
  const mode = requiredString(merge, 'mode', 'fast lane config.merge')
  const method = requiredString(merge, 'method', 'fast lane config.merge')
  if (!isOneOf(MERGE_MODES, mode)) {
    throw new Error('fast lane config.merge.mode must be automatic or manual')
  }
  if (!isOneOf(MERGE_METHODS, method)) {
    throw new Error(
      'fast lane config.merge.method must be MERGE, REBASE, or SQUASH'
    )
  }
  const pathPrefixes = stringArray(root, 'pathPrefixes', 'fast lane config')
  if (
    pathPrefixes.some(
      (prefix) =>
        !prefix.endsWith('/') ||
        prefix.startsWith('/') ||
        prefix.split('/').includes('..')
    )
  ) {
    throw new Error(
      'fast lane config.pathPrefixes must be relative directory prefixes ending in /'
    )
  }

  return {
    schemaVersion: 1,
    id: requiredString(root, 'id', 'fast lane config'),
    pathPrefixes,
    approval: {
      identity: approvalName('identity'),
      trustedAuthors: approvalLogins('trustedAuthors'),
      approvalLabel: approvalName('approvalLabel'),
      trustedLabelers: approvalLogins('trustedLabelers'),
      holdLabel: approvalName('holdLabel')
    },
    merge: { mode, method }
  }
}

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
  const configPath = requiredEnv('FAST_LANE_CONFIG')
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read ${configPath}: ${String(error)}`, {
      cause: error
    })
  }

  return {
    repository: requiredEnv('GITHUB_REPOSITORY'),
    pullRequestNumber: positiveIntegerEnv('PR_NUMBER'),
    eventHeadSha: requiredEnv('PR_HEAD_SHA'),
    labelEvent: labelEventEnv(),
    defaultBranch: requiredEnv('FAST_LANE_DEFAULT_BRANCH'),
    lane: parseFastLaneConfig(parsed)
  }
}
