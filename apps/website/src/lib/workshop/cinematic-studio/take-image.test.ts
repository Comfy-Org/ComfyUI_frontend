import { describe, expect, it, vi } from 'vitest'

import { getAuthoredRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import { acceptsLinks, imageInput, keepTake } from './take-image'

const LINK =
  'https://ark-content-generation-v2-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream/take.jpeg?X-Tos-Signature=x'

function serve(ok: boolean) {
  vi.mocked(fetch).mockImplementation(async () => {
    if (!ok) throw new TypeError('Failed to fetch')
    return new Response(new Blob(['still'], { type: 'image/jpeg' }))
  })
}

describe('keepTake', () => {
  it('keeps the link of a take the page may not read', async () => {
    serve(false)
    await expect(keepTake(LINK, 'take.jpeg')).resolves.toEqual({
      url: LINK,
      name: 'take.jpeg'
    })
  })

  it('keeps the link and the picture when the page can read it', async () => {
    serve(true)
    const kept = await keepTake(LINK, 'take.jpeg')
    expect(kept).toMatchObject({ url: LINK, file: expect.any(File) })
  })

  it('reads a picture the page holds, since no server can fetch it', async () => {
    serve(true)
    await expect(keepTake('blob:take', 'take.png')).resolves.toBeInstanceOf(
      File
    )
    serve(false)
    await expect(keepTake('blob:take', 'take.png')).resolves.toBeUndefined()
  })
})

describe('imageInput', () => {
  const file = new File(['still'], 'take.jpeg', { type: 'image/jpeg' })

  it('sends the link to a model that fetches it, the picture otherwise', () => {
    expect(imageInput({ url: LINK, name: 'take', file }, true)).toBe(LINK)
    expect(imageInput({ url: LINK, name: 'take', file }, false)).toBe(file)
    expect(imageInput({ url: LINK, name: 'take' }, false)).toBeUndefined()
    expect(imageInput(file, true)).toBe(file)
  })
})

describe('acceptsLinks', () => {
  const contract = (slug: string) =>
    getAuthoredRouterWorkshopModelDetail(slug)?.execution

  it('reads which inputs a model fetches itself', () => {
    expect(
      acceptsLinks(
        contract('qwen--qwen-image-3.0-text-to-image--generate-images'),
        'reference_images'
      )
    ).toBe(true)
    expect(
      acceptsLinks(
        contract('byteplus--seedream-5-pro--edit-images'),
        'reference_images'
      )
    ).toBe(false)
    expect(
      acceptsLinks(
        contract('byteplus--seedance-2-5-first-last-frame--animate-images'),
        'first_frame'
      )
    ).toBe(true)
    expect(
      acceptsLinks(
        contract('byteplus--seedance-2-mini-text-to-video--generate-videos'),
        'first_frame'
      )
    ).toBe(false)
  })
})
