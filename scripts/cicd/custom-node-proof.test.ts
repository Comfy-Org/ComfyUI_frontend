import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertNoCommittedSourceTierSwitch,
  mutateExecutionSource,
  proofIdentity
} from './custom-node-proof'

// The guard greps `src/` only, so this literal is inert here in `scripts/`.
const SOURCE_TIER_SWITCH = '__COMFY_CUSTOM_NODE_DETECTION_PROOF_TIER__'

/**
 * Runs `fn` against a fresh temporary directory and removes it afterwards.
 * The directory is scoped to the caller rather than registered in a
 * module-level list, so no state is shared between test cases.
 */
function withTempDir(prefix: string, fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), prefix))
  try {
    fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/**
 * Runs `fn` against a throwaway git repo with one tracked `src/` file.
 * `git grep` searches tracked files, so the file is staged but never
 * committed.
 */
function withSourceFixture(contents: string, fn: (root: string) => void): void {
  withTempDir('proof-switch-', (root) => {
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'node.ts'), contents)
    spawnSync('git', ['init', '-q'], { cwd: root })
    spawnSync('git', ['add', 'src/node.ts'], { cwd: root })
    fn(root)
  })
}

describe('custom-node detection proof', () => {
  it('keeps the detection proof switch out of committed source', () => {
    expect(() => assertNoCommittedSourceTierSwitch()).not.toThrow()
  })

  it('accepts a working tree whose src/ is free of the switch', () => {
    withSourceFixture('export const value = 1\n', (root) => {
      expect(() => assertNoCommittedSourceTierSwitch(root)).not.toThrow()
    })
  })

  it('rejects a committed source-tier switch', () => {
    withSourceFixture(
      `export const tier = globalThis.${SOURCE_TIER_SWITCH}\n`,
      (root) => {
        expect(() => assertNoCommittedSourceTierSwitch(root)).toThrow(
          /detection proof switch leaked into src\//
        )
      }
    )
  })

  it('rejects a working tree it cannot inspect', () => {
    withTempDir('proof-switch-nogit-', (root) => {
      expect(() => assertNoCommittedSourceTierSwitch(root)).toThrow(
        /could not inspect src\//
      )
    })
  })

  it('mutates only the calibrated S9 witness method', () => {
    const source = `class LoadAudioUpload:
    def load_audio(self, start_time=0, duration=0, **kwargs):
        return kwargs

NODE_CLASS_MAPPINGS = {"VHS_LoadAudioUpload": LoadAudioUpload}
`
    const mutated = mutateExecutionSource(source)
    expect(mutated).toContain('DETECTION PROOF (row 9)')
    expect(() => mutateExecutionSource(mutated)).toThrow(/could not apply/)
  })

  it('binds the mutation and expected tier failure', () => {
    expect(
      proofIdentity({
        row: '2',
        sha: 'b'.repeat(40),
        mutationPath: 'row-02.patch',
        mutationDigest: 'a'.repeat(64)
      })
    ).toContain(
      'test_identity=S2: every enrolled registered node mounts on the DOM renderer'
    )
    expect(() =>
      proofIdentity({
        row: '2',
        sha: 'b'.repeat(40),
        mutationPath: '',
        mutationDigest: 'a'.repeat(64)
      })
    ).toThrow(/path/)
    expect(() =>
      proofIdentity({
        row: '2',
        sha: 'b'.repeat(40),
        mutationPath: 'row-02.patch',
        mutationDigest: 'bad'
      })
    ).toThrow(/digest/)
  })
})
