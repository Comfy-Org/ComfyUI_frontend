/**
 * What is allowed to reach a user's machine.
 *
 * The distinction under test is between a conversion that was written and one
 * that was run. Static checks can say a patch is well-formed; only the harness
 * can say it still loads, registers and serialises the same. Shipping the first
 * as though it were the second is the failure this guards against, and it is
 * silent by construction — an unvalidated patch looks exactly like a validated
 * one until a user opens a workflow.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { compileDb } from '../../../../../scripts/magic-patch/compile_db.mjs'
import { RULE_CATALOG_VERSION } from '../conversion/rules'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'magic-patch-db-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** Writes one DB entry plus the sibling diff `compile_db` inlines. */
function entry(name: string, overrides: Record<string, unknown> = {}) {
  const dir = join(root, 'somepack', 'xabc1234')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${name}.diff`),
    '--- a/x.js\n+++ b/x.js\n@@ -1 +1 @@\n-old\n+new\n'
  )
  writeFileSync(
    join(dir, `${name}.json`),
    JSON.stringify({
      pack: 'somepack',
      file: `pack-HEAD/${name}`,
      sourceSha256: `sha-${name}`,
      apiMajor: 1,
      ruleCatalogVersion: RULE_CATALOG_VERSION,
      diff: `${name}.diff`,
      ...overrides
    })
  )
}

const compile = (options?: { allowUnvalidated: boolean }) =>
  compileDb(root, options) as {
    artifact: { patches: Record<string, { validation: string }> }
    problems: string[]
    stats: { skipped: number; unvalidated: number }
  }

describe('what may ship', () => {
  it('refuses a patch that was never executed', () => {
    entry('never-run.js', { validation: 'none' })
    const { artifact, stats } = compile()

    expect(Object.keys(artifact.patches)).toEqual([])
    expect(stats.skipped).toBe(1)
  })

  it('refuses a patch carrying no verdict at all', () => {
    // Absent evidence is not weak evidence. An entry written before validation
    // existed has never been run, so it must be treated as `none` rather than
    // waved through for lacking the field that would have condemned it.
    entry('no-field.js')
    const { artifact, problems } = compile()

    expect(Object.keys(artifact.patches)).toEqual([])
    expect(problems[0]).toContain('never executed')
  })

  it('ships a patch the harness ran', () => {
    entry('verified.js', { validation: 'harness' })
    const { artifact, stats } = compile()

    expect(Object.keys(artifact.patches)).toEqual(['sha-verified.js'])
    expect(stats.unvalidated).toBe(0)
  })

  it('records the tier in the artifact', () => {
    // The client marks patched nodes in the UI, and a badge that cannot tell
    // the two tiers apart would claim validation the patch never had.
    entry('by-hand.js', { validation: 'manual' })
    const { artifact } = compile()

    expect(artifact.patches['sha-by-hand.js'].validation).toBe('manual')
  })

  it('ships unvalidated patches only when explicitly told to, and counts them', () => {
    entry('never-run.js', { validation: 'none' })
    const { artifact, stats } = compile({ allowUnvalidated: true })

    expect(Object.keys(artifact.patches)).toEqual(['sha-never-run.js'])
    expect(stats.unvalidated).toBe(1)
  })

  it('still refuses a wire-format change even when validated', () => {
    entry('wire.js', {
      validation: 'harness',
      verified: { wireIdentical: false }
    })
    const { artifact, problems } = compile()

    expect(Object.keys(artifact.patches)).toEqual([])
    expect(problems[0]).toContain('wire format changed')
  })
})
