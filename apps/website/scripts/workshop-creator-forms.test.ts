import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import { workshopContract } from '../src/config/workshop-contract-catalog'
import { creatorFormFor } from './workshop-creator-forms'
import { schemaAt } from './workshop-creator-fields'
import { curateWorkshopInputs } from './workshop-input-presentation'

const object = z.record(z.string(), z.json())

describe('creator schema refresh guards', () => {
  it.for(['sampleCount', 'resolution', 'aspectRatio', 'durationSeconds'])(
    'identifies the model and dropped Veo parameter %s',
    (name) => {
      const id = 'veo/veo-3.1-generate-001'
      const contract = workshopContract(id)
      if (!contract) throw new Error('Missing Veo fixture')
      const schema = contract.inputSchema
      const parameters = schemaAt(schema, 'parameters')
      const fields = object.parse(parameters.properties)
      delete fields[name]
      const changed = {
        ...schema,
        properties: {
          ...object.parse(schema.properties),
          parameters: { ...parameters, properties: fields }
        }
      }
      expect(() =>
        creatorFormFor(id, curateWorkshopInputs(id, changed))
      ).toThrow(`Missing creator parameter ${id}:parameters.${name}`)
    }
  )

  it('validates merged per-content options, including truthy string booleans', () => {
    const id = 'byteplus/dreamina-seedance-2-0-fast-260128'
    const contract = workshopContract(id)
    if (!contract) throw new Error('Missing Seedance fixture')
    const curated = {
      inputSchema: contract.inputSchema,
      inputs: contract.inputs ?? {},
      defaultInput: contract.defaultInput ?? {}
    }
    expect(() => creatorFormFor(id, curated, { urlMedia: 'false' })).toThrow()
  })
})
