import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { mutateExecutionSource, proofIdentity } from './custom-node-proof'

describe('custom-node detection proof', () => {
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

  it('source patches apply to current src/', () => {
    const directory = join(
      'browser_tests',
      'tests',
      'customNodes',
      'detection-proof'
    )
    const patches = readdirSync(directory).filter((name) =>
      name.endsWith('.patch')
    )
    expect(patches.length).toBeGreaterThan(0)
    for (const entry of patches) {
      const result = spawnSync(
        'git',
        ['apply', '--check', join(directory, entry)],
        { encoding: 'utf8' }
      )
      expect(result.status, `${entry}: ${result.stderr}`).toBe(0)
    }
  })
})
