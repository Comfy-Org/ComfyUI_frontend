import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  buildCampaignLinks,
  campaignFailureMessage,
  main,
  runCampaignLinks,
  syncCampaignLinks
} from './campaign-links'

const linksRoute = {
  method: 'GET',
  url: 'https://utm-link-manager.pages.dev/api/links'
}
const validationRoute = {
  method: 'POST',
  url: 'https://utm-link-manager.pages.dev/api/links/validate'
}
const creationRoute = {
  method: 'POST',
  url: 'https://utm-link-manager.pages.dev/api/links-batch'
}

type Link = ReturnType<typeof buildCampaignLinks>[number]
type SavedLink = Pick<Link, 'fullUrl'>

function linkResponse(links: SavedLink[]) {
  return Response.json({ links })
}

function cleanValidationResponse(count: number) {
  return Response.json({
    results: Array.from({ length: count }, (_, index) => ({
      index,
      errors: [],
      warnings: [],
      existingLinks: []
    }))
  })
}

function postedLinks(body: RequestInit['body']) {
  const payload: unknown = JSON.parse(String(body))
  assert(typeof payload === 'object' && payload !== null)
  assert('links' in payload && Array.isArray(payload.links))
  return payload.links.map((link: unknown) => {
    assert(typeof link === 'object' && link !== null)
    assert('id' in link && typeof link.id === 'string')
    assert('fullUrl' in link && typeof link.fullUrl === 'string')
    return { id: link.id, fullUrl: link.fullUrl }
  })
}

function installManager({
  saved = [],
  rejectedIds = [],
  unsavedIds = []
}: {
  saved?: SavedLink[]
  rejectedIds?: string[]
  unsavedIds?: string[]
} = {}) {
  const records = [...saved]
  respondToFetch(linksRoute, () => linkResponse(records))
  respondToFetch(validationRoute, (_, init) =>
    cleanValidationResponse(postedLinks(init?.body).length)
  )
  respondToFetch(creationRoute, (_, init) => {
    const submitted = postedLinks(init?.body)
    for (const link of submitted) {
      if (rejectedIds.includes(link.id))
        return new Response('private provider collision', { status: 500 })
      if (!unsavedIds.includes(link.id)) records.push(link)
    }
    return Response.json({ links: submitted })
  })
  return records
}

function vfxLinks() {
  return buildCampaignLinks({
    vertical: 'vfx',
    track: 'comfy-led',
    version: 'v2'
  })
}

