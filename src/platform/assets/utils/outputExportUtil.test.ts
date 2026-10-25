import { describe, expect, it } from 'vitest'

import type { DownloadableOutput } from './outputExportUtil'
import { buildOutputsExportRequest, outputFileUrl } from './outputExportUtil'

describe('buildOutputsExportRequest', () => {
  it('exports outputs by their asset ids', () => {
    expect(
      buildOutputsExportRequest([
        { filename: 'a.png', id: 'asset-a' },
        { filename: 'b.png', id: 'asset-b' }
      ])
    ).toEqual({
      asset_ids: ['asset-a', 'asset-b'],
      naming_strategy: 'preserve'
    })
  })

  it.for([
    { name: 'there are no outputs', outputs: [] },
    {
      name: 'an output has no asset id',
      outputs: [{ filename: 'a.png', id: 'asset-a' }, { filename: 'b.png' }]
    }
  ] satisfies { name: string; outputs: DownloadableOutput[] }[])(
    'returns nothing when $name',
    ({ outputs }) => {
      expect(buildOutputsExportRequest(outputs)).toBeUndefined()
    }
  )
})

describe('outputFileUrl', () => {
  it.for([
    {
      output: { filename: 'a.png', subfolder: 'shots', type: 'temp' },
      expected: '/api/view?filename=a.png&subfolder=shots&type=temp'
    },
    {
      output: { filename: 'a.png' },
      expected: '/api/view?filename=a.png&subfolder=&type=output'
    }
  ] satisfies { output: DownloadableOutput; expected: string }[])(
    'points $output.filename at the view endpoint',
    ({ output, expected }) => {
      expect(outputFileUrl(output)).toBe(expected)
    }
  )
})
