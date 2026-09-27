import { assert, describe, expect, it } from 'vitest'

import { validateWorkshopInput } from './workshop-json-schema'
import {
  parseWorkflowCatalog,
  workflowCatalog
} from './workshop-workflow-catalog'
import type { WorkshopWorkflowEntry } from './workshop-workflow-catalog'

function workflow(): WorkshopWorkflowEntry {
  const entry = workflowCatalog.find(
    ({ id }) => id === 'workflows/change-material'
  )
  assert(entry)
  return structuredClone(entry)
}

describe('prepared workflow catalog', () => {
  it.for([
    {
      id: 'workflows/remove-background',
      inputs: { image: 'https://media.example.com/source.png' }
    },
    {
      id: 'workflows/change-material',
      inputs: {
        image1: 'https://media.example.com/source.png',
        image2: 'https://media.example.com/material.png',
        prompt: 'Change the chair fabric to velvet.'
      }
    },
    {
      id: 'workflows/product-mockup',
      inputs: {
        image1: 'https://media.example.com/design.png',
        image2: 'https://media.example.com/product.png',
        prompt: 'Apply the logo to the bottle.'
      }
    }
  ])('accepts the prepared inputs for $id', ({ id, inputs }) => {
    const entry = workflowCatalog.find((candidate) => candidate.id === id)
    assert(entry)
    expect(validateWorkshopInput(inputs, entry.inputSchema)).toBe(true)
  })

  it('preserves authored graph values, nested targets and output order', () => {
    const entry = workflow()
    entry.cloud.workflow['another:node'] = {
      class_type: 'TextInput',
      inputs: { text: 'Different fixed text' }
    }
    entry.cloud.inputBindings.prompt.targets.push({
      nodeId: 'another:node',
      inputName: 'text'
    })
    entry.outputs.push({
      id: 'second-image',
      nodeId: 'another:node',
      key: 'images',
      kind: 'image'
    })

    expect(parseWorkflowCatalog(`\n${JSON.stringify(entry)}\r\n`)).toEqual([
      entry
    ])
  })

  it.for([
    { type: 'boolean', value: false },
    { type: 'integer', value: 0 },
    { type: 'string', value: '' }
  ] as const)('retains an explicit $value default', ({ type, value }) => {
    const entry = workflow()
    entry.inputSchema.properties.prompt = { type, default: value }
    entry.cloud.workflow['170:151'].inputs.prompt = value

    const [parsed] = parseWorkflowCatalog(JSON.stringify(entry))

    expect(parsed.inputSchema.properties.prompt.default).toBe(value)
  })

  it('allows an explicitly prepared zero-input workflow', () => {
    const entry = workflow()
    entry.inputSchema.properties = {}
    entry.inputSchema.required = []
    entry.cloud.inputBindings = {}

    const [parsed] = parseWorkflowCatalog(JSON.stringify(entry))

    expect(validateWorkshopInput({}, parsed.inputSchema)).toBe(true)
  })

  it.for([
    {
      name: 'undeclared required field',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.inputSchema.required.push('missing')
      }
    },
    {
      name: 'unmapped field',
      change: (entry: WorkshopWorkflowEntry) => {
        delete entry.cloud.inputBindings.prompt
      }
    },
    {
      name: 'undeclared binding',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.cloud.inputBindings.missing = entry.cloud.inputBindings.prompt
      }
    },
    {
      name: 'missing graph node',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.cloud.inputBindings.prompt.targets[0].nodeId = 'missing'
      }
    },
    {
      name: 'missing graph input',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.cloud.inputBindings.prompt.targets[0].inputName = 'missing'
      }
    },
    {
      name: 'repeated binding target',
      change: (entry: WorkshopWorkflowEntry) => {
        const binding = entry.cloud.inputBindings.prompt
        binding.targets.push(binding.targets[0])
      }
    },
    {
      name: 'conflicting field targets',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.cloud.inputBindings.image2.targets =
          entry.cloud.inputBindings.image1.targets
      }
    },
    {
      name: 'graph link used as a scalar input',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.cloud.workflow['170:151'].inputs.prompt = ['41', 0]
      }
    },
    {
      name: 'invalid scalar default',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.inputSchema.properties.prompt.default = false
      }
    },
    {
      name: 'unsafe integer default',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.inputSchema.properties.prompt = {
          type: 'integer',
          default: Number.MAX_SAFE_INTEGER + 1
        }
      }
    },
    {
      name: 'missing output node',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.outputs[0].nodeId = 'missing'
      }
    },
    {
      name: 'repeated output ID',
      change: (entry: WorkshopWorkflowEntry) => {
        entry.outputs.push(entry.outputs[0])
      }
    }
  ])('rejects $name', ({ change }) => {
    const entry = workflow()
    change(entry)

    expect(() => parseWorkflowCatalog(JSON.stringify(entry))).toThrow(
      'Invalid workflow catalog entry on line 1'
    )
  })

  it.for([
    { name: 'malformed JSON', text: '{' },
    { name: 'missing definition', text: '{}' },
    {
      name: 'unverified serverless contract',
      text: JSON.stringify({ ...workflow(), type: 'SERVERLESS' })
    },
    {
      name: 'structured input',
      text: JSON.stringify({
        ...workflow(),
        inputSchema: {
          type: 'object',
          properties: { custom: { type: 'object' } },
          required: ['custom'],
          additionalProperties: false
        }
      })
    }
  ])('rejects $name', ({ text }) => {
    expect(() => parseWorkflowCatalog(text)).toThrow()
  })

  it('rejects duplicate workflow IDs with the failing line number', () => {
    const line = JSON.stringify(workflow())

    expect(() => parseWorkflowCatalog(`${line}\n\n${line}`)).toThrow(
      'Invalid workflow catalog entry on line 3'
    )
  })
})
