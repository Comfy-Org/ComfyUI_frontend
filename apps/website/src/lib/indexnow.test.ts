import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDEXNOW_KEY } from '@/config/indexnow'
import { buildIndexNowManifest } from '@/integrations/indexnow-manifest'
import { writeMarkdownTwins } from '@/integrations/markdown-twins'
import { websiteRoot } from '@website/paths'
import {
  diffManifests,
  indexNowPayloads,
  pageFingerprint,
  planSubmission,
  sendPayloads
} from './indexnow'
import type { SendNote } from './indexnow'

const page = ({
  main = 'Flux 2 Max generates images.',
  header = 'Nav',
  head = ''
} = {}) => `<!doctype html><html lang="en"><head><title>Flux</title>${head}
<script type="module" src="/_website/app.abc123.js"></script></head>
<body><header>${header}</header><main><h1>Flux</h1><p>${main}</p></main>
<footer>Footer</footer></body></html>`

const NOINDEX = '<meta name="robots" content="noindex, nofollow">'
const url = (path: string) => `https://comfy.org/${path}`

describe('pageFingerprint', () => {
  it('ignores the header, footer and hashed asset names', () => {
    expect(pageFingerprint(page({ header: 'New nav' }), url('a/'))).toBe(
      pageFingerprint(
        page().replace('app.abc123.js', 'app.def456.js'),
        url('a/')
      )
    )
  })

  it('changes when the main content changes', () => {
    expect(pageFingerprint(page({ main: 'New price' }), url('a/'))).not.toBe(
      pageFingerprint(page(), url('a/'))
    )
  })

  describe('on a custom-node pack page', () => {
    const pack = ({
      downloads = '248,487',
      stars = '50',
      version = '2.1.0'
    } = {}) =>
      page({
        main: `<dl><dt>Downloads</dt><dd>${downloads}</dd><dt>GitHub stars</dt><dd>${stars}</dd><dt>Latest version</dt><dd>${version}</dd></dl>`
      })
    const zhPack = (downloads: string) =>
      page({ main: `<dl><dt>下载量</dt><dd>${downloads}</dd></dl>` })

    it.for([
      ['the download count', pack({ downloads: '251,002' }), pack()],
      ['the star count', pack({ stars: '51' }), pack()],
      ['the zh-CN download count', zhPack('251,002'), zhPack('248,487')]
    ])('ignores a change to %s', ([, after, before]) => {
      const packUrl = url('zh-CN/cloud/supported-nodes/basic_data_handling/')
      expect(pageFingerprint(after, packUrl)).toBe(
        pageFingerprint(before, packUrl)
      )
    })

    it('changes when the text changes', () => {
      const packUrl = url('cloud/supported-nodes/basic_data_handling/')
      expect(pageFingerprint(pack({ version: '2.2.0' }), packUrl)).not.toBe(
        pageFingerprint(pack(), packUrl)
      )
    })

    it('keeps counts on other pages', () => {
      expect(
        pageFingerprint(pack({ downloads: '251,002' }), url('a/'))
      ).not.toBe(pageFingerprint(pack(), url('a/')))
    })
  })

  describe('on the custom-node pack index', () => {
    const indexUrl = url('zh-CN/cloud/supported-nodes/')
    const index = (...names: string[]) =>
      page({
        main: names
          .map(
            (name) =>
              `<h3><a href="/cloud/supported-nodes/${name}/">${name}</a></h3><p>${name} nodes</p>`
          )
          .join('')
      })

    it('ignores packs changing download rank', () => {
      expect(pageFingerprint(index('beta', 'alpha'), indexUrl)).toBe(
        pageFingerprint(index('alpha', 'beta'), indexUrl)
      )
    })

    it('changes when a pack is added', () => {
      expect(
        pageFingerprint(index('alpha', 'beta', 'gamma'), indexUrl)
      ).not.toBe(pageFingerprint(index('alpha', 'beta'), indexUrl))
    })

    it('keeps the order on a pack page', () => {
      const packUrl = url('cloud/supported-nodes/alpha/')
      expect(pageFingerprint(index('beta', 'alpha'), packUrl)).not.toBe(
        pageFingerprint(index('alpha', 'beta'), packUrl)
      )
    })
  })

  it('gives a noindex page no fingerprint, so it is never submitted', () => {
    expect(pageFingerprint(page({ head: NOINDEX }), url('a/'))).toBeNull()
  })
})

