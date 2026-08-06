/**
 * What the wire comparison ignores, and — more importantly — what it must not.
 *
 * `size` is excluded because litegraph sizes a node from canvas row heights
 * while a mounted widget is measured by the DOM. The two metrics are not
 * comparable, so without this every conversion that moves drawing into
 * `widgets.mount` reports a wire change on size alone.
 *
 * That exclusion is load-bearing and therefore dangerous: an over-broad version
 * of it would silently stop the harness noticing the changes that do alter what
 * a workflow means. These cases pin the boundary.
 */
import { describe, expect, it } from 'vitest'

/** Mirrors the projection in `harness/runPack.mjs`. */
function comparable(node: Record<string, unknown>): string {
  const { size: _size, ...meaningful } = node
  return JSON.stringify(meaningful)
}

const NODE = {
  id: 3,
  type: 'X',
  pos: [10, 10],
  size: [140, 60],
  flags: {},
  order: 1,
  mode: 0,
  inputs: [],
  outputs: [],
  title: 'X',
  properties: { a: 1 },
  widgets_values: ['seed', 42]
}

const changed = (mutated: Record<string, unknown>) =>
  comparable(NODE) !== comparable(mutated)

describe('the wire comparison', () => {
  it('ignores a size difference between renderers', () => {
    expect(changed({ ...NODE, size: [140, 88] })).toBe(false)
  })

  it.each([
    ['a changed widget value', { ...NODE, widgets_values: ['seed', 43] }],
    ['a dropped widget', { ...NODE, widgets_values: ['seed'] }],
    ['a changed property', { ...NODE, properties: { a: 2 } }],
    ['a changed mode', { ...NODE, mode: 4 }],
    ['a changed title', { ...NODE, title: 'Y' }],
    ['a new input', { ...NODE, inputs: [{ name: 'i', link: 1 }] }]
  ])('still catches %s', (_label, mutated) => {
    expect(changed(mutated)).toBe(true)
  })

  it('still catches widgets_values disappearing entirely', () => {
    // The failure mode that prompted this: converting a DOM preview widget can
    // drop it out of persistence, because `widgets.mount` sets both the
    // workflow and prompt serialization flags where the old `addDOMWidget`
    // options set only the prompt one.
    const { widgets_values: _values, ...withoutValues } = NODE
    expect(changed(withoutValues)).toBe(true)
  })
})
