import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  applySourcePatch,
  assertNoCommittedSourceTierSwitch,
  hasSourceChanges,
  mutateExecutionSource,
  proofIdentity
} from './custom-node-proof'

// The guard greps `src/` only, so this literal is inert here in `scripts/`.
const SOURCE_TIER_SWITCH = '__COMFY_CUSTOM_NODE_DETECTION_PROOF_TIER__'
const BASE_PATCH_SOURCE = `${Array.from(
  { length: 14 },
  (_, index) => `export const value${index + 1} = ${index + 1}`
).join('\n')}
export const target = 1
export const last = 1
`

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

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

function withPatchFixture(
  currentContents: string,
  fn: (root: string, patchPath: string) => void
): void {
  withTempDir('proof-patch-', (root) => {
    mkdirSync(join(root, 'src'))
    const sourcePath = join(root, 'src', 'node.ts')
    writeFileSync(sourcePath, BASE_PATCH_SOURCE)
    git(root, ['init', '-q'])
    git(root, ['add', 'src/node.ts'])
    git(root, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'base'
    ])
    writeFileSync(
      sourcePath,
      BASE_PATCH_SOURCE.replace('target = 1', 'target = 2')
    )
    const patchPath = join(root, 'proof.patch')
    writeFileSync(patchPath, git(root, ['diff', '--full-index', '--binary']))
    git(root, ['reset', '--hard', '-q', 'HEAD'])
    writeFileSync(sourcePath, currentContents)
    git(root, ['add', 'src/node.ts'])
    git(root, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'current'
    ])
    fn(root, patchPath)
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

  it('detects a source mutation applied through a 3-way merge', () => {
    withPatchFixture(
      BASE_PATCH_SOURCE.replace('value12 = 12', 'value12 = 120'),
      (root, patchPath) => {
        expect(
          spawnSync('git', ['apply', '--check', patchPath], { cwd: root })
            .status
        ).not.toBe(0)
        applySourcePatch(patchPath, root)
        expect(readFileSync(join(root, 'src', 'node.ts'), 'utf8')).toContain(
          'target = 2'
        )
        expect(hasSourceChanges(root)).toBe(true)
      }
    )
  })

  it('rejects a conflicting 3-way patch', () => {
    withPatchFixture(
      BASE_PATCH_SOURCE.replace('target = 1', 'target = 3'),
      (root, patchPath) => {
        expect(() => applySourcePatch(patchPath, root)).toThrow(
          /git apply --3way/
        )
      }
    )
  })

  it('rejects a dirty source baseline before applying a non-source patch', () => {
    withTempDir('proof-dirty-source-', (root) => {
      mkdirSync(join(root, 'src'))
      writeFileSync(join(root, 'src', 'node.ts'), 'export const value = 1\n')
      writeFileSync(join(root, 'README.md'), 'before\n')
      git(root, ['init', '-q'])
      git(root, ['add', 'src/node.ts', 'README.md'])
      git(root, [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '-qm',
        'base'
      ])
      writeFileSync(join(root, 'README.md'), 'after\n')
      const patchPath = join(root, 'proof.patch')
      writeFileSync(patchPath, git(root, ['diff', '--full-index', '--binary']))
      git(root, ['reset', '--hard', '-q', 'HEAD'])
      writeFileSync(join(root, 'src', 'node.ts'), 'export const value = 2\n')
      git(root, ['add', 'src/node.ts'])

      expect(() => applySourcePatch(patchPath, root)).toThrow(
        /src\/ must be clean/
      )
      expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('before\n')
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