describe('campaign link automation', () => {
  it('reports API status without including the provider response', async () => {
    respondToFetch(
      linksRoute,
      () => new Response('private provider data', { status: 403 })
    )
    expect(
      await syncCampaignLinks(buildCampaignLinks(), { token: 'test' }).catch(
        campaignFailureMessage
      )
    ).toBe('UTM Manager GET /links failed (403)')
  })

  it.for([
    {
      name: 'output path failure',
      error: new Error('secret output path'),
      kind: 'Error'
    },
    {
      name: 'network failure',
      error: new TypeError('secret network data'),
      kind: 'TypeError'
    },
    {
      name: 'parse failure',
      error: new SyntaxError('secret response body'),
      kind: 'SyntaxError'
    },
    {
      name: 'timeout',
      error: new DOMException('secret timeout', 'TimeoutError'),
      kind: 'TimeoutError'
    },
    { name: 'non-error throw', error: 'secret untyped failure', kind: 'string' }
  ])('redacts $name', ({ error, kind }) => {
    expect(campaignFailureMessage(error)).toBe(
      `Campaign link run failed (${kind}). Check the inputs and the run log before rerunning.`
    )
  })

  it('generates unique links only for supported campaign destinations', () => {
    const links = buildCampaignLinks()
    expect(links.map(({ baseUrl }) => baseUrl)).toEqual([
      'https://comfy.org/solutions/vfx/',
      'https://comfy.org/agency-led/vfx/',
      'https://comfy.org/agency-led/vfx/v2/',
      'https://comfy.org/agency-led/advertising/',
      'https://comfy.org/agency-led/film-animation/',
      'https://comfy.org/agency-led/architectural-visualization/'
    ])
    expect(new Set(links.map(({ id }) => id)).size).toBe(6)
  })

  it('targets Comfy VFX with creative and audience attribution', () => {
    expect(
      buildCampaignLinks({
        vertical: 'vfx',
        track: 'comfy-led',
        version: 'v2',
        creative: 'workflow_demo_02',
        audience: 'vfx_studios'
      }).map(({ fullUrl }) => fullUrl)
    ).toEqual([
      'https://comfy.org/solutions/vfx/?utm_source=linkedin&utm_medium=ads&utm_campaign=comfy_vfx&utm_content=workflow_demo_02&utm_term=vfx_studios'
    ])
    expect(
      buildCampaignLinks({ vertical: 'vfx', track: 'comfy-led', version: 'v1' })
    ).toEqual([])
  })

  it('keeps creative, audience, track and version distinct', () => {
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
    expect(buildCampaignLinks({ source: 'reddit' })[0].source).toBe('reddit')
    expect(
      buildCampaignLinks({ creative: 'different_creative' })[0].id
    ).not.toBe(vfxLinks()[0].id)
    expect(buildCampaignLinks().map(({ id }) => id)).toEqual(
      buildCampaignLinks().map(({ id }) => id)
    )
  })

  it.for([
    { env: 'CAMPAIGN_VERTICAL', value: 'unknown', message: 'Unknown vertical' },
    {
      env: 'CAMPAIGN_TRACK',
      value: 'other',
      message: 'Unknown campaign track'
    },
    { env: 'CAMPAIGN_VERSION', value: 'v3', message: 'Unknown page version' }
  ])(
    'rejects invalid $env with an actionable message',
    async ({ env, value, message }) => {
      vi.stubEnv(env, value)
      expect(
        await runCampaignLinks('preview').catch(campaignFailureMessage)
      ).toBe(message)
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it.for([
    { input: { source: 'LinkedIn' }, message: 'Tracking values must use' },
    {
      input: { creative: 'creative&override=1' },
      message: 'Tracking values must use'
    },
    {
      input: { audience: 'audience with spaces' },
      message: 'Tracking values must use'
    },
    { input: { creative: '' }, message: 'Source and creative are required' }
  ])('rejects $input with an actionable message', ({ input, message }) => {
    expect(() => buildCampaignLinks(input)).toThrowError(
      expect.toSatisfy((error: unknown) =>
        campaignFailureMessage(error).startsWith(message)
      )
    )
  })

  it('skips existing URLs despite query order and absent manager IDs', async () => {
    installManager({
      saved: [
        {
          fullUrl:
            'https://comfy.org/solutions/vfx/?utm_content=sizzle_video_01&utm_campaign=comfy_vfx&utm_medium=ads&utm_source=linkedin'
        }
      ]
    })
    expect(
      await syncCampaignLinks(vfxLinks(), {
        token: 'test',
        mode: 'create-drafts'
      })
    ).toMatchObject({ requested: 1, skipped: 1, created: 0, missing: [] })
    expect(fetchRequests({ method: 'POST' })).toEqual([])
  })

  it('reports missing links without writing in check mode', async () => {
    const links = vfxLinks()
    installManager()
    expect(await syncCampaignLinks(links, { token: 'test' })).toMatchObject({
      created: 0,
      missing: [links[0].fullUrl]
    })
    expect(fetchRequests(creationRoute)).toEqual([])
  })

  it('creates only missing drafts, verifies their URLs and skips the next run', async () => {
    const links = ['sizzle_video_01', 'workflow_demo_02'].flatMap((creative) =>
      buildCampaignLinks({
        vertical: 'vfx',
        track: 'comfy-led',
        version: 'v2',
        creative
      })
    )
    const saved = installManager({ saved: links.slice(0, 1) })
    expect(
      await syncCampaignLinks(links, { token: 'test', mode: 'create-drafts' })
    ).toMatchObject({
      skipped: 1,
      created: 1,
      missing: [],
      requiresReview: false
    })
    expect(saved.map(({ fullUrl }) => fullUrl)).toEqual(
      links.map(({ fullUrl }) => fullUrl)
    )
    expect(
      await syncCampaignLinks(links, { token: 'test', mode: 'create-drafts' })
    ).toMatchObject({ skipped: 2, created: 0 })
    const writes = fetchRequests(creationRoute)
    expect(writes).toHaveLength(1)
    expect(JSON.parse(String(writes[0].body))).toEqual({
      action: 'create',
      links: links.slice(1)
    })
    expect(writes[0].headers.get('Authorization')).toBe('Bearer test')
    expect(JSON.parse(String(fetchRequests(validationRoute)[0].body))).toEqual({
      links: links.slice(1)
    })
  })

  it('continues past an ID collision and skips successful drafts on rerun', async () => {
    const [first, collision, last] = buildCampaignLinks({ vertical: 'vfx' })
    const saved = installManager({ rejectedIds: [collision.id] })
    const firstRun = await syncCampaignLinks([first, collision, last], {
      token: 'test',
      mode: 'create-drafts'
    })
    expect(saved.map(({ fullUrl }) => fullUrl)).toEqual([
      first.fullUrl,
      last.fullUrl
    ])
    expect(firstRun).toMatchObject({
      requested: 3,
      skipped: 0,
      created: 2,
      missing: [collision.fullUrl],
      requiresReview: true,
      creationFailures: [
        {
          fullUrl: collision.fullUrl,
          message: 'UTM Manager POST /links-batch failed (500)'
        }
      ]
    })
    expect(
      await syncCampaignLinks([first, collision, last], {
        token: 'test',
        mode: 'create-drafts'
      })
    ).toMatchObject({
      skipped: 2,
      created: 0,
      missing: [collision.fullUrl],
      requiresReview: true
    })
    expect(
      fetchRequests(creationRoute).map(({ body }) =>
        postedLinks(body).map(({ fullUrl }) => fullUrl)
      )
    ).toEqual([
      [first.fullUrl],
      [collision.fullUrl],
      [last.fullUrl],
      [collision.fullUrl]
    ])
  })

  it('fails without any request for a whitespace-only credential', async () => {
    await expect(
      syncCampaignLinks(buildCampaignLinks(), { token: ' \n' })
    ).rejects.toThrow('not configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'expired credential',
      response: () => new Response('', { status: 401 }),
      message: 'failed (401)'
    },
    {
      name: 'invalid response',
      response: () => Response.json({ links: [{ id: 'bad' }] }),
      message: 'invalid link record'
    }
  ])('refuses to write after $name', async ({ response, message }) => {
    respondToFetch(linksRoute, response)
    await expect(
      syncCampaignLinks(buildCampaignLinks(), {
        token: 'test',
        mode: 'create-drafts'
      })
    ).rejects.toThrow(message)
    expect(fetchRequests({ method: 'POST' })).toEqual([])
  })

  it('does not count an unsaved draft when read-back contains an unrelated replacement', async () => {
    const [unsaved, ...saved] = buildCampaignLinks()
    installManager({
      saved: [{ fullUrl: 'https://comfy.org/' }],
      unsavedIds: [unsaved.id]
    })
    const report = await syncCampaignLinks([unsaved, ...saved], {
      token: 'test',
      mode: 'create-drafts'
    })
    expect(report).toMatchObject({
      created: 5,
      missing: [unsaved.fullUrl],
      requiresReview: true
    })
  })

  it('reports warnings without blocking draft creation', async () => {
    const links = vfxLinks()
    installManager()
    respondToFetch(validationRoute, () =>
      Response.json({
        results: [
          {
            index: 0,
            errors: [],
            warnings: [
              { code: 'campaign_reuse', message: 'Review campaign reuse' }
            ],
            existingLinks: []
          }
        ]
      })
    )
    const report = await syncCampaignLinks(links, {
      token: 'test',
      mode: 'create-drafts'
    })
    expect(report).toMatchObject({
      created: 1,
      missing: [],
      requiresReview: false
    })
    expect(report.validation).toEqual([
      {
        fullUrl: links[0].fullUrl,
        errors: [],
        warnings: [
          { code: 'campaign_reuse', message: 'Review campaign reuse' }
        ],
        existingMatches: 0
      }
    ])
  })

  it.for([
    {
      name: 'errors',
      result: {
        errors: [{ code: 'invalid_base_url', message: 'Invalid destination' }],
        warnings: [],
        existingLinks: []
      }
    },
    {
      name: 'new duplicates',
      result: {
        errors: [],
        warnings: [],
        existingLinks: [{ id: 'concurrent-link', status: 'pending' }]
      }
    }
  ])(
    'holds all drafts after preflight $name and reports the matching URL',
    async ({ result }) => {
      const links = buildCampaignLinks({ vertical: 'vfx' }).slice(0, 2)
      installManager()
      respondToFetch(validationRoute, () =>
        Response.json({
          results: [
            { index: 0, errors: [], warnings: [], existingLinks: [] },
            { index: 1, ...result }
          ]
        })
      )
      const report = await syncCampaignLinks(links, {
        token: 'test',
        mode: 'create-drafts'
      })
      expect(report).toMatchObject({
        created: 0,
        requiresReview: true,
        missing: links.map(({ fullUrl }) => fullUrl)
      })
      expect(
        report.validation.map(({ fullUrl, errors }) => ({ fullUrl, errors }))
      ).toEqual([
        { fullUrl: links[0].fullUrl, errors: [] },
        { fullUrl: links[1].fullUrl, errors: result.errors }
      ])
      expect(fetchRequests(creationRoute)).toEqual([])
    }
  )

  it.for([
    { results: [] },
    { results: [{ index: 0, errors: [], warnings: [{}], existingLinks: [] }] },
    { results: [{ index: 1, errors: [], warnings: [], existingLinks: [] }] }
  ])('rejects malformed preflight results %j', async (response) => {
    installManager()
    respondToFetch(validationRoute, () => Response.json(response))
    await expect(
      syncCampaignLinks(vfxLinks(), { token: 'test', mode: 'create-drafts' })
    ).rejects.toThrow('invalid validation')
    expect(fetchRequests(creationRoute)).toEqual([])
  })

  it.for([
    { mode: 'preview', requests: 0, writes: 0 },
    { mode: 'check', requests: 2, writes: 0 },
    { mode: 'create-drafts', requests: 4, writes: 1 }
  ] as const)(
    'runs $mode without crossing its write boundary',
    async ({ mode, requests, writes }) => {
      vi.stubEnv('UTM_MANAGER_TOKEN', 'test')
      vi.stubEnv('CAMPAIGN_VERTICAL', 'vfx')
      vi.stubEnv('CAMPAIGN_TRACK', 'comfy-led')
      vi.stubEnv('CAMPAIGN_VERSION', 'v2')
      vi.stubEnv('CAMPAIGN_SOURCE', 'reddit')
      vi.stubEnv('CAMPAIGN_CREATIVE', 'sales_demo_03')
      vi.stubEnv('CAMPAIGN_AUDIENCE', 'vfx_buyers')
      installManager()
      const report = await runCampaignLinks(mode)
      expect(report.links).toEqual([
        {
          title: 'VFX · comfy-led · v2 · sales_demo_03',
          campaign: 'comfy_vfx',
          fullUrl:
            'https://comfy.org/solutions/vfx/?utm_source=reddit&utm_medium=ads&utm_campaign=comfy_vfx&utm_content=sales_demo_03&utm_term=vfx_buyers'
        }
      ])
      expect(fetch).toHaveBeenCalledTimes(requests)
      expect(fetchRequests(creationRoute)).toHaveLength(writes)
    }
  )

  it('marks a held create-drafts CLI run as failed while writing its report', async () => {
    const previousExitCode = process.exitCode
    const directory = await mkdtemp(join(tmpdir(), 'campaign-links-'))
    onTestFinished(async () => {
      process.exitCode = previousExitCode
      await rm(directory, { recursive: true, force: true })
    })
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    vi.stubEnv('UTM_MANAGER_TOKEN', 'test')
    vi.stubEnv('CAMPAIGN_VERTICAL', 'vfx')
    vi.stubEnv('CAMPAIGN_TRACK', 'comfy-led')
    vi.stubEnv('CAMPAIGN_VERSION', 'v2')
    installManager()
    respondToFetch(validationRoute, () =>
      Response.json({
        results: [
          {
            index: 0,
            errors: [
              { code: 'invalid_base_url', message: 'Invalid destination' }
            ],
            warnings: [],
            existingLinks: []
          }
        ]
      })
    )
    const output = join(directory, 'report.json')
    await main(['--mode', 'create-drafts', '--output', output])
    expect(process.exitCode).toBe(1)
    expect(JSON.parse(await readFile(output, 'utf8'))).toMatchObject({
      mode: 'create-drafts',
      created: 0,
      requiresReview: true
    })
    expect(fetchRequests(creationRoute)).toEqual([])
  })

  it('uses identical defaults for absent and empty dispatch inputs', async () => {
    const defaults = await runCampaignLinks('preview')
    vi.stubEnv('CAMPAIGN_VERTICAL', '')
    vi.stubEnv('CAMPAIGN_TRACK', '')
    vi.stubEnv('CAMPAIGN_VERSION', '')
    vi.stubEnv('CAMPAIGN_SOURCE', '')
    vi.stubEnv('CAMPAIGN_CREATIVE', '')
    vi.stubEnv('CAMPAIGN_AUDIENCE', '')
    expect(await runCampaignLinks('preview')).toEqual(defaults)
    expect(fetch).not.toHaveBeenCalled()
  })
})
