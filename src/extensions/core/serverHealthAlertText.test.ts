import { describe, expect, it } from 'vitest'

import { labelRepeatsMessage } from './serverHealthAlertText'

describe('labelRepeatsMessage', () => {
  it.for([
    ['PREVIEW', 'Preview Environment'],
    ['WARN', 'Warning Message']
  ])('reports %s, which the message already carries', ([label, message]) => {
    expect(labelRepeatsMessage(label, message)).toBe(true)
  })

  it('keeps a badge that adds something the message does not say', () => {
    expect(labelRepeatsMessage('BETA', 'Comfy Cloud')).toBe(false)
  })

  it('reports nothing when there is no badge', () => {
    expect(labelRepeatsMessage(undefined, 'Preview Environment')).toBe(false)
  })
})
