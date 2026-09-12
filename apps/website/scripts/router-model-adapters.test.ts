import { describe, expect, it } from 'vitest'
import { z } from 'astro/zod'

import { workshopContractSchema } from '../src/config/workshop-contract'
import { validateWorkshopInput } from '../src/config/workshop-json-schema'
import {
  parseRouterResponse,
  releaseRouterOutputs
} from '../src/config/workshop-response'
import { adaptRouterModel } from './router-model-adapters'
import contracts from '../src/content/workshop-router-contracts.json'

const source = workshopContractSchema.parse({
  id: 'bria/image-edit-gen-fill',
  sourceCommit: 'a'.repeat(40),
  inputSchema: { type: 'object' },
  output: {
    format: 'auto',
    contentTypes: ['application/json'],
    schema: {
      allOf: [{ $ref: '#/components/schemas/BriaStatusResponse' }],
      components: {
        schemas: {
          BriaStatusResponse: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['IN_PROGRESS', 'COMPLETED', 'ERROR', 'UNKNOWN']
              },
              request_id: { type: 'string' },
              result: {
                type: 'object',
                properties: {
                  image_url: { type: 'string' },
                  refined_prompt: { type: 'string' },
                  seed: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }
})
const completed = {
  status: 'COMPLETED',
  request_id: 'provider-request-id',
  result: {
    image_url: 'https://example.com/generated.png',
    refined_prompt: null,
    seed: 42
  }
}

describe('Bria generation response adapter', () => {
  it('accepts a completed image whose optional echoed refined prompt is null', async () => {
    if (source.output.format === 'binary' || !source.output.schema)
      throw new Error('Missing fixture schema')
    expect(validateWorkshopInput(completed, source.output.schema)).toBe(false)
    const outputs = await parseRouterResponse(
      adaptRouterModel(source),
      Response.json(completed)
    )
    try {
      expect(outputs[0]).toMatchObject({
        kind: 'image',
        url: completed.result.image_url
      })
      expect(validateWorkshopInput(completed, source.output.schema)).toBe(false)
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it.for([
    { ...completed, status: 'INVALID' },
    { ...completed, result: { ...completed.result, image_url: 123 } },
    { ...completed, result: { ...completed.result, refined_prompt: 123 } },
    { ...completed, result: { ...completed.result, seed: 'invalid' } }
  ])('retains validation of malformed provider responses', async (response) => {
    await expect(
      parseRouterResponse(adaptRouterModel(source), Response.json(response))
    ).rejects.toThrow('Invalid Router response')
  })
})

describe.for(['luma/photon-1', 'luma/photon-flash-1'])(
  '%s generated image selection',
  (id) => {
    const contract = adaptRouterModel(
      workshopContractSchema.parse(contracts.find((item) => item.id === id))
    )
    if (contract.output.format !== 'json')
      throw new Error('Missing Luma JSON output contract')
    const response = z
      .record(z.string(), z.unknown())
      .parse(contract.output.schema.example)
    const request = {
      ...z.record(z.string(), z.unknown()).parse(response.request),
      modify_image_ref: { url: 'https://example.com/source.png', weight: null }
    }

    it.for(['jpg', 'png', 'webp', ''])(
      'returns only the generated %s asset, excluding echoed input images',
      async (extension) => {
        const generated = `https://example.com/generated${extension ? `.${extension}` : ''}`
        const outputs = await parseRouterResponse(
          contract,
          Response.json({ ...response, request, assets: { image: generated } })
        )
        expect(outputs).toEqual([
          {
            kind: 'image',
            url: generated,
            fileName: `${id.replaceAll('/', '-')}-1.${extension || 'bin'}`,
            nsfw: false
          }
        ])
      }
    )

    it('rejects a completed response containing only the echoed source image', async () => {
      await expect(
        parseRouterResponse(
          contract,
          Response.json({ ...response, request, assets: { image: null } })
        )
      ).rejects.toThrow('Router returned no output')
    })

    it('rejects an unfinished generation even when an asset URL is present', async () => {
      await expect(
        parseRouterResponse(
          contract,
          Response.json({ ...response, request, state: 'dreaming' })
        )
      ).rejects.toThrow('Router did not return terminal success')
    })

    it('rejects a malformed completed asset', async () => {
      await expect(
        parseRouterResponse(
          contract,
          Response.json({ ...response, request, assets: { image: 123 } })
        )
      ).rejects.toThrow('Invalid Router response')
    })
  }
)
