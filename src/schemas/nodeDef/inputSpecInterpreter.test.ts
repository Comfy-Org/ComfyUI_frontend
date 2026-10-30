import { expect, it, vi } from 'vitest'

import { createInputSpecInterpreter } from '@/schemas/nodeDef/inputSpecInterpreter'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'

it('delivers every malformed option to its own sink without app dedupe or caps', () => {
  const sink = vi.fn()
  const otherSink = vi.fn()
  const interpreter = createInputSpecInterpreter(sink)
  const otherInterpreter = createInputSpecInterpreter(otherSink)
  const spec = transformInputSpecV1ToV2(
    [
      'COMFY_DYNAMICCOMBO_V3',
      {
        options: [
          { key: 'good', inputs: { required: { image: ['IMAGE', {}] } } },
          ...Array.from({ length: 11 }, (_, index) => ({ key: `bad-${index}` }))
        ]
      }
    ],
    { name: 'choices' }
  )

  expect(interpreter.dynamicComboOptionKeys(spec)).toEqual(['good'])
  expect(interpreter.dynamicComboOptionTypes(spec)).toEqual([
    { key: 'good', types: ['IMAGE'] }
  ])
  expect(sink).toHaveBeenCalledTimes(22)
  expect(sink.mock.calls.map(([, , index]) => index)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
  ])
  expect(otherSink).not.toHaveBeenCalled()

  expect(otherInterpreter.inputSpecTree(spec).map(({ name }) => name)).toEqual([
    'choices',
    'image'
  ])
  expect(otherSink).toHaveBeenCalledTimes(11)
  expect(sink).toHaveBeenCalledTimes(22)
})
