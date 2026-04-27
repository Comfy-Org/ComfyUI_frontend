import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AshbyJobPosting } from './ashby.schema'
import type { RolesSnapshot } from '../data/roles'

import { fetchRolesForBuild, resetAshbyFetcherForTests } from './ashby'

const BASE_URL = 'https://ashby.test'
const BOARD = 'comfy-org'
const KEY = 'abc-123-secret'

const tempDirs = new Set<URL>()

function validJob(overrides: Partial<AshbyJobPosting> = {}): unknown {
  return {
    title: 'Design Engineer',
    department: 'Engineering',
    location: 'San Francisco',
    isListed: true,
    jobUrl: 'https://jobs.ashbyhq.com/comfy-org/design-engineer',
    applyUrl: 'https://jobs.ashbyhq.com/comfy-org/design-engineer/apply',
    ...overrides
  }
}

function response(body: unknown, init: Partial<ResponseInit> = {}): Response {
  const base: ResponseInit = {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }
  return new Response(JSON.stringify(body), { ...base, ...init })
}

function makeSnapshot(roleCount = 2): RolesSnapshot {
  const roles = Array.from({ length: roleCount }, (_, i) => ({
    id: `snapshot-role-${i}`,
    title: `Snapshot Role ${i}`,
    department: 'Engineering',
    location: 'San Francisco',
    applyUrl: `https://jobs.ashbyhq.com/comfy-org/snapshot-${i}`
  }))
  return {
    fetchedAt: '2026-04-01T00:00:00.000Z',
    departments: [{ name: 'ENGINEERING', key: 'engineering', roles }]
  }
}

function withSnapshotDir(snapshot: RolesSnapshot | null): URL {
  const dir = mkdtempSync(join(tmpdir(), 'ashby-test-'))
  const file = join(dir, 'ashby-roles.snapshot.json')
  if (snapshot) writeFileSync(file, JSON.stringify(snapshot))
  const url = pathToFileURL(file)
  tempDirs.add(url)
  return url
}

function mockFetch(
  impl: (...args: Parameters<typeof fetch>) => Promise<Response>
): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch
}

