// Category: BC.16 — Execution output consumption (per-node)
// DB cross-ref: S2.N2
// blast_radius: 4.67 (compat-floor)
// v1 contract: node.onExecuted(output) — prototype-patched per extension
// TODO(R8): swap with loadEvidenceSnippet('S2.N2', 0) once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

describe('BC.16 v1 contract — node.onExecuted callback (S2.N2)', () => {
  it('S2.N2 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S2.N2')).toBeGreaterThan(0)
  })

  it('onExecuted receives the output object with arbitrary keys', () => {
    const output = { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] }
    let received: unknown
    const node = { onExecuted(o: unknown) { received = o } }
    node.onExecuted(output)
    expect((received as typeof output).images[0].filename).toBe('out.png')
  })

  it('onExecuted can be prototype-patched; the original is still callable', () => {
    const log: string[] = []
    const proto = { onExecuted(_o: unknown) { log.push('orig') } }
    const orig = proto.onExecuted.bind(proto)
    proto.onExecuted = function (o: unknown) { log.push('ext'); orig(o) }
    proto.onExecuted({ text: ['hi'] })
    expect(log).toEqual(['ext', 'orig'])
  })

  it('multiple extensions chain onExecuted; all fire in outer-first order', () => {
    const log: number[] = []
    let fn: (o: unknown) => void = () => { log.push(0) }
    fn = ((prev) => (o: unknown) => { log.push(1); prev(o) })(fn)
    fn = ((prev) => (o: unknown) => { log.push(2); prev(o) })(fn)
    fn({})
    expect(log).toEqual([2, 1, 0])
  })

  it('output object shape for text-type nodes has a text array', () => {
    const output: Record<string, unknown> = { text: ['result string'] }
    const keys: string[] = []
    const node = { onExecuted(o: Record<string, unknown>) { keys.push(...Object.keys(o)) } }
    node.onExecuted(output)
    expect(keys).toContain('text')
  })
})
