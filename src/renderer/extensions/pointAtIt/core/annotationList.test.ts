import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { reduceAnnotations } from './annotationList'
import type { Annotation } from './annotationList'
import { settingAddress } from './fakePointHost'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')

function annotation(id: string, comment: string): Annotation {
  return {
    id,
    targets: [width],
    label: 'Empty Latent Image › width',
    comment
  }
}

const first = annotation('comment-1', 'make this wider')
const second = annotation('comment-2', 'what is this?')

describe('reduceAnnotations', () => {
  it('AN-05: a saved comment joins the end of the list, trimmed', () => {
    expect(
      reduceAnnotations([first], {
        type: 'saved',
        ...second,
        comment: '  what is this?  '
      })
    ).toEqual([first, second])
  })

  it('AN-06: a comment with no text stores nothing', () => {
    const list = [first]

    expect(
      reduceAnnotations(list, { type: 'saved', ...second, comment: '   ' })
    ).toBe(list)
  })

  it('AN-09: saving an existing comment updates it in place', () => {
    expect(
      reduceAnnotations([first, second], {
        type: 'saved',
        ...first,
        comment: 'make this taller'
      })
    ).toEqual([annotation('comment-1', 'make this taller'), second])
  })

  it('AN-09: deleting a comment leaves the rest in order', () => {
    expect(
      reduceAnnotations([first, second], { type: 'removed', id: first.id })
    ).toEqual([second])
  })

  it('AN-14: Clear empties the list', () => {
    expect(reduceAnnotations([first, second], { type: 'cleared' })).toEqual([])
  })

  it('returns the same list when an event changes nothing', () => {
    const list = [first]
    const empty: Annotation[] = []

    expect(reduceAnnotations(list, { type: 'removed', id: 'unknown' })).toBe(
      list
    )
    expect(reduceAnnotations(empty, { type: 'cleared' })).toBe(empty)
  })
})
