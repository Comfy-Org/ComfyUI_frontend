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
})
