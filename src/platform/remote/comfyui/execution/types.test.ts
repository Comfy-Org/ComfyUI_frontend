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
