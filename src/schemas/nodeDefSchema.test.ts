import { expect, it } from 'vitest'

import { transformNodeDefV1ToV2 } from './nodeDef/migration'
import { zComfyNodeDef as zComfyNodeDefV2 } from './nodeDef/nodeDefSchemaV2'
import { zComfyNodeDef } from './nodeDefSchema'

it('parses a backend node definition into a usable V2 input and output contract', () => {
  const definition = zComfyNodeDef.parse({
    name: 'ImageScale',
    display_name: 'Scale Image',
    category: 'image',
    python_module: 'nodes',
    description: 'Scale an image',
    input: {
      required: { width: ['INT', { default: 512, min: 1, max: 8192 }] },
      optional: { image: ['IMAGE'] }
    },
    output: ['IMAGE'],
    output_name: ['image'],
    output_is_list: [false],
    output_node: false
  })

  const migrated = zComfyNodeDefV2.parse(transformNodeDefV1ToV2(definition))

  expect(migrated.inputs).toEqual({
    width: {
      name: 'width',
      type: 'INT',
      default: 512,
      min: 1,
      max: 8192,
      isOptional: false
    },
    image: { name: 'image', type: 'IMAGE', isOptional: true }
  })
  expect(migrated.outputs).toEqual([
    { index: 0, name: 'image', type: 'IMAGE', is_list: false }
  ])
})
