import { describe, expect, it } from 'vitest'

import { parseWorkflowView } from './workflowView'

describe('parseWorkflowView', () => {
  it('returns a valid workflow view', () => {
    expect(parseWorkflowView({ scale: 0.01, offset: [10, -20] })).toEqual({
      scale: 0.01,
      offset: [10, -20]
    })
  })

  it.for([0, -1, Number.POSITIVE_INFINITY])(
    'rejects an invalid scale of %s',
    (scale) => {
      expect(parseWorkflowView({ scale, offset: [0, 0] })).toBeUndefined()
    }
  )

  it.for([
    { label: 'infinite x', offset: [Number.POSITIVE_INFINITY, 0] },
    { label: 'NaN y', offset: [0, Number.NaN] }
  ])('rejects an offset with $label', ({ offset }) => {
    expect(parseWorkflowView({ scale: 1, offset })).toBeUndefined()
  })

  it.for([
    { label: 'null input', value: null },
    { label: 'missing scale', value: { offset: [0, 0] } },
    { label: 'missing offset', value: { scale: 1 } },
    { label: 'non-array offset', value: { scale: 1, offset: '0,0' } },
    { label: 'short offset', value: { scale: 1, offset: [0] } },
    { label: 'non-number coordinate', value: { scale: 1, offset: ['0', 0] } }
  ])('rejects $label', ({ value }) => {
    expect(parseWorkflowView(value)).toBeUndefined()
  })
})
