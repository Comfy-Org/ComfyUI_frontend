import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import type { AshbyJobPosting } from './ashby.schema'
import type { Department, Role, RolesSnapshot } from '../data/roles'

import bundledSnapshot from '../data/ashby-roles.snapshot.json' with { type: 'json' }
import {
  AshbyJobBoardResponseSchema,
  AshbyJobPostingSchema
} from './ashby.schema'

const DEFAULT_BASE_URL = 'https://api.ashbyhq.com'
const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

export interface DroppedRole {
  title: string
  reason: string
}

export type FetchOutcome =
  | {
      status: 'fresh'
      snapshot: RolesSnapshot
      droppedCount: number
      droppedRoles: DroppedRole[]
    }
  | { status: 'stale'; snapshot: RolesSnapshot; reason: string }
  | { status: 'failed'; reason: string }

export interface FetchRolesOptions {
  apiKey?: string
  boardName?: string
  baseUrl?: string
  timeoutMs?: number
  retryDelaysMs?: readonly number[]
  fetchImpl?: typeof fetch
  snapshotUrl?: URL
  sleep?: (ms: number) => Promise<void>
}

let inflight: Promise<FetchOutcome> | undefined

export function resetAshbyFetcherForTests(): void {
  inflight = undefined
}

export function fetchRolesForBuild(
  options: FetchRolesOptions = {}
): Promise<FetchOutcome> {
  inflight ??= doFetchRolesForBuild(options)
  return inflight
}

async function doFetchRolesForBuild(
  options: FetchRolesOptions
): Promise<FetchOutcome> {
  const apiKey = options.apiKey ?? process.env.WEBSITE_ASHBY_API_KEY
  const boardName =
    options.boardName ?? process.env.WEBSITE_ASHBY_JOB_BOARD_NAME

  if (!apiKey || !boardName) {
    return fallback(
      'missing WEBSITE_ASHBY_API_KEY or WEBSITE_ASHBY_JOB_BOARD_NAME',
      options.snapshotUrl
    )
  }

  const result = await tryFetchAndParse(apiKey, boardName, options)
  if (result.kind === 'ok') {
    return {
      status: 'fresh',
      snapshot: {
        fetchedAt: new Date().toISOString(),
        departments: result.departments
      },
      droppedCount: result.droppedRoles.length,
      droppedRoles: result.droppedRoles
    }
  }

  return fallback(result.reason, options.snapshotUrl)
}

async function fallback(
  reason: string,
  snapshotUrl: URL | undefined
): Promise<FetchOutcome> {
  const snapshot = await readSnapshot(snapshotUrl)
  if (snapshot) return { status: 'stale', snapshot, reason }
  return { status: 'failed', reason }
}

interface FetchOk {
  kind: 'ok'
  departments: Department[]
  droppedRoles: DroppedRole[]
}

interface FetchErr {
  kind: 'err'
  reason: string
}

async function tryFetchAndParse(
  apiKey: string,
  boardName: string,
  options: FetchRolesOptions
): Promise<FetchOk | FetchErr> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep

  const url = `${baseUrl}/posting-api/job-board/${encodeURIComponent(
    boardName
  )}?includeCompensation=false`
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`

  let lastReason = 'unknown error'
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1])

    const response = await callOnce(fetchImpl, url, authHeader, timeoutMs)
    if (response.kind === 'err') {
      lastReason = response.reason
      if (!response.retryable) return response
      continue
    }

    const envelope = AshbyJobBoardResponseSchema.safeParse(response.body)
    if (!envelope.success) {
      return {
        kind: 'err',
        reason: `envelope schema validation failed: ${envelope.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')}`
      }
    }

    return parseRoles(envelope.data.jobs)
  }

  return { kind: 'err', reason: lastReason }
}

type CallResponse =
  | { kind: 'ok'; body: unknown }
  | { kind: 'err'; reason: string; retryable: boolean }

async function callOnce(
  fetchImpl: typeof fetch,
  url: string,
  authHeader: string,
  timeoutMs: number
): Promise<CallResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json; version=1'
      },
      signal: controller.signal
    })
    if (res.ok) {
      return { kind: 'ok', body: await res.json() }
    }
    const retryable =
      res.status === 429 || (res.status >= 500 && res.status < 600)
    return {
      kind: 'err',
      reason: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      retryable
    }
  } catch (error) {
    const reason =
      error instanceof Error
        ? `network error: ${error.message}`
        : 'network error'
    return { kind: 'err', reason, retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

function parseRoles(jobs: readonly unknown[]): FetchOk {
  const valid: AshbyJobPosting[] = []
  const droppedRoles: DroppedRole[] = []

  for (const raw of jobs) {
    const parsed = AshbyJobPostingSchema.safeParse(raw)
    if (!parsed.success) {
      droppedRoles.push({
        title: extractTitle(raw),
        reason: parsed.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; ')
      })
      continue
    }
    if (!parsed.data.isListed) continue
    valid.push(parsed.data)
  }

  return { kind: 'ok', departments: groupByDepartment(valid), droppedRoles }
}

function extractTitle(raw: unknown): string {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'title' in raw &&
    typeof (raw as { title: unknown }).title === 'string'
  ) {
    return (raw as { title: string }).title
  }
  return ''
}

const DEFAULT_DEPARTMENT = 'Other'
const DEFAULT_LOCATION = 'Remote'

function groupByDepartment(jobs: readonly AshbyJobPosting[]): Department[] {
  const byKey = new Map<string, Department>()
  for (const job of jobs) {
    const displayDepartment = normalizeDepartment(job.department)
    const name = displayDepartment.toUpperCase()
    const key = slugify(name)
    const existing = byKey.get(key)
    const role = toDomainRole(job, displayDepartment)
    if (existing) {
      existing.roles.push(role)
    } else {
      byKey.set(key, { name, key, roles: [role] })
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function toDomainRole(job: AshbyJobPosting, department: string): Role {
  const applyUrl = job.applyUrl ?? job.jobUrl
  return {
    id: createHash('sha1').update(applyUrl).digest('hex').slice(0, 16),
    title: job.title,
    department: capitalize(department),
    location: (job.location ?? '').trim() || DEFAULT_LOCATION,
    applyUrl
  }
}

function normalizeDepartment(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_DEPARTMENT
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

async function readSnapshot(
  snapshotUrl: URL | undefined
): Promise<RolesSnapshot | null> {
  if (!snapshotUrl) {
    return isRolesSnapshot(bundledSnapshot) ? bundledSnapshot : null
  }
  try {
    const text = await readFile(snapshotUrl, 'utf8')
    const parsed: unknown = JSON.parse(text)
    if (isRolesSnapshot(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function isRolesSnapshot(value: unknown): value is RolesSnapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as { fetchedAt?: unknown; departments?: unknown }
  return (
    typeof candidate.fetchedAt === 'string' &&
    Array.isArray(candidate.departments)
  )
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
