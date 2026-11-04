import { describe, expect, it } from 'vitest'

import { docWith, generateNode, port } from './engineFixtures'
import { initialRuntime, reduceSuperComfy } from './reduce'
import { visibleMissingPorts } from './selectors'

describe(visibleMissingPorts, () => {
  it('[S1] marks an empty input only while it is still empty', () => {
    const refused = reduceSuperComfy(
      {
        doc: docWith([
          generateNode('gen', 'image', {
            inputs: [port('prompt', 'text', { required: true, inline: true })]
          })
        ]),
        runtime: initialRuntime()
      },
      {
        type: 'runRefused',
        nodeId: 'gen',
        block: { reason: 'missingInputs', ports: ['prompt'] }
      }
    )

    expect(visibleMissingPorts(refused, 'gen')).toEqual(['prompt'])

    const filled = reduceSuperComfy(refused, {
      type: 'inlineChanged',
      nodeId: 'gen',
      port: 'prompt',
      text: 'a lighthouse at dusk'
    })

    expect(visibleMissingPorts(filled, 'gen')).toEqual([])
  })
})
