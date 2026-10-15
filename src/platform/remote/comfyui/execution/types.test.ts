import { expect, expectTypeOf, it } from 'vitest'

import type { ExecutedWsMessage, ExecutingWsMessage } from './types'
import { zTaskOutput } from './types'

it('accepts terminal executing frames while keeping executed node IDs required', () => {
  expectTypeOf<{
    node: string | number | null
    prompt_id: string
  }>().toExtend<ExecutingWsMessage>()
  expectTypeOf<ExecutedWsMessage>().toExtend<{
    node: string | number
    display_node: string | number
  }>()
})

it('preserves custom node output alongside partial media references', () => {
  const output = {
    '17': {
      images: [{ filename: 'preview.png', type: 'temp' }],
      text: 'caption',
      custom_mesh: { vertices: [2, 5, 11] }
    }
  }

  expect(zTaskOutput.parse(output)).toEqual(output)
})

it('keeps the output version as a string and never fails on a malformed one', () => {
  const parsed = zTaskOutput.parse({
    '1': { images: [{ filename: 'a.png', type: 'output', version: 'v2' }] },
    '2': { images: [{ filename: 'b.png', type: 'output', version: 7 }] },
    '3': { images: [{ filename: 'c.png', type: 'output' }] }
  })

  expect(parsed['1'].images?.[0].version).toBe('v2')
  expect(parsed['2'].images?.[0].version).toBe('7')
  expect(parsed['3'].images?.[0]).toStrictEqual({
    filename: 'c.png',
    type: 'output'
  })
})
