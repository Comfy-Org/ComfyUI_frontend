import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDEXNOW_KEY } from '@/config/indexnow'
import { buildIndexNowManifest } from '@/integrations/indexnow-manifest'
import { websiteRoot } from '@website/paths'
import {
  diffManifests,
  indexNowPayloads,
  pageFingerprint,
  planSubmission
} from './indexnow'

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
        { 'https://www.comfy.org/new/': 'h2' }
      )
    ).toEqual({ added: [], changed: [], removed: [] })
  })
})

describe('planSubmission', () => {
  const current = JSON.stringify({ [url('a/')]: 'h1' })

  it.for([
    [404, '', 'IndexNow: 1 added, 0 changed, 0 removed (first run)'],
    [200, current, 'IndexNow: 0 added, 0 changed, 0 removed']
  ] as const)('live manifest HTTP %i → %s', ([status, body, summary]) => {
    expect(planSubmission(current, status, body)).toMatchObject({
      kind: 'submit',
      summary
    })
  })

  it.for([
    ['a 5xx live manifest', current, 503, ''],
    ['a failed fetch', current, 0, ''],
    ['an HTML live manifest', current, 200, '<html></html>'],
    ['an array live manifest', current, 200, '["https://comfy.org/"]'],
    ['a missing build manifest', '', 404, '']
  ] as const)(
    'skips rather than resubmitting the site on %s',
    ([, currentBody, status, body]) => {
      expect(planSubmission(currentBody, status, body).kind).toBe('skip')
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

describe('buildIndexNowManifest', () => {
  it('fingerprints sitemap pages only, and leaves out noindex pages', async () => {
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
      ['', 'hidden/', 'missing/']
        .map((path) => `<url><loc>${url(path)}</loc></url>`)
        .join('')
    )
    await write('index.html', page())
    await write('hidden/index.html', page({ head: NOINDEX }))
    await write('unlisted/index.html', page())

    expect(Object.keys(await buildIndexNowManifest(root))).toEqual([url('')])
  })
})

describe('IndexNow key file', () => {
  it('is served at the site root and holds the configured key', () => {
    const keyFile = join(websiteRoot, 'public', `${INDEXNOW_KEY}.txt`)
    expect(readFileSync(keyFile, 'utf8').trim()).toBe(INDEXNOW_KEY)
  })
})
