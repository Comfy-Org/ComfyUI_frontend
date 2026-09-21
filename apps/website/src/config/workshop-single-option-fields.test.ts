import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import contractsJson from '../content/workshop-router-contracts.json'
import {
  formForContract,
  workshopContractRecordSchema
} from './workshop-contract'
import { fieldsForDefinition } from './workshop-form-definition'
import { defaultValues, schemaForModel } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'

const contracts = z.array(workshopContractRecordSchema).parse(contractsJson)

function contractFor(id: string) {
  const contract = contracts.find((entry) => entry.id === id)
  if (!contract) throw new Error(`Missing contract: ${id}`)
  return contract
}

describe('model form choices', () => {
  it('never offers a dropdown with one option', () => {
    const offered = contracts.flatMap((contract) =>
      fieldsForDefinition(formForContract(contract))
        .filter((field) => field.kind === 'select' && field.options.length < 2)
        .map((field) => `${contract.id}: ${field.name}`)
    )

    expect(offered).toEqual([])
  })

  it.for([
    { id: 'krea/krea-2', name: 'resolution', value: '1K' },
    { id: 'krea/krea-2-large', name: 'resolution', value: '1K' },
    { id: 'krea/krea-2-medium', name: 'resolution', value: '1K' },
    { id: 'krea/krea-2-medium-turbo', name: 'resolution', value: '1K' },
    { id: 'luma/photon-1', name: 'generation_type', value: 'image' },
    { id: 'luma/photon-flash-1', name: 'generation_type', value: 'image' },
    { id: 'luma/ray-2', name: 'generation_type', value: 'video' },
    { id: 'luma/ray-flash-2', name: 'generation_type', value: 'video' },
    { id: 'byteplus/seededit-3-0-i2i-250628', name: 'size', value: 'adaptive' },
    { id: 'tencent/hunyuan-3d-part', name: 'file_type', value: 'FBX' },
    { id: 'tencent/hunyuan-3d-texture-edit', name: 'file_type', value: 'FBX' }
  ])('pins the only value $id accepts for $name', ({ id, name, value }) => {
    const contract = contractFor(id)

    expect({
      ...contract.defaultInput,
      ...contract.creator?.fixedValues
    }).toMatchObject({ [name]: value })
  })

  it('sends a pinned value it no longer asks for', async () => {
    const contract = contractFor('krea/krea-2')
    const schema = schemaForModel({
      fields: [],
      form: formForContract(contract)
    })

    const body = await prepareWorkshopRouterInput(
      contract,
      { ...defaultValues(schema), prompt: 'A watercolor fox' },
      new AbortController().signal
    )

    expect(body).toMatchObject({ resolution: '1K' })
  })
})
