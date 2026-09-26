import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AshbyJobPosting } from './ashby.schema'
import type { Department, RolesSnapshot } from '../data/roles'

import {
  applyRoleDepartmentOverrides,
  fetchRolesForBuild,
  resetAshbyFetcherForTests
} from './ashby'

const BASE_URL = 'https://ashby.test'
const BOARD = 'comfy-org'
const KEY = 'abc-123-secret'

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
    jobUrl: `https://jobs.ashbyhq.com/comfy-org/snapshot-${i}`
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
  return pathToFileURL(file)
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
    process.env.WEBSITE_ASHBY_API_KEY = savedApiKey
    process.env.WEBSITE_ASHBY_JOB_BOARD_NAME = savedBoardName
  })

  it('returns fresh when the API succeeds', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(0)
    expect(outcome.snapshot.departments).toHaveLength(1)
    expect(outcome.snapshot.departments[0].roles[0].jobUrl).toBe(
      'https://jobs.ashbyhq.com/comfy-org/design-engineer'
    )
  })

  it('drops invalid roles individually and keeps the valid ones', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () =>
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
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(1)
    expect(outcome.droppedRoles[0].title).toBe('Bad Role')
    expect(outcome.snapshot.departments[0].roles).toHaveLength(1)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('renders an empty-but-fresh outcome when hiring is paused', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({ apiVersion: '1', jobs: [] }))
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.departments).toEqual([])
    expect(outcome.droppedCount).toBe(0)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('normalizes missing department and location to safe defaults', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const job = validJob()
    delete (job as Record<string, unknown>).department
    delete (job as Record<string, unknown>).location
    const fetchImpl = vi.fn(async () =>
      response({ apiVersion: '1', jobs: [job] })
    )
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    const [department] = outcome.snapshot.departments
    expect(department.name).toBe('OTHER')
    expect(department.roles[0]?.location).toBe('Remote')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('filters out roles with isListed=false', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () =>
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
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    const titles = outcome.snapshot.departments.flatMap((d) =>
      d.roles.map((r) => r.title)
    )
    expect(titles).not.toContain('Hidden')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('returns stale with missing env when the snapshot is present', async () => {
    const snapshot = makeSnapshot()
    const snapshotUrl = withSnapshotDir(snapshot)
    const fetchImpl = vi.fn()
    const outcome = await fetchRolesForBuild({
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^missing /)
    expect(fetchImpl).not.toHaveBeenCalled()
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('returns failed when both env and snapshot are missing', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const outcome = await fetchRolesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('failed')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('does not retry on HTTP 401', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({}, { status: 401 }))
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 401/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('retries 5xx up to the configured limit then falls back to snapshot', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({}, { status: 503 }))
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1, 1],
      sleep,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledTimes(3)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('falls back to snapshot on envelope schema mismatch', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({ apiVersion: '2', jobs: [] }))
    const outcome = await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^envelope schema/)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('memoizes within a single process', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    const opts = {
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as unknown as typeof fetch
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
    const fetchImpl = vi.fn(async () =>
      response({ apiVersion: '1', jobs: [validJob()] })
    )
    await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    const after = fs.readFileSync(before).toString()
    expect(after).toBe(initial)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('does not retry on 4xx auth failures for 403', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({}, { status: 403 }))
    await fetchRolesForBuild({
      apiKey: KEY,
      boardName: BOARD,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })
})

function department(name: string, roles: Department['roles']): Department {
  return { name, key: name.toLowerCase(), roles }
}

describe('applyRoleDepartmentOverrides', () => {
  const overriddenTitle = 'Sr./Staff Product Designer, Developer Platform'

  it('moves an overridden role out of its Ashby department into the target one', () => {
    const departments = [
      department('ENGINEERING', [
        {
          id: 'role-1',
          title: overriddenTitle,
          department: 'Engineering',
          location: 'San Francisco',
          jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-1'
        },
        {
          id: 'role-2',
          title: 'Member of Technical Staff, Frontend',
          department: 'Engineering',
          location: 'San Francisco',
          jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-2'
        }
      ])
    ]

    const result = applyRoleDepartmentOverrides(departments)

    const engineering = result.find((d) => d.key === 'engineering')
    const design = result.find((d) => d.key === 'design')
    expect(engineering?.roles.map((r) => r.title)).toEqual([
      'Member of Technical Staff, Frontend'
    ])
    expect(design?.name).toBe('DESIGN')
    expect(design?.roles).toEqual([
      {
        id: 'role-1',
        title: overriddenTitle,
        department: 'Design',
        location: 'San Francisco',
        jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-1'
      }
    ])
    expect(departments[0].roles[0].department).toBe('Engineering')
  })

  it('merges into an existing target department rather than duplicating it', () => {
    const departments = [
      department('ENGINEERING', [
        {
          id: 'role-1',
          title: overriddenTitle,
          department: 'Engineering',
          location: 'San Francisco',
          jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-1'
        }
      ]),
      department('DESIGN', [
        {
          id: 'role-3',
          title: 'Senior Product Designer',
          department: 'Design',
          location: 'San Francisco',
          jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-3'
        }
      ])
    ]

    const result = applyRoleDepartmentOverrides(departments)

    expect(result.filter((d) => d.key === 'design')).toHaveLength(1)
    const design = result.find((d) => d.key === 'design')
    expect(design?.roles.map((r) => r.title).sort()).toEqual(
      ['Senior Product Designer', overriddenTitle].sort()
    )
  })

  it('is a no-op for roles with no override', () => {
    const departments = [
      department('SALES', [
        {
          id: 'role-4',
          title: `${overriddenTitle} (Remote)`,
          department: 'Sales',
          location: 'San Francisco',
          jobUrl: 'https://jobs.ashbyhq.com/comfy-org/role-4'
        }
      ])
    ]

    expect(applyRoleDepartmentOverrides(departments)).toEqual(departments)
  })
})
