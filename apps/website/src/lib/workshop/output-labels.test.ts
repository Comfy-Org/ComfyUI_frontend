import { describe, expect, it } from 'vitest'

import type { RunOutput } from '../../config/workshop-run'
import { outputLabels } from './output-labels'

const output = (kind: RunOutput['kind']): RunOutput => ({
  kind,
  url: 'blob:x',
  fileName: `seedream-1.${kind}`
})

describe('outputLabels', () => {
  it('names the result by what it is and the text beside it as the response', () => {
    expect(outputLabels([output('image'), output('text')])).toEqual([
      { key: 'workshop.output.kindImage' },
      { key: 'workshop.output.kindResponse' }
    ])
  })

  it('keeps the text a model was asked for as text when it leads', () => {
    expect(outputLabels([output('text')])).toEqual([
      { key: 'workshop.output.kindText' }
    ])
  })

  it('numbers only the kinds that repeat', () => {
    expect(
      outputLabels([output('image'), output('image'), output('text')])
    ).toEqual([
      { key: 'workshop.output.kindImage', ordinal: 1 },
      { key: 'workshop.output.kindImage', ordinal: 2 },
      { key: 'workshop.output.kindResponse' }
    ])
  })
})
