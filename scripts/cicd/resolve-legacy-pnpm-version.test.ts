import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  declaredPnpmVersion,
  readManifest,
  resolveVersionInput
} from './resolve-legacy-pnpm-version.js'

const FALLBACK = '10.33.0'

describe('declaredPnpmVersion', () => {
  it('reads packageManager', () => {
    expect(declaredPnpmVersion({ packageManager: 'pnpm@11.13.1' })).toBe(
      '11.13.1'
    )
  })

  it('strips the integrity hash the corepack spec allows', () => {
    expect(
      declaredPnpmVersion({ packageManager: 'pnpm@11.13.1+sha512.abc123' })
    ).toBe('11.13.1')
  })

  it('prefers devEngines over packageManager, matching pnpm/action-setup', () => {
    expect(
      declaredPnpmVersion({
        packageManager: 'pnpm@11.13.1',
        devEngines: { packageManager: { name: 'pnpm', version: '>=11.3' } }
      })
    ).toBe('>=11.3')
  })

  it('ignores a devEngines package manager that is not pnpm', () => {
    expect(
      declaredPnpmVersion({
        packageManager: 'pnpm@11.13.1',
        devEngines: { packageManager: { name: 'yarn', version: '4.0.0' } }
      })
    ).toBe('11.13.1')
  })

  it('ignores a non-pnpm packageManager', () => {
    expect(
      declaredPnpmVersion({ packageManager: 'yarn@4.0.0' })
    ).toBeUndefined()
  })

  it('returns undefined for a manifest that declares nothing', () => {
    expect(
      declaredPnpmVersion({ name: 'x', version: '1.27.10' })
    ).toBeUndefined()
  })

  it('returns undefined for a missing manifest', () => {
    expect(declaredPnpmVersion(undefined)).toBeUndefined()
  })
})

describe('resolveVersionInput', () => {
  it('supplies the fallback for a tag published before packageManager existed', () => {
    // The shape of v1.27.10's package.json, which is what broke the weekly job.
    expect(
      resolveVersionInput(
        { name: '@comfyorg/comfyui-frontend', version: '1.27.10' },
        FALLBACK
      )
    ).toBe(FALLBACK)
  })

  it('stays out of the way when the manifest pins pnpm itself', () => {
    // A non-empty value here would make the action throw
    // "Multiple versions of pnpm specified" on every current tag.
    expect(
      resolveVersionInput({ packageManager: 'pnpm@11.13.1' }, FALLBACK)
    ).toBe('')
  })

  it('stays out of the way when only devEngines pins pnpm', () => {
    expect(
      resolveVersionInput(
        {
          devEngines: { packageManager: { name: 'pnpm', version: '11.13.1' } }
        },
        FALLBACK
      )
    ).toBe('')
  })

  it('supplies the fallback when the manifest is missing entirely', () => {
    expect(resolveVersionInput(undefined, FALLBACK)).toBe(FALLBACK)
  })
})

describe('readManifest', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'resolve-legacy-pnpm-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('parses an existing manifest', () => {
    const manifestPath = join(dir, 'package.json')
    writeFileSync(
      manifestPath,
      JSON.stringify({ packageManager: 'pnpm@11.13.1' })
    )
    expect(readManifest(manifestPath)).toEqual({
      packageManager: 'pnpm@11.13.1'
    })
  })

  it('returns undefined for a missing manifest, like the action does', () => {
    expect(readManifest(join(dir, 'package.json'))).toBeUndefined()
  })

  it('surfaces malformed JSON instead of silently falling back', () => {
    const manifestPath = join(dir, 'package.json')
    writeFileSync(manifestPath, '{ not json')
    expect(() => readManifest(manifestPath)).toThrow(SyntaxError)
  })

  it('rethrows read errors other than a missing file', () => {
    expect(() => readManifest(dir)).toThrow()
  })
})
