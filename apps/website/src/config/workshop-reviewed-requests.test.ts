import { describe, expect, it, vi } from 'vitest'

import { workshopContract } from './workshop-contract-catalog'
import { formForContract } from './workshop-contract'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { prepareWorkshopRouterInput } from './workshop-request'
import { prepareWorkshopRequestCallback } from './workshop-request-callbacks'
import { validateWorkshopInput } from './workshop-json-schema'
import { workshopExampleValues } from './workshop-example-values'

function contractFor(id: string) {
  const contract = workshopContract(id)
  if (!contract) throw new Error(`Missing fixture contract ${id}`)
  return contract
}

function image(name = 'source.png') {
  const file = new File([new Uint8Array([0, 1, 255, 34])], name, {
    type: 'image/png'
  })
  return { file, name, type: file.type, size: file.size }
}

describe('reviewed model request regressions', () => {
  it('preserves reference image order beyond the originally hardcoded three inputs', () => {
    const urls = {
      image_url_10: 'ten',
      image_url_4: 'four',
      image_url_2: 'two',
      image_url: 'one',
      prompt: 'Prompt'
    }
    expect(
      prepareWorkshopRequestCallback(
        { kind: 'callback', callback: 'qwen-image', options: {} },
        { values: urls, files: {} }
      )
    ).toHaveProperty('input.messages.0.content', [
      { image: 'one' },
      { image: 'two' },
      { image: 'four' },
      { image: 'ten' },
      { text: 'Prompt' }
    ])
    const references = {
      reference_image_url_10: 'ten',
      reference_image_url_2: 'two',
      reference_image_url: 'one',
      prompt: 'Prompt'
    }
    const grok = prepareWorkshopRequestCallback(
      { kind: 'callback', callback: 'grok-video', options: {} },
      { values: references, files: {} }
    )
    expect(grok).toEqual({
      prompt: 'Prompt',
      reference_images: [{ url: 'one' }, { url: 'two' }, { url: 'ten' }]
    })
    const seedance = prepareWorkshopRequestCallback(
      { kind: 'callback', callback: 'seedance', options: {} },
      { values: references, files: {} }
    )
    expect(seedance).toEqual({
      content: [
        { type: 'text', text: 'Prompt' },
        ...['one', 'two', 'ten'].map((url) => ({
          type: 'image_url',
          role: 'reference_image',
          image_url: { url }
        }))
      ]
    })
  })

  it.for([
    {
      id: 'luma/photon-1',
      slug: 'luma--photon-1-image-modify--edit-images',
      agents: false
    },
    {
      id: 'luma_2/uni-1',
      slug: 'luma_2--uni-1-image-edit--edit-images',
      agents: true
    }
  ])(
    'keeps required edit sources separate from optional reference images for $id',
    async ({ id, slug, agents }) => {
      const edited = getRouterWorkshopModelDetail(slug)
      if (!edited?.execution) throw new Error(`Missing edit fixture ${slug}`)
      const contract = contractFor(id)
      const source = 'https://example.com/source.png'
      const fields = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      const editFields = schemaForModel(edited)
      expect(fields.find((field) => field.name === 'image_url')).toHaveProperty(
        'required',
        false
      )
      expect(
        editFields.find((field) => field.name === 'image_url')
      ).toHaveProperty('required', true)
      const reference = await prepareWorkshopRouterInput(
        contract,
        { ...defaultValues(fields), prompt: 'My prompt', image_url: source },
        new AbortController().signal
      )
      expect(reference).toHaveProperty('image_ref', [{ url: source }])
      expect(reference).not.toHaveProperty('source')
      expect(reference).not.toHaveProperty('modify_image_ref')
      const edit = await prepareWorkshopRouterInput(
        edited.execution,
        { ...defaultValues(editFields), prompt: 'My edit', image_url: source },
        new AbortController().signal
      )
      expect(edit).toHaveProperty(agents ? 'source' : 'modify_image_ref', {
        url: source
      })
      expect(edit).not.toHaveProperty('image_ref')
    }
  )

  it.for(['bfl/flux-pro-1.0-fill', 'bfl/flux-pro-1.0-expand'])(
    'renders uploads instead of Base64 textboxes and encodes the exact bytes for %s',
    async (id) => {
      const contract = contractFor(id)
      const fields = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      expect(
        fields.find((field) => field.name === 'media_image')
      ).toMatchObject({ kind: 'file', required: true })
      expect(
        fields.some((field) => field.name === 'image' || field.name === 'mask')
      ).toBe(false)
      const file = image()
      const body = await prepareWorkshopRouterInput(
        contract,
        {
          ...defaultValues(fields),
          prompt: 'Expand the scene',
          media_image: file,
          ...(id.endsWith('fill')
            ? { media_mask: image('mask.png') }
            : { top: 64 })
        },
        new AbortController().signal
      )
      expect(body.image).toBe('AAH/Ig==')
      if (id.endsWith('fill')) expect(body.mask).toBe('AAH/Ig==')
      expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
      await expect(
        prepareWorkshopRouterInput(
          contract,
          { prompt: 'No upload' },
          new AbortController().signal
        )
      ).rejects.toMatchObject({ fieldErrors: { media_image: 'required' } })
    }
  )

  it('preserves the order, voices, escaping, and repeated speaker turns of a dialogue', async () => {
    const contract = contractFor('elevenlabs/eleven_v3')
    const turns = [
      { text: 'A "quoted" line\nwith \\ escapes', voice_id: 'speaker-a' },
      { text: 'A reply', voice_id: 'speaker-b' },
      { text: 'And back again', voice_id: 'speaker-a' }
    ]
    const body = await prepareWorkshopRouterInput(
      contract,
      { inputs: JSON.stringify(turns), seed: 0 },
      new AbortController().signal
    )
    expect(body).toMatchObject({ inputs: turns, seed: 0 })
    expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
    expect(workshopExampleValues(contract, { inputs: turns })).toEqual({
      inputs: JSON.stringify(turns)
    })
  })

  it('allows repeated turns but rejects more than ten distinct dialogue voices or partial rows', async () => {
    const contract = contractFor('elevenlabs/eleven_v3')
    const turns = Array.from({ length: 11 }, (_, index) => ({
      text: `Turn ${index}`,
      voice_id: `voice-${index}`
    }))
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { inputs: JSON.stringify(turns) },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ fieldErrors: { inputs: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        {
          inputs: JSON.stringify(
            turns.map((turn) => ({ ...turn, voice_id: 'same-voice' }))
          )
        },
        new AbortController().signal
      )
    ).resolves.toHaveProperty('inputs.length', 11)
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { inputs: JSON.stringify([{ text: 'Missing voice', voice_id: '' }]) },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ fieldErrors: { inputs: 'required' } })
  })

  it('sends the published Ideogram structured example as a JSON object, never as natural-language text', async () => {
    const model = getRouterWorkshopModelDetail('ideogram--v4--generate-images')
    if (!model?.execution) throw new Error('Missing published Ideogram model')
    const fields = schemaForModel(model)
    const values = defaultValues(fields, model.defaults)
    expect(validateForm(fields, values)).toEqual({})
    expect(values.prompt).toEqual(expect.any(String))
    const body = await prepareWorkshopRouterInput(
      model.execution,
      values,
      new AbortController().signal
    )
    expect(body).not.toHaveProperty('text_prompt')
    expect(body.json_prompt).toHaveProperty('high_level_description')
    expect(validateWorkshopInput(body, model.execution.inputSchema)).toBe(true)
  })

  it('does not guess that literal braces in a text prompt should change the request mode', () => {
    expect(
      prepareWorkshopRequestCallback(
        { kind: 'callback', callback: 'ideogram', options: { mode: 'text' } },
        { values: { prompt: '{words, not JSON}' }, files: {} }
      )
    ).toEqual({ text_prompt: '{words, not JSON}' })
    expect(() =>
      prepareWorkshopRequestCallback(
        { kind: 'callback', callback: 'ideogram', options: { mode: 'json' } },
        { values: { prompt: '{broken' }, files: {} }
      )
    ).toThrow()
  })

  it('loads extensionless examples using the expected preview type, then verifies the actual MIME before encoding', async () => {
    const contract = contractFor('bfl/flux-pro-1.0-expand')
    const fields = schemaForModel({
      fields: [],
      form: formForContract(contract)
    })
    const values = defaultValues(fields, {
      media_image: 'https://example.com/media?id=123'
    })
    expect(validateForm(fields, values)).toEqual({})
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0, 1, 255, 34]), {
        headers: { 'Content-Type': 'image/png' }
      })
    )
    vi.stubGlobal('fetch', fetcher)
    try {
      const body = await prepareWorkshopRouterInput(
        contract,
        values,
        new AbortController().signal
      )
      expect(body.image).toBe('AAH/Ig==')
      fetcher.mockResolvedValue(
        new Response('wrong type', { headers: { 'Content-Type': 'text/html' } })
      )
      const other = defaultValues(fields, {
        media_image: 'https://example.com/media?id=456'
      })
      await expect(
        prepareWorkshopRouterInput(
          contract,
          other,
          new AbortController().signal
        )
      ).rejects.toMatchObject({ fieldErrors: { media_image: 'uploadFailed' } })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
