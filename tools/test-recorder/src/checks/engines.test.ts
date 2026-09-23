import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeRange, readEngines, readNvmrc, satisfies } from './engines'

describe('satisfies', () => {
  it('accepts a version inside a bounded range', () => {
    expect(satisfies('v25.9.0', '>=25 <26')).toBe(true)
  })

  it('rejects a version below the lower bound', () => {
    expect(satisfies('v24.15.0', '>=25 <26')).toBe(false)
  })

  it('rejects a version at or above the upper bound', () => {
    expect(satisfies('v26.0.0', '>=25 <26')).toBe(false)
  })

  it('compares minor versions, not just majors', () => {
    expect(satisfies('11.2.0', '>=11.3')).toBe(false)
    expect(satisfies('11.13.1', '>=11.3')).toBe(true)
  })

  it('ignores prerelease suffixes', () => {
    expect(satisfies('v25.0.0-nightly', '>=25 <26')).toBe(true)
  })

  it('defers rather than guessing on ranges it cannot parse', () => {
    expect(satisfies('v24.0.0', '^25.0.0 || ~26')).toBe(true)
  })

  it('defers when the range is empty', () => {
    expect(satisfies('v24.0.0', '')).toBe(true)
    expect(satisfies('v24.0.0', '   ')).toBe(true)
  })
})

describe('describeRange', () => {
  it('renders a bounded major range', () => {
    expect(describeRange('>=25 <26')).toBe('v25.x')
  })

  it('keeps the minor version in an open-ended minimum', () => {
    expect(describeRange('>=11.3')).toBe('v11.3 or newer')
  })

  it('does not claim a whole major when the bound is narrower', () => {
    expect(describeRange('>=25.1 <26')).toBe(
      'v25.1 up to but not including v26'
    )
  })
})

describe('reading the repo requirements', () => {
  let workspace: string

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'engines-'))
  })

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true })
  })

  function writeRepo(pkg: object, nvmrc?: string) {
    writeFileSync(join(workspace, 'package.json'), JSON.stringify(pkg))
    if (nvmrc !== undefined) {
      writeFileSync(join(workspace, '.nvmrc'), nvmrc)
    }
    const nested = join(workspace, 'tools', 'test-recorder')
    mkdirSync(nested, { recursive: true })
    return nested
  }

  it('reads engines from the repo root when run from a nested package', () => {
    const nested = writeRepo({ engines: { node: '>=25 <26' } })
    writeFileSync(
      join(nested, 'package.json'),
      JSON.stringify({ name: '@comfyorg/test-recorder' })
    )
    expect(readEngines(nested).node).toBe('>=25 <26')
  })

  it('walks past a nested package.json that declares its own engines', () => {
    const nested = writeRepo({ engines: { node: '>=25 <26' } })
    writeFileSync(
      join(nested, 'package.json'),
      JSON.stringify({ engines: { node: '>=18' } })
    )
    expect(readEngines(nested).node).toBe('>=18')
  })

  it('survives an unreadable package.json rather than throwing', () => {
    const nested = writeRepo({ engines: { pnpm: '>=11.3' } })
    writeFileSync(join(nested, 'package.json'), '{ not json')
    expect(readEngines(nested).pnpm).toBe('>=11.3')
  })

  it('reads the pinned node version from .nvmrc', () => {
    const nested = writeRepo({ engines: { node: '>=25 <26' } }, '25\n')
    expect(readNvmrc(nested)).toBe('25')
  })

  it('reports no pin when .nvmrc is absent', () => {
    const nested = writeRepo({ engines: { node: '>=25 <26' } })
    expect(readNvmrc(nested)).toBeUndefined()
  })

  it('reports nothing when there is no repo above the starting point', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'orphan-'))
    expect(readEngines(orphan)).toEqual({})
    expect(readNvmrc(orphan)).toBeUndefined()
    rmSync(orphan, { recursive: true, force: true })
  })
})
