import fs from 'node:fs'

import type { FastLaneConfig, RuntimeConfig } from './types.ts'

const MERGE_METHODS = new Set(['MERGE', 'REBASE', 'SQUASH'])
const MERGE_MODES = new Set(['automatic', 'manual'])

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
  return [...new Set(value.map((item) => item.trim()))]
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value as Record<string, unknown>
}

function normalizeLogins(logins: string[]): string[] {
  return [...new Set(logins.map((login) => login.toLowerCase()))]
}

export function parseFastLaneConfig(value: unknown): FastLaneConfig {
  const root = record(value, 'fast lane config')
  if (root.schemaVersion !== 1) {
    throw new Error('fast lane config.schemaVersion must be 1')
  }

  const approval = record(root.approval, 'fast lane config.approval')
  const merge = record(root.merge, 'fast lane config.merge')
  const mode = requiredString(merge, 'mode', 'fast lane config.merge')
  const method = requiredString(merge, 'method', 'fast lane config.merge')
  if (!MERGE_MODES.has(mode)) {
    throw new Error('fast lane config.merge.mode must be automatic or manual')
  }
  if (!MERGE_METHODS.has(method)) {
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
      identity: requiredString(
        approval,
        'identity',
        'fast lane config.approval'
      ).toLowerCase(),
      trustedAuthors: normalizeLogins(
        stringArray(approval, 'trustedAuthors', 'fast lane config.approval', {
          allowEmpty: true
        })
      ),
      approvalLabel: requiredString(
        approval,
        'approvalLabel',
        'fast lane config.approval'
      ).toLowerCase(),
      trustedLabelers: normalizeLogins(
        stringArray(approval, 'trustedLabelers', 'fast lane config.approval', {
          allowEmpty: true
        })
      ),
      holdLabel: requiredString(
        approval,
        'holdLabel',
        'fast lane config.approval'
      ).toLowerCase()
    },
    merge: {
      mode: mode as FastLaneConfig['merge']['mode'],
      method: method as FastLaneConfig['merge']['method']
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

function optionalPositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name]?.trim()
  if (!value) return
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
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
    token: requiredEnv('FAST_LANE_TOKEN'),
    repository: requiredEnv('GITHUB_REPOSITORY'),
    pullRequestNumber: optionalPositiveIntegerEnv('PR_NUMBER'),
    eventHeadSha: requiredEnv('PR_HEAD_SHA'),
    eventName: requiredEnv('GITHUB_EVENT_NAME'),
    eventAction: optionalEnv('FAST_LANE_EVENT_ACTION'),
    eventActor: optionalEnv('FAST_LANE_EVENT_ACTOR'),
    eventLabel: optionalEnv('FAST_LANE_EVENT_LABEL'),
    defaultBranch: requiredEnv('FAST_LANE_BASE_REF'),
    lane: parseFastLaneConfig(parsed)
  }
}
