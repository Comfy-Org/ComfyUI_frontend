import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runWorkshopRouter } from '@/config/workshop-router-queue'
import { routerAnchor } from './anchor'
import sunburstPage from './__fixtures__/gpt-image-sunburst-page.json' with { type: 'json' }

vi.mock(import('@/config/workshop-router-queue'), () => ({
  runWorkshopRouter: vi.fn()
}))
vi.mock(import('./frame'), () => ({
  frameAt: vi.fn(async () => new Blob(['frame'], { type: 'image/png' }))
}))

const PAGE = '/models/openai--gpt-image-2.5-sunburst--generate-images/page.json'
const ANCHOR = 'blob:anchor-image'

function serve(page: unknown) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input)
    if (url === PAGE) return Response.json(page)
    if (url === ANCHOR)
      return new Response(new Blob(['anchor'], { type: 'image/png' }))
    return new Response(null, { status: 404 })
  })
}

const options = () => ({
  video: new File(['clip'], 'clip.mp4', { type: 'video/mp4' }),
  start: 2,
  character: new File(['hero'], 'hero.png', { type: 'image/png' }),
  token: async () => 'token',
  signal: new AbortController().signal
})

beforeEach(() => {
  serve(sunburstPage)
  vi.mocked(runWorkshopRouter).mockResolvedValue({
    outputs: [{ kind: 'image', url: ANCHOR, fileName: 'anchor.png' }],
    requestId: 'req-1',
    deadlineCollections: 0
  })
})

describe('routerAnchor', () => {
  it('asks GPT Image 2.5 sunburst at low quality to put the character, outfit included, into the frame', async () => {
    await routerAnchor(options())

    const call = vi.mocked(runWorkshopRouter).mock.calls.at(0)?.at(0)
    expect(call?.contract.id).toBe('openai/gpt-image-2.5-sunburst')
    expect(call?.token).toBe('token')
    expect(call?.body).toMatchObject({ quality: 'low', size: 'auto', n: 1 })
    expect(String(call?.body.prompt)).toContain('complete outfit')
    const images = call?.body.image
    expect(Array.isArray(images) && images).toHaveLength(2)
    expect(
      Array.isArray(images) &&
        images.every((image) =>
          String(image).startsWith('data:image/png;base64,')
        )
    ).toBe(true)
  })

  it('returns the generated image as a file to upload', async () => {
    const anchor = await routerAnchor(options())

    expect(anchor).toBeInstanceOf(File)
    expect(anchor.name).toBe('anchor.png')
    expect(await anchor.text()).toBe('anchor')
  })

  it('fails when Router returns no image', async () => {
    vi.mocked(runWorkshopRouter).mockResolvedValue({
      outputs: [],
      requestId: 'req-2',
      deadlineCollections: 0
    })

    await expect(routerAnchor(options())).rejects.toThrow(
      'anchor image missing'
    )
  })

  it('fails without calling Router when the model page cannot be read', async () => {
    serve({ kind: 'page' })

    await expect(routerAnchor(options())).rejects.toThrow()
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })
})
