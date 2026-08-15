import { describe, expect, it } from 'vitest'

import { grade } from './verdict'
import type { Observation, VerificationInput } from './verdict'

const wire = (prompt: string, workflow = '{}') => ({ prompt, workflow })

const input = (over: Partial<VerificationInput> = {}): VerificationInput => ({
  pack: 'test-pack',
  observations: [],
  deprecations: { before: 0, after: 0 },
  ...over
})

const obs = (
  name: string,
  before: Observation['before'],
  after: Observation['after']
): Observation => ({ name, before, after })

describe('conversion verdicts', () => {
  describe('disqualifying outcomes are checked first', () => {
    it('REGRESSED when something that worked now fails', () => {
      const result = grade(
        input({
          observations: [obs('load', 'ok', 'failed')],
          deprecations: { before: 5, after: 0 }
        })
      )
      expect(result.verdict).toBe('REGRESSED')
      expect(result.shippable).toBe(false)
      expect(result.broken).toEqual(['load'])
    })

    it('REGRESSED even when the conversion also fixed something', () => {
      // A conversion must never be waved through on net benefit.
      const result = grade(
        input({
          observations: [
            obs('construct:FastMuter', 'failed', 'ok'),
            obs('serialize', 'ok', 'failed')
          ]
        })
      )
      expect(result.verdict).toBe('REGRESSED')
      expect(result.fixed).toEqual(['construct:FastMuter'])
    })

    it('WIRE-CHANGED when graphToPrompt differs', () => {
      const result = grade(
        input({
          observations: [obs('load', 'ok', 'ok')],
          deprecations: { before: 3, after: 0 },
          wire: { before: wire('A'), after: wire('B') }
        })
      )
      expect(result.verdict).toBe('WIRE-CHANGED')
      expect(result.shippable).toBe(false)
      expect(result.notes[0]).toMatch(/byte-identical/)
    })

    it('WIRE-CHANGED when only the serialized workflow differs', () => {
      const result = grade(
        input({
          deprecations: { before: 3, after: 0 },
          wire: {
            before: wire('same', '{"links":[1]}'),
            after: wire('same', '{"links":[2]}')
          }
        })
      )
      expect(result.verdict).toBe('WIRE-CHANGED')
      expect(result.notes[0]).toMatch(/link ids/)
    })

    it('does not fire on the document id, which every run mints afresh', () => {
      // Both runs serialize a different LGraph, so this field always differs.
      // Grading it would have blocked every conversion in the corpus.
      const result = grade(
        input({
          deprecations: { before: 2, after: 0 },
          wire: {
            before: wire('same', '{"id":"1a2b","nodes":[]}'),
            after: wire('same', '{"id":"9z8y","nodes":[]}')
          }
        })
      )
      expect(result.verdict).toBe('CLEANED')
    })

    it('still fires when the document id is equal but a node moved', () => {
      // The boundary: excluding identity must not excuse anything beside it.
      const result = grade(
        input({
          deprecations: { before: 2, after: 0 },
          wire: {
            before: wire('same', '{"id":"1a2b","nodes":[{"mode":0}]}'),
            after: wire('same', '{"id":"1a2b","nodes":[{"mode":4}]}')
          }
        })
      )
      expect(result.verdict).toBe('WIRE-CHANGED')
    })
  })

  describe('shippable outcomes', () => {
    it('IMPROVED when a broken capability now works', () => {
      // The rgthree case: virtual nodes fail to construct before conversion.
      const result = grade(
        input({
          observations: [
            obs('load', 'ok', 'ok'),
            obs('construct:RgthreeFastMuter', 'failed', 'ok')
          ],
          deprecations: { before: 1, after: 0 },
          wire: { before: wire('same'), after: wire('same') }
        })
      )
      expect(result.verdict).toBe('IMPROVED')
      expect(result.shippable).toBe(true)
      expect(result.fixed).toEqual(['construct:RgthreeFastMuter'])
    })

    it('CLEANED when nothing changed but deprecations were retired', () => {
      const result = grade(
        input({
          observations: [obs('load', 'ok', 'ok')],
          deprecations: { before: 12, after: 0 },
          wire: { before: wire('same'), after: wire('same') }
        })
      )
      expect(result.verdict).toBe('CLEANED')
      expect(result.shippable).toBe(true)
    })

    it('notes an incomplete conversion when deprecations remain', () => {
      const result = grade(
        input({
          observations: [obs('construct:X', 'failed', 'ok')],
          deprecations: { before: 12, after: 4 }
        })
      )
      expect(result.verdict).toBe('IMPROVED')
      expect(result.notes.join(' ')).toMatch(/4 deprecation warning/)
    })
  })

  describe('the coverage trap is reported, not hidden', () => {
    it('NO-SIGNAL when the baseline was already zero', () => {
      const result = grade(
        input({
          observations: [obs('load', 'ok', 'ok')],
          deprecations: { before: 0, after: 0 }
        })
      )
      expect(result.verdict).toBe('NO-SIGNAL')
      expect(result.shippable).toBe(false)
      expect(result.notes.join(' ')).toMatch(/proves nothing/)
    })

    it('does not treat a zero-to-zero result as success', () => {
      const result = grade(input({ deprecations: { before: 0, after: 0 } }))
      expect(result.shippable).toBe(false)
    })

    it('NO-SIGNAL when nothing observable changed at all', () => {
      const result = grade(
        input({
          observations: [obs('load', 'ok', 'ok')],
          deprecations: { before: 4, after: 4 }
        })
      )
      expect(result.verdict).toBe('NO-SIGNAL')
    })
  })

  it('tolerates a pack that could not run before conversion', () => {
    // No wire comparison is possible if the original never produced output.
    const result = grade(
      input({
        observations: [obs('load', 'failed', 'ok')],
        deprecations: { before: 0, after: 0 }
      })
    )
    expect(result.verdict).toBe('IMPROVED')
    expect(result.shippable).toBe(true)
  })
})