describe('diffManifests', () => {
  it('splits URLs into added, changed and removed, and skips unchanged ones', () => {
    expect(
      diffManifests(
        { [url('same/')]: 'h1', [url('edit/')]: 'h2', [url('gone/')]: 'h3' },
        { [url('same/')]: 'h1', [url('edit/')]: 'h9', [url('new/')]: 'h4' }
      )
    ).toEqual({
      added: [url('new/')],
      changed: [url('edit/')],
      removed: [url('gone/')]
    })
  })

  it('submits every URL on the first run', () => {
    expect(diffManifests({}, { [url('a/')]: 'h1' }).added).toEqual([url('a/')])
  })

  it('never submits a URL on another host', () => {
    expect(
      diffManifests(
        { 'https://evil.example/old/': 'h1' },
        {
          'https://www.comfy.org/new/': 'h2',
          'https://comfy.org.evil.com/a/': 'h3'
        }
      )
    ).toEqual({ added: [], changed: [], removed: [] })
  })
})

describe('planSubmission', () => {
  const current = JSON.stringify({ [url('a/')]: 'h1' })

  it.for([
    [
      404,
      '',
      'IndexNow: 1 added, 0 changed, 0 removed (first run)',
      [{ urlList: [url('a/')] }]
    ],
    [200, current, 'IndexNow: 0 added, 0 changed, 0 removed', []]
  ] as const)(
    'live manifest HTTP %i → %s',
    ([status, body, summary, payloads]) => {
      expect(planSubmission(current, status, body)).toMatchObject({
        kind: 'submit',
        summary,
        payloads
      })
    }
  )

  it('submits added, changed and removed URLs', () => {
    const previous = JSON.stringify({
      [url('same/')]: 'h1',
      [url('edit/')]: 'h2',
      [url('gone/')]: 'h3'
    })
    const build = JSON.stringify({
      [url('same/')]: 'h1',
      [url('edit/')]: 'h9',
      [url('new/')]: 'h4'
    })
    expect(planSubmission(build, 200, previous)).toMatchObject({
      kind: 'submit',
      summary: 'IndexNow: 1 added, 1 changed, 1 removed',
      payloads: [{ urlList: [url('new/'), url('edit/'), url('gone/')] }]
    })
  })

  it.for([
    ['a 5xx live manifest', current, 503, '', 'live manifest returned 503'],
    ['a failed fetch', current, 0, '', 'live manifest returned 0'],
    [
      'an HTML live manifest',
      current,
      200,
      '<html></html>',
      'live manifest is not a valid manifest'
    ],
    [
      'an array live manifest',
      current,
      200,
      '["https://comfy.org/"]',
      'live manifest is not a valid manifest'
    ],
    [
      'a live manifest with a non-string hash',
      current,
      200,
      '{"https://comfy.org/a/": 1}',
      'live manifest is not a valid manifest'
    ],
    [
      'a live JSON body that is not a manifest',
      current,
      200,
      '{"error":"x"}',
      'live manifest is not a valid manifest'
    ],
    ['an empty live manifest', current, 200, '{}', 'live manifest is empty'],
    [
      'a missing build manifest',
      '',
      404,
      '',
      'the build has no valid manifest'
    ],
    [
      'an empty build manifest',
      '{}',
      200,
      current,
      'the build has no valid manifest'
    ]
  ] as const)(
    'skips rather than resubmitting the site on %s',
    ([, currentBody, status, body, reason]) => {
      expect(planSubmission(currentBody, status, body)).toEqual({
        kind: 'skip',
        reason
      })
    }
  )
})

describe('indexNowPayloads', () => {
  it('sends at most 10,000 URLs per request with the configured key', () => {
    const urls = Array.from({ length: 10_001 }, (_, i) => url(`${i}/`))
    const payloads = indexNowPayloads(urls)
    expect(payloads.map((payload) => payload.urlList.length)).toEqual([
      10_000, 1
    ])
    expect(payloads[0]).toMatchObject({
      host: 'comfy.org',
      key: INDEXNOW_KEY,
      keyLocation: `https://comfy.org/${INDEXNOW_KEY}.txt`
    })
  })

  it('sends nothing when nothing changed', () => {
    expect(indexNowPayloads([])).toEqual([])
  })
})

