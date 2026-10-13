import { fetchRequests } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import type { DarkroomItem } from '@/lib/darkroom/store'

import {
  darkroomAssetForm,
  darkroomAssetMetadata,
  saveDarkroomAsset
} from './darkroom-cloud-assets'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const item: DarkroomItem = {
  id: 'item-1',
  created: 1,
  mime: 'image/png',
  settings: {
    prompt: 'A fox reading a map',
    model: 'vertexai/gemini-nano-banana-2.1',
    aspectRatio: '16:9',
    imageSize: '2K',
    mimeType: 'image/png',
    temperature: 1,
    thinkingLevel: 'HIGH',
    system: 'soft grain',
    seed: 1234,
    jobId: 'job-1',
    run: 2,
    runs: 4,
    inputCount: 0
  },
  stats: { finishReasons: ['STOP'] },
  text: []
}
const blob = new Blob(['pixels'], { type: 'image/png' })
const signal = () => new AbortController().signal

describe('darkroomAssetForm', () => {
  it('tags the image as a Darkroom output and names it from the prompt', () => {
    const form = darkroomAssetForm(item, blob)

    expect(form.get('name')).toBe('a-fox-reading-a-map_s1234.png')
    expect(form.get('mime_type')).toBe('image/png')
    expect(form.get('tags')).toBe('["output","darkroom"]')
    expect(form.get('file')).toBeInstanceOf(Blob)
  })

  // Cloud drops any field that arrives after the file, so the asset would be
  // stored untagged and never appear in the library.
  it('sends every field before the file', () => {
    expect([...darkroomAssetForm(item, blob).keys()]).toEqual([
      'name',
      'mime_type',
      'tags',
      'user_metadata',
      'file'
    ])
  })

  it('carries the prompt and settings as metadata', () => {
    expect(darkroomAssetMetadata(item)).toEqual({
      source: 'comfy-darkroom',
      prompt: 'A fox reading a map',
      model: 'vertexai/gemini-nano-banana-2.1',
      seed: 1234,
      aspect_ratio: '16:9',
      image_size: '2K',
      temperature: 1,
      thinking_level: 'HIGH',
      style_notes: 'soft grain',
      darkroom_job_id: 'job-1',
      darkroom_run: 2
    })
  })
})

describe('saveDarkroomAsset', () => {
  it("uploads to the account's Cloud library and returns the asset id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ id: 'asset-1', created_new: true }, { status: 201 })
    )

    expect(await saveDarkroomAsset(item, blob, 'test-token', signal())).toBe(
      'asset-1'
    )
    const [request] = fetchRequests()
    expect(request.url).toBe(`${WORKSHOP_CLOUD_BASE_URL}/api/assets`)
    expect(request.method).toBe('POST')
    expect(request.headers.get('Authorization')).toBe('Bearer test-token')
    expect(request.body).toBeInstanceOf(FormData)
  })

  it.for([
    new Response(null, { status: 403 }),
    Response.json({ created_new: true })
  ])('fails when Cloud does not keep the image', async (response) => {
    vi.mocked(fetch).mockResolvedValueOnce(response)

    await expect(
      saveDarkroomAsset(item, blob, 'test-token', signal())
    ).rejects.toThrow('Cloud asset upload')
  })
})
