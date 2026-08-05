import { describe, expect, it } from 'vitest'

import { classifyWidgetMutation } from './widgetMutation'

const classify = (source: string, line = 0) =>
  classifyWidgetMutation(source.split('\n'), line)

describe('widget mutation classifier', () => {
  describe('the kjnodes shape — invalidation, not a reorder', () => {
    // ComfyUI-KJNodes setgetnodes.js:996. The array is unchanged; the splice
    // pair exists only to make the renderer re-read the options object.
    const KJNODES = [
      'w.options = newOpts;',
      'const idx = this.widgets.indexOf(w);',
      'this.widgets.splice(idx, 1);',
      'this.widgets.splice(idx, 0, w);'
    ].join('\n')

    it('is not classified as a reorder', () => {
      expect(classify(KJNODES, 2)!.kind).not.toBe('reorder')
      expect(classify(KJNODES, 2)!.kind).not.toBe('move')
    })

    it('recognises the paired same-index splice', () => {
      expect(classify(KJNODES, 2)!.kind).toBe('invalidate')
    })

    it('upgrades to invalidate-options when options were just assigned', () => {
      const tight = [
        'w.options = newOpts;',
        'this.widgets.splice(idx, 1);',
        'this.widgets.splice(idx, 0, w);'
      ].join('\n')
      const mutation = classify(tight, 1)!
      expect(mutation.kind).toBe('invalidate-options')
      expect(mutation.instruction).toMatch(/setOptions/)
    })
  })

  describe('genuine reordering and moves', () => {
    it('classifies a whole-array assignment as a reorder', () => {
      const mutation = classify('node.widgets = [a, b, c];')!
      expect(mutation.kind).toBe('reorder')
      expect(mutation.instruction).toMatch(/reorder\(names\)/)
    })

    it('classifies reinsertion at a different index as a move', () => {
      const source = [
        'this.widgets.splice(from, 1);',
        'this.widgets.splice(to, 0, w);'
      ].join('\n')
      expect(classify(source, 0)!.kind).toBe('move')
    })
  })

  describe('other shapes', () => {
    it('classifies length assignment as truncation, and warns about teardown', () => {
      const mutation = classify('this.widgets.length = isConvertedWidget;')!
      expect(mutation.kind).toBe('truncate')
      expect(mutation.instruction).toMatch(/teardown/)
    })

    it('classifies push as append, and flags the shape mismatch', () => {
      const mutation = classify('node.widgets.push(w);')!
      expect(mutation.kind).toBe('append')
      expect(mutation.instruction).toMatch(/definition rather than a widget/)
    })

    it('classifies a lone splice as removal', () => {
      expect(classify('this.widgets.splice(idx, 1);')!.kind).toBe('remove')
    })

    it('ignores lines that are not mutations', () => {
      expect(classify('const n = node.widgets.length;')).toBeUndefined()
      expect(classify('for (const w of node.widgets) {}')).toBeUndefined()
    })
  })

  describe('robustness', () => {
    it('tolerates whitespace differences between the paired indices', () => {
      const source = [
        'this.widgets.splice( idx , 1 );',
        'this.widgets.splice(idx, 0, w);'
      ].join('\n')
      expect(classify(source, 0)!.kind).toBe('invalidate')
    })

    it('does not pair with a splice that is too far away', () => {
      const source = [
        'this.widgets.splice(idx, 1);',
        'a();',
        'b();',
        'c();',
        'd();',
        'this.widgets.splice(idx, 0, w);'
      ].join('\n')
      expect(classify(source, 0)!.kind).toBe('remove')
    })

    it('skips deleted lines when looking ahead', () => {
      const lines = [
        'this.widgets.splice(idx, 1);',
        null,
        'this.widgets.splice(idx, 0, w);'
      ]
      expect(classifyWidgetMutation(lines, 0)!.kind).toBe('invalidate')
    })

    it('reports the original line number', () => {
      const source = ['a();', 'b();', 'node.widgets.push(w);'].join('\n')
      expect(classify(source, 2)!.line).toBe(3)
    })
  })

  it('always supplies an actionable instruction', () => {
    const samples = [
      'node.widgets = [a];',
      'node.widgets.push(w);',
      'this.widgets.length = 0;',
      'this.widgets.splice(i, 1);'
    ]
    for (const sample of samples) {
      expect(classify(sample)!.instruction.length).toBeGreaterThan(40)
    }
  })
})
