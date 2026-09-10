import { describe, expect, it, vi } from 'vitest'

import { runWorkshopRouter } from './workshop-router'
import { prepareWorkshopRouterInput } from './workshop-request'
import { WorkshopRouterError } from './workshop-router-errors'
import { workshopContract } from './workshop-contract-catalog'
import { workshopContractSchema } from './workshop-contract'
import { z } from 'astro/zod'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import contracts from '../content/workshop-router-contracts.json'
import bindings from '../data/workshop-router-bindings.json'
import { validateWorkshopInput } from './workshop-json-schema'

function contractFor(id: string) {
  const contract = workshopContract(id)
  if (!contract) throw new Error('Missing test contract')
  return contract
}

describe('native Router requests', () => {
  it.for(['wavespeed/seedvr2', 'wavespeed/ultimate-image-upscaler'])(
    'preserves an image URL and rejects local/base64 placeholders for %s',
    async (id) => {
      const contract = contractFor(id)
      const signal = new AbortController().signal
      const url = 'https://example.com/image.png?token=abc%2F123'
      expect(
        await prepareWorkshopRouterInput(contract, { image: url }, signal)
      ).toEqual({ image: url })
      for (const image of [
        'image.png',
        'blob:local-image',
        'data:image/png;base64,AAAA',
        'https://',
        'https://example.com/a b.png',
        'https://example.com\\image.png',
        'https://user:password@example.com/image.png',
        'javascript:alert(1)'
      ]) {
        await expect(
          prepareWorkshopRouterInput(contract, { image }, signal)
        ).rejects.toMatchObject({ reason: 'validation' })
        await expect(
          prepareWorkshopRouterInput(
            contract,
            { request_body: JSON.stringify({ image }) },
            signal
          )
        ).rejects.toMatchObject({ reason: 'validation' })
      }
    }
  )
  it.for(
    contracts.filter((contract) =>
      bindings.some((binding) => binding.id === contract.catalogId)
    )
  )(
    'validates every enabled model against its authored native contract: $id',
    async (raw) => {
      const contract = workshopContractSchema.parse(raw)
      const detail = getRouterWorkshopModelDetail(
        raw.catalogId.replace('/', '--')
      )
      if (!detail) throw new Error('Missing catalog model')
      const schema = schemaForModel(detail)
      expect(validateForm(schema, defaultValues(schema))).toHaveProperty(
        'prompt',
        'required'
      )
      const example = z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .parse(contract.inputSchema.example)
      const values = {
        ...defaultValues(schema, example),
        prompt: 'A watercolor fox',
        seed: 123456
      }
      expect(validateForm(schema, values)).toEqual({})
      const body = await prepareWorkshopRouterInput(
        contract,
        values,
        new AbortController().signal
      )
      expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
      expect(body).toMatchObject({ prompt: 'A watercolor fox', seed: 123456 })
      expect(body).not.toHaveProperty('model')
      expect(body).not.toHaveProperty('medias')
      if (contract.output.format !== 'json')
        throw new Error('Expected JSON output')
      const fetch = vi
        .fn()
        .mockResolvedValue(Response.json(contract.output.schema.example))
      vi.stubGlobal('fetch', fetch)
      const result = await runWorkshopRouter({
        contract,
        body,
        token: 'test-token',
        idempotencyKey: 'test-key',
        signal: new AbortController().signal
      })
      expect(fetch).toHaveBeenCalledOnce()
      expect(result.outputs.length).toBeGreaterThan(0)
      expect(result.outputs[0].url).toMatch(/^https:\/\//)
    }
  )

  it('preserves native Advanced fields and rejects unsupported or mis-sized inputs', async () => {
    const signal = new AbortController().signal
    expect(
      await prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-max'),
        {
          prompt: 'Test',
          output_format: 'png',
          safety_tolerance: 3,
          prompt_upsampling: false
        },
        signal
      )
    ).toEqual({
      prompt: 'Test',
      output_format: 'png',
      safety_tolerance: 3,
      prompt_upsampling: false
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', safety_tolerance: 3 },
        signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          request_body: JSON.stringify({ prompt: 'Test', safety_tolerance: 3 })
        },
        signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-pro-1.1'),
        { prompt: 'Test', width: 1023 },
        signal
      )
    ).rejects.toMatchObject({ fieldErrors: { width: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-kontext-max'),
        { prompt: 'Test', guidance: 7 },
        signal
      )
    ).rejects.toMatchObject({ fieldErrors: { guidance: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-pro-1.1-ultra'),
        { prompt: 'Test', image_prompt_strength: 1.1 },
        signal
      )
    ).rejects.toMatchObject({
      fieldErrors: { image_prompt_strength: 'rejected' }
    })
  })

  it('preserves optional and Advanced scalar values and encodes the actual selected images', async () => {
    const first = new File(['image bytes'], 'one.png', { type: 'image/png' })
    const second = new File(['different bytes'], 'two.png', {
      type: 'image/png'
    })
    const body = await prepareWorkshopRouterInput(
      workshopContract('bfl/flux-2-pro'),
      {
        prompt: ' A prompt ',
        seed: 100001,
        width: 1024,
        height: 768,
        prompt_upsampling: false,
        media_image: [first, second].map((file) => ({
          file,
          name: file.name,
          size: file.size,
          type: file.type
        }))
      },
      new AbortController().signal
    )
    expect(body).toEqual({
      prompt: ' A prompt ',
      seed: 100001,
      width: 1024,
      height: 768,
      prompt_upsampling: false,
      input_image: btoa('image bytes'),
      input_image_2: btoa('different bytes')
    })
    expect(body).not.toHaveProperty('medias')
    expect(body).not.toHaveProperty('model')
  })

  it('does not invent defaults and refuses unknown mappings, invalid inputs, or fake uploads', async () => {
    const signal = new AbortController().signal
    expect(
      await prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', seed: undefined },
        signal
      )
    ).toEqual({ prompt: 'Test' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('missing/model'),
        { prompt: 'Test' },
        signal
      )
    ).rejects.toMatchObject({ reason: 'unavailable' })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', width: 0 },
        signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { width: 'rejected' }
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          prompt: 'Test',
          media_image: { name: 'example.png', size: 1, type: 'image/png' }
        },
        signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { media_image: 'required' }
    })
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        { prompt: 'Test', unknown_knob: 1 },
        signal
      )
    ).rejects.toBeInstanceOf(WorkshopRouterError)
  })

  it('calls /v2/models with the workspace bearer, keeps the request ID and reads native output', async () => {
    const requests: Request[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push(new Request(url, init))
      return Response.json(
        {
          id: 'provider-job',
          status: 'Ready',
          result: { sample: 'https://assets.example/result.jpg' }
        },
        { headers: { 'X-Comfy-Request-Id': 'request-123' } }
      )
    })
    const result = await runWorkshopRouter({
      contract: contractFor('bfl/flux-2-pro'),
      body: { prompt: 'Test', seed: 42 },
      token: 'test-workspace-token',
      idempotencyKey: 'same-logical-run',
      signal: new AbortController().signal
    })
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe(
      'https://stagingapi.comfy.org/v2/models/bfl/flux-2-pro'
    )
    expect(requests[0].headers.get('Authorization')).toBe(
      'Bearer test-workspace-token'
    )
    expect(requests[0].headers.get('X-API-Key')).toBeNull()
    expect(requests[0].headers.get('Idempotency-Key')).toBe('same-logical-run')
    expect(await requests[0].json()).toEqual({ prompt: 'Test', seed: 42 })
    expect(result.requestId).toBe('request-123')
    expect(result.outputs[0].url).toBe('https://assets.example/result.jpg')
  })

  it('checks the total base64 request size before reading files or sending a request', async () => {
    const file = new File([new Uint8Array(4 * 1024 * 1024)], 'large.png', {
      type: 'image/png'
    })
    const read = vi.spyOn(file, 'arrayBuffer')
    const selected = { file, name: file.name, type: file.type, size: file.size }
    await expect(
      prepareWorkshopRouterInput(
        workshopContract('bfl/flux-2-pro'),
        {
          prompt: 'Test',
          media_image: [selected, selected]
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { media_image: 'requestTooLarge' }
    })
    expect(read).not.toHaveBeenCalled()

    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: '汉'.repeat(4 * 1024 * 1024) },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { request_body: 'requestTooLarge' }
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports errors without silently retrying a paid request', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 402,
        headers: { 'X-Comfy-Request-Id': 'failed-request' }
      })
    )
    vi.stubGlobal('fetch', fetch)
    await expect(
      runWorkshopRouter({
        contract: contractFor('bfl/flux-2-pro'),
        body: { prompt: 'Test' },
        token: 'test-token',
        idempotencyKey: 'one-key',
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      reason: 'noCredits',
      requestId: 'failed-request'
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not treat a provider error document or an unsafe output URL as a successful result', async () => {
    for (const data of [
      { status: 'Error' },
      { status: 'Ready', result: { sample: 'javascript:alert(1)' } }
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)))
      await expect(
        runWorkshopRouter({
          contract: contractFor('bfl/flux-2-pro'),
          body: { prompt: 'Test' },
          token: 'test-token',
          idempotencyKey: 'one-key',
          signal: new AbortController().signal
        })
      ).rejects.toMatchObject({ reason: 'provider' })
    }
  })
})