describe('sendPayloads', () => {
  const twoBatches = indexNowPayloads([url('a/'), url('b/')], 1)

  function fakeIndexNow(keyFileBody: string, status: number) {
    const posted: string[][] = []
    const fetchFake: typeof fetch = async (input, init) => {
      if (String(input).endsWith('.txt')) return new Response(keyFileBody)
      posted.push(JSON.parse(String(init?.body)).urlList)
      return new Response('{"code":"TooManyRequests"}', { status })
    }
    return { fetchFake, posted }
  }

  it.for([
    [
      'sends every batch when IndexNow accepts them',
      INDEXNOW_KEY,
      202,
      [[url('a/')], [url('b/')]],
      [
        { level: 'info', line: 'IndexNow batch 1/2 (1 URLs): HTTP 202' },
        { level: 'info', line: 'IndexNow batch 2/2 (1 URLs): HTTP 202' }
      ]
    ],
    [
      'stops after the first batch IndexNow refuses',
      INDEXNOW_KEY,
      429,
      [[url('a/')]],
      [
        {
          level: 'warn',
          line: 'IndexNow rejected: batch 1/2 (1 URLs): HTTP 429: {"code":"TooManyRequests"}'
        }
      ]
    ],
    [
      'sends nothing when the key file does not serve the key',
      'not the key',
      202,
      [],
      [
        {
          level: 'warn',
          line: `IndexNow skipped: key file https://comfy.org/${INDEXNOW_KEY}.txt does not serve the key`
        }
      ]
    ]
  ] as const)('%s', async ([, keyFileBody, status, sent, notes]) => {
    const { fetchFake, posted } = fakeIndexNow(keyFileBody, status)
    const logged: SendNote[] = []
    await sendPayloads(twoBatches, {
      fetch: fetchFake,
      log: (note) => logged.push(note)
    })
    expect({ posted, logged }).toEqual({ posted: sent, logged: notes })
  })
})

describe('buildIndexNowManifest', () => {
  async function site(pages: Record<string, string>) {
    const root = await mkdtemp(join(tmpdir(), 'indexnow-'))
    const write = async (path: string, body: string) => {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), body)
    }
    await write(
      'sitemap-index.xml',
      `<sitemapindex><sitemap><loc>${url('sitemap-0.xml')}</loc></sitemap></sitemapindex>`
    )
    await write(
      'sitemap-0.xml',
      [...Object.keys(pages), 'missing/']
        .map((path) => `<url><loc>${url(path)}</loc></url>`)
        .join('')
    )
    for (const [path, html] of Object.entries(pages))
      await write(join(path, 'index.html'), html)
    return { root, write }
  }

  it('fingerprints sitemap pages only, and leaves out noindex pages', async () => {
    const { root, write } = await site({
      '': page(),
      'hidden/': page({ head: NOINDEX })
    })
    await write('unlisted/index.html', page())

    expect(Object.keys(await buildIndexNowManifest(root))).toEqual([url('')])
  })

  it('reads the twin markdown-twins wrote, and parses the HTML behind an endpoint twin', async () => {
    const { root, write } = await site({
      'cli/': page(),
      'endpoint/': page({ main: 'Endpoint page' })
    })
    const fromHtml = await buildIndexNowManifest(root)
    await writeMarkdownTwins(root, ['cli/'])
    await write('endpoint.md', '# Hand-written endpoint twin')
    const astroOutputs = new Set([join(root, 'endpoint.md')])

    expect(await buildIndexNowManifest(root, astroOutputs)).toEqual(fromHtml)

    await write('cli.md', '# Edited twin')
    expect(await buildIndexNowManifest(root, astroOutputs)).not.toEqual(
      fromHtml
    )
  })
})

describe('IndexNow key file', () => {
  it('is served at the site root and holds the configured key', () => {
    const keyFile = join(websiteRoot, 'public', `${INDEXNOW_KEY}.txt`)
    expect(readFileSync(keyFile, 'utf8').trim()).toBe(INDEXNOW_KEY)
  })
})
