import { afterEach, describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'

import { recordDeprecations } from './deprecationRecorder'

describe('deprecation recorder', () => {
  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('records warnings raised while active', () => {
    const recorder = recordDeprecations()
    warnDeprecated('output.links is deprecated (test-a)')
    warnDeprecated('input.link is deprecated (test-b)')
    const recording = recorder.stop()

    expect(recording.count).toBe(2)
    expect(recording.all.map((r) => r.message)).toContain(
      'output.links is deprecated (test-a)'
    )
  })

  it('records nothing after stop', () => {
    const recorder = recordDeprecations()
    recorder.stop()
    warnDeprecated('after stop (test-c)')
    expect(recordDeprecations().stop().count).toBe(0)
  })

  // The trap this module exists for: warnDeprecated dedupes by message for the
  // whole session, so a naive before/after pair reports the "after" run at zero
  // regardless of whether anything was converted.
  it('counts the same message across two separate runs', () => {
    const message = 'repeated across runs (test-d)'

    const before = recordDeprecations()
    warnDeprecated(message)
    const beforeCount = before.stop().count

    const after = recordDeprecations()
    warnDeprecated(message)
    const afterCount = after.stop().count

    expect(beforeCount).toBe(1)
    // Would be 0 if session-wide dedup were left enabled — a false "converted".
    expect(afterCount).toBe(1)
  })

  it('restores the previous repeat setting', () => {
    LiteGraph.alwaysRepeatWarnings = false
    const recorder = recordDeprecations()
    expect(LiteGraph.alwaysRepeatWarnings).toBe(true)
    recorder.stop()
    expect(LiteGraph.alwaysRepeatWarnings).toBe(false)
  })

  it('removes only its own callback', () => {
    const other = () => {}
    LiteGraph.onDeprecationWarning.push(other)
    const before = LiteGraph.onDeprecationWarning.length

    recordDeprecations().stop()

    expect(LiteGraph.onDeprecationWarning).toContain(other)
    expect(LiteGraph.onDeprecationWarning.length).toBe(before)
    LiteGraph.onDeprecationWarning.splice(
      LiteGraph.onDeprecationWarning.indexOf(other),
      1
    )
  })

  describe('attribution', () => {
    it('keeps only warnings whose stack mentions the target', () => {
      const recorder = recordDeprecations({
        attribution: 'deprecationRecorder.test'
      })
      warnDeprecated('raised from this spec file (test-e)')
      const recording = recorder.stop()

      expect(recording.count).toBe(1)
      expect(recording.all.length).toBe(1)
    })

    it('excludes warnings that did not come from the target', () => {
      const recorder = recordDeprecations({
        attribution: 'some-other-pack-entirely'
      })
      warnDeprecated('not from that pack (test-f)')
      const recording = recorder.stop()

      // Still observed overall, but not attributed — the distinction that stops
      // core-raised warnings being blamed on a pack.
      expect(recording.all.length).toBe(1)
      expect(recording.count).toBe(0)
    })
  })
})
