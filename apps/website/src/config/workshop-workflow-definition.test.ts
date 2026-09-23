import { describe, expect, it } from 'vitest'

import {
  formForWorkflow,
  workshopWorkflowDefinitionSchema
} from './workshop-workflow-definition'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'

function definition() {
  return workshopWorkflowDefinitionSchema.parse({
    id: 'workflows/controls',
    definitionVersion: '1',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'integer', minimum: 0, maximum: 20, default: 0 },
        enabled: { type: 'boolean', default: false },
        text: { type: 'string', default: '' },
        choice: { type: 'string', enum: ['first', 'second'], default: 'first' }
      },
      required: ['steps', 'enabled', 'choice'],
      additionalProperties: false
    },
    inputs: {
      enabled: {
        label: 'Enabled',
        help: '',
        hidden: false,
        advanced: false,
        control: 'toggle'
      },
      steps: {
        label: 'Steps',
        help: '',
        hidden: false,
        advanced: false,
        control: 'slider'
      },
      choice: {
        label: 'Choice',
        help: '',
        hidden: false,
        advanced: false,
        control: 'dropdown'
      },
      text: {
        label: 'Text',
        help: '',
        hidden: false,
        advanced: false,
        control: 'text-box'
      }
    }
  })
}

describe('workflow form declarations', () => {
  it('preserves master widget order and false, zero and empty defaults', () => {
    const form = formForWorkflow(definition())
    const schema = schemaForModel({ form, fields: [] })
    expect(schema.map((field) => field.name)).toEqual([
      'enabled',
      'steps',
      'choice',
      'text'
    ])
    const values = defaultValues(schema)
    expect(values).toEqual({
      enabled: false,
      steps: 0,
      text: '',
      choice: 'first'
    })
    expect(validateForm(schema, values)).toEqual({})
    expect(
      validateForm(schema, { ...values, steps: 21, choice: 'unknown' })
    ).toEqual({ steps: 'outOfRange', choice: 'badOption' })
  })

  it('keeps a workflow with no inputs empty', () => {
    const source = definition()
    const form = formForWorkflow({
      ...source,
      inputs: {},
      inputSchema: { ...source.inputSchema, properties: {}, required: [] }
    })
    expect(schemaForModel({ form, fields: [], modality: 'image' })).toEqual([])
  })
})
