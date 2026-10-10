import { describe, expect, it, vi } from 'vitest'

import { buildCampaignLinks, syncCampaignLinks } from './campaign-links'

function linkResponse(links: { id: string; fullUrl: string }[]) {
  return Response.json({ links })
}

describe('campaign link automation', () => {
  it('generates links for all eight vertical pages and both VFX v2 pages', () => {
    const links = buildCampaignLinks()
    expect(links.map(({ baseUrl }) => baseUrl)).toEqual([
      'https://comfy.org/vfx/',
      'https://comfy.org/vfx/v2/',
      'https://comfy.org/agency-led/vfx/',
      'https://comfy.org/agency-led/vfx/v2/',
      'https://comfy.org/advertising/',
      'https://comfy.org/agency-led/advertising/',
      'https://comfy.org/film-animation/',
      'https://comfy.org/agency-led/film-animation/',
      'https://comfy.org/architectural-visualization/',
      'https://comfy.org/agency-led/architectural-visualization/'
    ])
    expect(new Set(links.map(({ id }) => id)).size).toBe(10)
  })

  it('keeps creative, audience, campaign type and page version distinct', () => {
    const [link] = buildCampaignLinks({
      vertical: 'vfx',
      track: 'agency-led',
      version: 'v2',
      creative: 'studio_reel_02',
      audience: 'vfx_studios'
    })
    expect(link.fullUrl).toBe(
      'https://comfy.org/agency-led/vfx/v2/?utm_source=linkedin&utm_medium=ads&utm_campaign=agency_vfx&utm_content=studio_reel_02&utm_term=vfx_studios'
    )
    expect(
      buildCampaignLinks({ vertical: 'advertising', version: 'v2' })
    ).toEqual([])
    expect(buildCampaignLinks({ source: 'reddit' })[0]?.source).toBe('reddit')
  })

  it.for([
    { vertical: 'unknown' },
    { track: 'other' },
    { version: 'v3' },
    { source: 'LinkedIn' },
    { creative: 'creative&override=1' },
    { audience: 'audience with spaces' },
    { creative: '' }
  ])('rejects invalid campaign input %j', (input) => {
    expect(() => buildCampaignLinks(input)).toThrow()
  })

  it('skips existing and repeated links despite query order or deleted status', async () => {
    const links = buildCampaignLinks({
      vertical: 'vfx',
      track: 'comfy-led',
      version: 'v1'
    })
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        links: [
          {
            id: 'existing',
            isDeleted: true,
            fullUrl:
              'https://comfy.org/vfx/?utm_content=sizzle_video_01&utm_campaign=comfy_vfx&utm_medium=ads&utm_source=linkedin'
          }
        ]
      })
    )
    const report = await syncCampaignLinks([...links, ...links], {
      token: 'test',
      apply: true,
      request
    })
    expect(report).toMatchObject({ requested: 1, skipped: 1, created: 0 })
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toEqual([])
  })

  it('reports missing links without writing in check mode', async () => {
    const links = buildCampaignLinks({
      vertical: 'advertising',
      track: 'comfy-led'
    })
    const request = vi.fn<typeof fetch>().mockResolvedValue(linkResponse([]))
    const report = await syncCampaignLinks(links, { token: 'test', request })
    expect(report).toMatchObject({ created: 0, missing: [links[0]?.fullUrl] })
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toEqual([])
  })

  it('creates only missing drafts, verifies them and skips them on the next run', async () => {
    const links = buildCampaignLinks({ vertical: 'vfx', track: 'comfy-led' })
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(linkResponse(links.slice(0, 1)))
      .mockResolvedValueOnce(linkResponse(links.slice(1)))
      .mockResolvedValueOnce(linkResponse(links))
      .mockResolvedValueOnce(linkResponse(links))
    expect(
      await syncCampaignLinks(links, { token: 'test', apply: true, request })
    ).toMatchObject({ skipped: 1, created: 1 })
    expect(
      await syncCampaignLinks(links, { token: 'test', apply: true, request })
    ).toMatchObject({ skipped: 2, created: 0 })
    const writes = request.mock.calls.filter(
      ([, init]) => init?.method === 'POST'
    )
    expect(writes).toHaveLength(1)
    expect(writes[0]?.[0]).toBe(
      'https://utm-link-manager.pages.dev/api/links-batch'
    )
    expect(JSON.parse(String(writes[0]?.[1]?.body))).toEqual({
      action: 'create',
      links: links.slice(1)
    })
    expect(links[1]?.status).toBe('pending')
  })

  it('fails without requesting anything when the credential is missing', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(
      syncCampaignLinks(buildCampaignLinks(), { token: '', request })
    ).rejects.toThrow('not configured')
    expect(request).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'expired credential', response: new Response('', { status: 401 }) },
    {
      name: 'invalid response',
      response: Response.json({ links: [{ id: 'bad' }] })
    }
  ])('refuses to write after $name', async ({ response }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response)
    await expect(
      syncCampaignLinks(buildCampaignLinks(), {
        token: 'test',
        apply: true,
        request
      })
    ).rejects.toThrow()
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toEqual([])
  })

  it('does not report creation until every draft is read back', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(linkResponse([]))
      .mockResolvedValueOnce(linkResponse([]))
      .mockResolvedValueOnce(linkResponse([]))
    await expect(
      syncCampaignLinks(buildCampaignLinks(), {
        token: 'test',
        apply: true,
        request
      })
    ).rejects.toThrow('could not be verified')
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'POST')
    ).toHaveLength(1)
  })
})
