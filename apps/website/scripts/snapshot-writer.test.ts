import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readSnapshot, writeSnapshotIfChanged } from './snapshot-writer'

let dir: string
let snapshotPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'snapshot-writer-'))
  snapshotPath = join(dir, 'snapshot.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function rolesSnapshot(fetchedAt: string, title = 'Sr. Growth Engineer') {
  return {
    fetchedAt,
    departments: [
      {
        name: 'DESIGN',
        key: 'design',
        roles: [
          {
            id: 'abc',
            title,
            department: 'Design',
            location: 'San Francisco',
            jobUrl: 'https://jobs.ashbyhq.com/comfy-org/abc'
          }
        ]
      }
    ]
  }
}

function cloudNodesSnapshot(fetchedAt: string, displayName = 'Basic data') {
  return {
    fetchedAt,
    packs: [{ id: 'basic', displayName, nodes: ['LoadImage'] }]
  }
}

function packsWithCounters(
  fetchedAt: string,
  downloads: number,
  displayName = 'Basic data'
) {
  return {
    fetchedAt,
    packs: [
      { id: 'basic', displayName, downloads, githubStars: 12, nodes: ['Load'] }
    ]
  }
}

const COUNTERS = ['downloads', 'githubStars'] as const

function seed(snapshot: { fetchedAt: string }) {
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  return readFileSync(snapshotPath, 'utf8')
}

describe('writeSnapshotIfChanged', () => {
  it.for([
    ['roles', rolesSnapshot],
    ['cloud nodes', cloudNodesSnapshot]
  ] as const)(
    'leaves a %s snapshot byte-identical when only fetchedAt moved',
    ([, build]) => {
      const before = seed(build('2026-08-22T04:58:20.183Z'))

      const wrote = writeSnapshotIfChanged(
        snapshotPath,
        build('2026-09-25T12:00:00.000Z')
      )

      expect(wrote).toBe(false)
      expect(readFileSync(snapshotPath, 'utf8')).toBe(before)
    }
  )

  it.for([
    ['roles', rolesSnapshot, 'Freelance Graphic Designer'],
    ['cloud nodes', cloudNodesSnapshot, 'Renamed pack']
  ] as const)(
    'writes a %s snapshot when the payload changed',
    ([, build, next]) => {
      seed(build('2026-08-22T04:58:20.183Z'))

      const wrote = writeSnapshotIfChanged(
        snapshotPath,
        build('2026-09-25T12:00:00.000Z', next)
      )

      expect(wrote).toBe(true)
      const written: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
      expect(written).toEqual(build('2026-09-25T12:00:00.000Z', next))
    }
  )

  it('writes when no snapshot exists yet', () => {
    const wrote = writeSnapshotIfChanged(
      snapshotPath,
      rolesSnapshot('2026-09-25T12:00:00.000Z')
    )

    expect(wrote).toBe(true)
    expect(readFileSync(snapshotPath, 'utf8')).toContain('Sr. Growth Engineer')
  })

  it.for([
    ['malformed JSON', '{ not json'],
    ['a JSON array', '[]'],
    ['a JSON scalar', '"snapshot"']
  ] as const)('replaces an existing file containing %s', ([, contents]) => {
    writeFileSync(snapshotPath, contents, 'utf8')

    const wrote = writeSnapshotIfChanged(
      snapshotPath,
      rolesSnapshot('2026-09-25T12:00:00.000Z')
    )

    expect(wrote).toBe(true)
    expect(readFileSync(snapshotPath, 'utf8')).toContain('Sr. Growth Engineer')
  })

  it('writes a trailing newline and two-space indentation', () => {
    writeSnapshotIfChanged(
      snapshotPath,
      rolesSnapshot('2026-09-25T12:00:00.000Z')
    )

    const contents = readFileSync(snapshotPath, 'utf8')
    expect(contents.endsWith('}\n')).toBe(true)
    expect(contents).toContain('\n  "fetchedAt"')
  })

  it('leaves no temporary file behind', () => {
    writeSnapshotIfChanged(
      snapshotPath,
      rolesSnapshot('2026-09-25T12:00:00.000Z')
    )

    expect(() => readFileSync(`${snapshotPath}.tmp`, 'utf8')).toThrow()
  })

  it('ignores a nested counter that drifted on its own', () => {
    const before = seed(
      packsWithCounters('2026-08-22T04:58:20.183Z', 2_870_000)
    )

    const wrote = writeSnapshotIfChanged(
      snapshotPath,
      packsWithCounters('2026-09-25T12:00:00.000Z', 2_871_433),
      COUNTERS
    )

    expect(wrote).toBe(false)
    expect(readFileSync(snapshotPath, 'utf8')).toBe(before)
  })

  it('still writes when a counter moves alongside a real change', () => {
    seed(packsWithCounters('2026-08-22T04:58:20.183Z', 2_870_000))

    const wrote = writeSnapshotIfChanged(
      snapshotPath,
      packsWithCounters('2026-09-25T12:00:00.000Z', 2_871_433, 'Renamed pack'),
      COUNTERS
    )

    expect(wrote).toBe(true)
    const written: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
    expect(written).toMatchObject({
      packs: [{ displayName: 'Renamed pack', downloads: 2_871_433 }]
    })
  })

  it('treats a counter as substantive when it is not declared volatile', () => {
    seed(packsWithCounters('2026-08-22T04:58:20.183Z', 2_870_000))

    const wrote = writeSnapshotIfChanged(
      snapshotPath,
      packsWithCounters('2026-09-25T12:00:00.000Z', 2_871_433)
    )

    expect(wrote).toBe(true)
  })

  it('detects a role removal, not just a rename', () => {
    seed(rolesSnapshot('2026-08-22T04:58:20.183Z'))
    const emptied = { fetchedAt: '2026-09-25T12:00:00.000Z', departments: [] }

    const wrote = writeSnapshotIfChanged(snapshotPath, emptied)

    expect(wrote).toBe(true)
    expect(JSON.parse(readFileSync(snapshotPath, 'utf8'))).toEqual(emptied)
  })
})

describe('readSnapshot', () => {
  it('returns the snapshot the refresh scripts compare against', () => {
    const snapshot = rolesSnapshot('2026-08-22T04:58:20.183Z')
    seed(snapshot)

    expect(readSnapshot(snapshotPath)).toEqual(snapshot)
  })

  it('returns null for a missing file, so a first run can write', () => {
    expect(readSnapshot(snapshotPath)).toBeNull()
  })

  // Both refresh scripts read null as "no baseline" and skip their loss
  // guards. Answering null for a file that exists but is unreadable would
  // therefore disarm the guards exactly when the data is least trustworthy.
  it.for([
    ['malformed JSON', '{ not json'],
    ['a JSON array', '[]'],
    ['a JSON scalar', '"snapshot"']
  ] as const)('throws rather than returning null for %s', ([, contents]) => {
    writeFileSync(snapshotPath, contents, 'utf8')

    expect(() => readSnapshot(snapshotPath)).toThrow(snapshotPath)
  })
})