describe('fetchRolesForBuild', () => {
  const savedApiKey = process.env.WEBSITE_ASHBY_API_KEY
  const savedBoardName = process.env.WEBSITE_ASHBY_JOB_BOARD_NAME

  beforeEach(() => {
    resetAshbyFetcherForTests()
    delete process.env.WEBSITE_ASHBY_API_KEY
    delete process.env.WEBSITE_ASHBY_JOB_BOARD_NAME
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.WEBSITE_ASHBY_API_KEY = savedApiKey
    process.env.WEBSITE_ASHBY_JOB_BOARD_NAME = savedBoardName
    for (const url of tempDirs) {
      rmSync(new URL('.', url), { recursive: true, force: true })
    }
    tempDirs.clear()
  })

  it('returns fresh when the API succeeds', async () => {
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(0)
    expect(outcome.snapshot.departments).toHaveLength(1)
    expect(outcome.snapshot.departments[0]!.roles[0]!.applyUrl).toMatch(
      /design-engineer\/apply$/
    )
  })

  it('title-cases multi-word department names on the role', async () => {
    const fetchImpl = mockFetch(async () =>
      response({
        apiVersion: '1',
        jobs: [validJob({ department: 'Product Engineering' })]
      })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.departments[0]!.roles[0]!.department).toBe(
      'Product Engineering'
    )
  })

  it('falls back to jobUrl when applyUrl is missing and keeps the role', async () => {
    const job = validJob()
    delete (job as Record<string, unknown>).applyUrl
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [job] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.departments[0]!.roles[0]!.applyUrl).toBe(
      'https://jobs.ashbyhq.com/comfy-org/design-engineer'
    )
  })

  it('drops invalid roles individually and keeps the valid ones', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () =>
      response({
        apiVersion: '1',
        jobs: [validJob(), validJob({ title: 'Bad Role', jobUrl: 'not-a-url' })]
      })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(1)
    expect(outcome.droppedRoles[0]!.title).toBe('Bad Role')
    expect(outcome.snapshot.departments[0]!.roles).toHaveLength(1)
  })

  it('renders an empty-but-fresh outcome when hiring is paused', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.departments).toEqual([])
    expect(outcome.droppedCount).toBe(0)
  })

  it('normalizes missing department and location to safe defaults', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const job = validJob()
    delete (job as Record<string, unknown>).department
    delete (job as Record<string, unknown>).location
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [job] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    const [department] = outcome.snapshot.departments
    expect(department?.name).toBe('OTHER')
    expect(department?.roles[0]?.location).toBe('Remote')
  })

  it('filters out roles with isListed=false', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () =>
      response({
        apiVersion: '1',
        jobs: [validJob(), validJob({ title: 'Hidden', isListed: false })]
      })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    const titles = outcome.snapshot.departments.flatMap((d) =>
      d.roles.map((r) => r.title)
    )
    expect(titles).not.toContain('Hidden')
  })

  it('returns stale with missing env when the snapshot is present', async () => {
    const snapshot = makeSnapshot()
    const snapshotUrl = withSnapshotDir(snapshot)
    const fetchImpl = mockFetch(async () => response({}))
    const outcome = await fetchRolesForBuild({
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^missing /)
    expect(outcome.reasonCode).toBe('missing-env')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns failed when both env and snapshot are missing', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const outcome = await fetchRolesForBuild({
      snapshotUrl,
      fetchImpl: mockFetch(async () => response({}))
    })
    expect(outcome.status).toBe('failed')
    if (outcome.status !== 'failed') return
    expect(outcome.reasonCode).toBe('missing-env')
  })

  it('does not retry on HTTP 401', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () => response({}, { status: 401 }))
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 401/)
    expect(outcome.reasonCode).toBe('auth')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries 5xx up to the configured limit then falls back to snapshot', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () => response({}, { status: 503 }))
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1, 1],
      sleep,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reasonCode).toBe('network')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('falls back to snapshot on envelope schema mismatch', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '2', jobs: [] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^envelope schema/)
    expect(outcome.reasonCode).toBe('schema')
  })

  it('memoizes within a single process', async () => {
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    const opts = {
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl
    }
    const [a, b] = await Promise.all([
      fetchRolesForBuild(opts),
      fetchRolesForBuild(opts)
    ])
    expect(a).toBe(b)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('never writes to the snapshot file on success', async () => {
    const snapshot = makeSnapshot()
    const snapshotUrl = withSnapshotDir(snapshot)
    const before = new URL(snapshotUrl.href)
    const fs = await import('node:fs')
    const initial = fs.readFileSync(before).toString()
    const fetchImpl = mockFetch(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    const after = fs.readFileSync(before).toString()
    expect(after).toBe(initial)
  })

  it('does not retry on 4xx auth failures for 403', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () => response({}, { status: 403 }))
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 403/)
    expect(outcome.reasonCode).toBe('auth')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries on network errors and falls back to snapshot', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = mockFetch(async () => {
      throw new Error('fetch failed')
    })
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1],
      sleep,
      fetchImpl
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^network error:/)
    expect(outcome.reasonCode).toBe('network')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('groups jobs by department and sorts alphabetically', async () => {
    const fetchImpl = mockFetch(async () =>
      response({
        apiVersion: '1',
        jobs: [
          validJob({ title: 'Role Z', department: 'Zzz Dept' }),
          validJob({ title: 'Role A', department: 'Aaa Dept' }),
          validJob({ title: 'Role A2', department: 'Aaa Dept' })
        ]
      })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.departments).toHaveLength(2)
    expect(outcome.snapshot.departments[0]!.name).toBe('AAA DEPT')
    expect(outcome.snapshot.departments[0]!.roles).toHaveLength(2)
    expect(outcome.snapshot.departments[1]!.name).toBe('ZZZ DEPT')
    expect(outcome.snapshot.departments[1]!.roles).toHaveLength(1)
  })
})
