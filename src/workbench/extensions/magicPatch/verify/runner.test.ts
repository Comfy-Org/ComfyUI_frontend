import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { convert } from '../conversion/convert'
import { verifyConversion } from './runner'
import type { Evaluate } from './runner'
import { grade } from './verdict'

/**
 * Evaluates pack source with the globals ComfyUI provides.
 *
 * Real packs are ES modules; this stands in for the module loader so the
 * battery can be exercised without a corpus checkout.
 */
const evaluate: Evaluate = (source) => {
  const fn = new Function('LiteGraph', 'LGraphNode', source)
  fn(LiteGraph, LGraphNode)
}

/**
 * The rgthree shape, reduced to the part that matters.
 *
 * `onConstructed` self-assigns `type`. This used to be the sharpest failure in
 * the corpus: `type` was getter-only, so the constructor threw and `createNode`
 * returned null for every type built this way (8 packs, 3.86M downloads).
 *
 * ECS softened it. `set type` now warns and assigns rather than throwing — and
 * because it warns only `if (value !== this._state.type)`, a *self*-assignment
 * is completely silent. So the idiom neither breaks nor announces itself, and
 * the battery has nothing left to measure: the case below is NO-SIGNAL, which
 * is the harness reporting its own blindness rather than a passing conversion.
 * Restoring the signal needs `type` writes to warn unconditionally, or to
 * throw again.
 */
const RGTHREE_SHAPE = `
class RgthreeBaseNode extends LGraphNode {
  constructor(title) {
    super(title)
    this.onConstructed()
  }
  onConstructed() {
    var _a;
    this.type = (_a = this.type) !== null && _a !== void 0 ? _a : undefined;
    this.__constructed__ = true;
    return true
  }
}
class RgthreeFastMuter extends RgthreeBaseNode {}
class RgthreeFastBypasser extends RgthreeBaseNode {}
LiteGraph.registerNodeType('RgthreeFastMuter', RgthreeFastMuter)
LiteGraph.registerNodeType('RgthreeFastBypasser', RgthreeFastBypasser)
`

describe('conversion runner', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('the rgthree case, end to end', () => {
    it('converts the real idiom, and reports that it cannot prove it', async () => {
      const converted = convert(RGTHREE_SHAPE)

      // The mechanical rule fired, and changed exactly one line.
      expect(converted.applied.map((m) => m.rule)).toEqual(['type-write-noop'])
      expect(RGTHREE_SHAPE.split('\n').length).toBe(
        converted.source.split('\n').length + 1
      )

      const result = await verifyConversion({
        pack: 'rgthree-comfy',
        original: RGTHREE_SHAPE,
        converted: converted.source,
        evaluate,
        attribution: 'rgthree'
      })

      // Measured, not assumed: the write no longer takes the node type out.
      const muter = result.observations.find(
        (o) => o.name === 'construct:RgthreeFastMuter'
      )
      expect(muter).toEqual({
        name: 'construct:RgthreeFastMuter',
        before: 'ok',
        after: 'ok'
      })

      // And the silent setter leaves no deprecation to retire either, so there
      // is no evidence in any channel the battery reads.
      expect(result.deprecations).toEqual({ before: 0, after: 0 })

      const verdict = grade(result)
      expect(verdict.verdict).toBe('NO-SIGNAL')
      expect(verdict.shippable).toBe(false)
      expect(verdict.broken).toEqual([])
      expect(verdict.notes[0]).toMatch(/proves nothing/)
    })

    it('reports both node types, not just the first', async () => {
      const result = await verifyConversion({
        pack: 'rgthree-comfy',
        original: RGTHREE_SHAPE,
        converted: convert(RGTHREE_SHAPE).source,
        evaluate
      })
      expect(
        result.observations.filter((o) => o.name.startsWith('construct:'))
      ).toHaveLength(2)
    })
  })

  describe('run isolation', () => {
    it('does not leak registered types between runs', async () => {
      const before = Object.keys(LiteGraph.registered_node_types).length
      await verifyConversion({
        pack: 'p',
        original: RGTHREE_SHAPE,
        converted: convert(RGTHREE_SHAPE).source,
        evaluate
      })
      expect(Object.keys(LiteGraph.registered_node_types).length).toBe(before)
    })

    it('would otherwise credit the converted run with the original run’s types', async () => {
      // The converted source registers nothing; without isolation it would
      // still "see" the types the original run registered.
      const result = await verifyConversion({
        pack: 'p',
        original: RGTHREE_SHAPE,
        converted: '/* registers nothing */',
        evaluate
      })
      expect(result.after.registeredTypes).toEqual([])
      expect(grade(result).verdict).toBe('REGRESSED')
    })
  })

  describe('failure reporting', () => {
    it('records a load failure with its message', async () => {
      const result = await verifyConversion({
        pack: 'p',
        original: 'throw new Error("boom")',
        converted: 'throw new Error("boom")',
        evaluate
      })
      expect(result.before.loaded).toBe(false)
      expect(result.before.loadError).toBe('boom')
    })

    it('flags a conversion that breaks loading', async () => {
      const result = await verifyConversion({
        pack: 'p',
        original: RGTHREE_SHAPE,
        converted: 'throw new Error("bad patch")',
        evaluate
      })
      const verdict = grade(result)
      expect(verdict.verdict).toBe('REGRESSED')
      expect(verdict.shippable).toBe(false)
      expect(verdict.broken).toContain('load')
    })

    it('reports NO-SIGNAL when a conversion changes nothing observable', async () => {
      const inert = 'const unused = 1'
      const result = await verifyConversion({
        pack: 'p',
        original: inert,
        converted: inert,
        evaluate
      })
      expect(grade(result).verdict).toBe('NO-SIGNAL')
      expect(grade(result).shippable).toBe(false)
    })
  })
})
