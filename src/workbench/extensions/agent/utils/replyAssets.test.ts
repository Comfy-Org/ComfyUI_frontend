import { fromPartial } from '@total-typescript/shoehorn'
import { marked } from 'marked'
import { describe, expect, it, onTestFinished } from 'vitest'

import { provideWebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import type { WebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import { api } from '@/scripts/api'
import { isAudioResult, isImageResult, isVideoResult } from '@/utils/resultItem'

import {
  classifyAssetUrl,
  htmlReplyAssets,
  replyAssetResultItem,
  resolveAgentAssetUrl,
  rewriteAgentAssetHtml,
  tokenReplyAssets
} from './replyAssets'

const view = (filename: string) =>
  `https://cloud.comfy.org/api/view?filename=${filename}&type=output`

function firstTokenAssets(text: string) {
  return tokenReplyAssets(marked.lexer(text)[0])
}

// The local agent writes previews as absolute URLs of the ComfyUI it drives.
// Opened from any machine but the one running it, that loopback host is the
// reader's own computer and every chat image is broken.
const PANEL = 'http://100.74.161.87:8190'
const LOOPBACK_VIEW =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'

/** Serve the panel from a subpath, the way a reverse proxy does. */
function servedUnder(subpath: string) {
  const original = api.api_base
  api.api_base = subpath
  onTestFinished(() => {
    api.api_base = original
  })
}

describe('resolveAgentAssetUrl', () => {
  it.for([
    ['http://127.0.0.1:8188/view?filename=a.png', '/api/view?filename=a.png'],
    [
      'http://localhost:8188/api/view?filename=a.png',
      '/api/view?filename=a.png'
    ],
    ['http://[::1]:8188/view?filename=a.png', '/api/view?filename=a.png'],
    [
      'http://0.0.0.0:8188/viewvideo?filename=a.mp4',
      '/api/viewvideo?filename=a.mp4'
    ],
    [
      'http://127.1.2.3:8188/vhs/viewaudio?filename=a.mp3',
      '/api/vhs/viewaudio?filename=a.mp3'
    ]
  ])('re-homes %s onto the page origin', ([href, path]) => {
    expect(resolveAgentAssetUrl(href, PANEL)).toBe(`${PANEL}${path}`)
  })

  it('keeps the whole query, including an empty subfolder', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)).toBe(
      `${PANEL}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  it('defaults to the page the panel is served from', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW)).toBe(
      `${window.location.origin}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  // Scheme-relative: absolute in everything but its scheme, so `new URL()`
  // alone throws on it and the loopback host would survive.
  it('re-homes a scheme-relative loopback URL onto the page origin', () => {
    expect(
      resolveAgentAssetUrl('//localhost:8188/view?filename=a.png', PANEL)
    ).toBe(`${PANEL}/api/view?filename=a.png`)
  })

  // A reverse-proxied install is the case the re-homing exists for, and it is
  // the one a bare origin cannot serve: `new URL('/view?…', origin)` resolves
  // against the origin ROOT and drops the subpath, so every re-homed image
  // 404s on exactly the deployment that needed the fix.
  it('keeps the subpath a reverse-proxied install is served under', () => {
    servedUnder('/ComfyBackendDirect')
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)).toBe(
      `${PANEL}/ComfyBackendDirect/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  it('does not double the api prefix on a subpath install', () => {
    servedUnder('/ComfyBackendDirect')
    expect(
      resolveAgentAssetUrl('http://127.0.0.1:8188/api/view?filename=a.png')
    ).toBe(
      `${window.location.origin}/ComfyBackendDirect/api/view?filename=a.png`
    )
  })

  // An <img> cannot send a header, so a web session names its workspace in the
  // query. Re-homing through the API helper is what applies that; building the
  // URL from an origin would hand the reader a 404 on cloud.
  it('names the workspace when the page is on a web session', () => {
    onTestFinished(
      provideWebSessionRequests(
        fromPartial<WebSessionRequests>({ workspaceId: () => 'ws-7' })
      )
    )
    expect(
      resolveAgentAssetUrl('http://127.0.0.1:8188/view?filename=a.png')
    ).toBe(
      `${window.location.origin}/api/view?filename=a.png&workspace_id=ws-7`
    )
  })

  // `pnpm dev`: the panel is served from one loopback port and the agent
  // drives a ComfyUI on another, so the reference it writes already loads.
  // Re-homing must not break it — and the reason it does not is the `/api`
  // prefix, which is what `vite.config.mts` proxies. A bare `/view` on the
  // dev server's own origin is not proxied and would 404, which is the whole
  // argument for re-homing through the API helper rather than skipping the
  // rewrite whenever the page itself happens to be on loopback.
  it('re-homes onto the proxied api route when the page is itself loopback', () => {
    const dev = 'http://localhost:5173'
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW, dev)).toBe(
      `${dev}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  // Two ComfyUI instances on one machine is exactly the case a
  // "skip when the page origin is loopback" guard would get wrong: the panel
  // on :8000 cannot reach :8188's `/view` by port alone either.
  it('re-homes a loopback asset served from a different loopback port', () => {
    const desktop = 'http://127.0.0.1:8000'
    expect(
      resolveAgentAssetUrl('http://127.0.0.1:8188/view?filename=a.png', desktop)
    ).toBe(`${desktop}/api/view?filename=a.png`)
  })

  // Applied to its own output: the re-homed URL no longer names a loopback
  // host, so a second pass must not prefix `/api` twice. MarkdownStream does
  // exactly this when a prose image is clicked and reclassified from the DOM.
  it('is idempotent', () => {
    const once = resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)
    expect(resolveAgentAssetUrl(once, PANEL)).toBe(once)
  })

  it('keeps a fragment out of the scoped query', () => {
    onTestFinished(
      provideWebSessionRequests(
        fromPartial<WebSessionRequests>({ workspaceId: () => 'ws-7' })
      )
    )
    expect(
      resolveAgentAssetUrl('http://127.0.0.1:8188/view?filename=a.png#frag')
    ).toBe(
      `${window.location.origin}/api/view?filename=a.png&workspace_id=ws-7#frag`
    )
  })

  it('leaves a scheme-relative remote URL alone', () => {
    const remote = '//cdn.example.com/view?filename=a.png'
    expect(resolveAgentAssetUrl(remote, PANEL)).toBe(remote)
  })

  it('leaves a genuinely remote ComfyUI host alone', () => {
    const remote = 'http://gpu-box.lan:8188/view?filename=a.png'
    expect(resolveAgentAssetUrl(remote, PANEL)).toBe(remote)
  })

  // A cloud reply never carries a loopback URL, and its own asset host is
  // left exactly as authored, so the cloud panel is unaffected.
  it('leaves a cloud asset host alone', () => {
    const cloud = 'https://cloud.comfy.org/api/view?filename=a.png'
    expect(resolveAgentAssetUrl(cloud, PANEL)).toBe(cloud)
  })

  it('leaves a relative URL alone', () => {
    expect(resolveAgentAssetUrl('/api/view?filename=a.png', PANEL)).toBe(
      '/api/view?filename=a.png'
    )
    expect(resolveAgentAssetUrl('view?filename=a.png', PANEL)).toBe(
      'view?filename=a.png'
    )
  })

  it.for([
    'http://127.0.0.1:8188/prompt',
    'http://127.0.0.1:8086/docs',
    'http://127.0.0.1:8188/view/extra?filename=a.png',
    // Not a route ComfyUI serves; the only place it appeared was a second,
    // hand-maintained copy of the media-route list.
    'http://127.0.0.1:8188/viewaudio?filename=a.mp3'
  ])('leaves the non-media loopback URL %s alone', (href) => {
    expect(resolveAgentAssetUrl(href, PANEL)).toBe(href)
  })

  // Every media route the repo recognises, not a narrower second list: an
  // agent reply carrying VHS audio or an asset-id reference was left pointed
  // at the reader's own machine while `/view` was fixed.
  it.for([
    '/view?filename=a.png',
    '/viewvideo?filename=a.mp4',
    '/vhs/viewvideo?filename=a.webm',
    '/vhs/viewaudio?filename=a.wav',
    '/assets/abc123/content',
    '/api/view?filename=a.png',
    '/api/vhs/viewaudio?filename=a.wav'
  ])('re-homes the canonical media route %s', (route) => {
    expect(resolveAgentAssetUrl(`http://127.0.0.1:8188${route}`, PANEL)).toBe(
      `${PANEL}${api.apiURL(route)}`
    )
  })

  // Spellings that can only mean this machine. Each fails open, so a missed
  // one leaves the preview broken exactly as before the fix.
  it.for([
    'localhost',
    'localhost.',
    'app.localhost',
    '127.0.0.1',
    '127.1.2.3',
    '[::1]',
    '[0:0:0:0:0:0:0:1]',
    '[::ffff:127.0.0.1]',
    '0.0.0.0',
    '[::]'
  ])('treats %s as this machine', (host) => {
    expect(
      resolveAgentAssetUrl(`http://${host}:8188/view?filename=a.png`, PANEL)
    ).toBe(`${PANEL}/api/view?filename=a.png`)
  })

  it('reaches ReplyAsset urls through classifyAssetUrl', () => {
    expect(classifyAssetUrl(LOOPBACK_VIEW, PANEL)).toEqual({
      url: `${PANEL}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`,
      filename: 'ComfyUI_00005_.png',
      kind: 'image'
    })
  })

  // The inline <img> goes through rewriteAgentAssetHtml, which takes no base,
  // while the reply-asset preview goes through classifyAssetUrl, which does.
  // The two must land on the same ROUTE for one URL — the origin may differ,
  // since that is what the caller's base names, but the base path and the
  // `/api` prefix come from the API helper and so cannot diverge.
  it('reaches the same route as the html rewrite whatever base it is handed', () => {
    servedUnder('/ComfyBackendDirect')
    const route = (url: string) => {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}`
    }
    const fromHtml = rewriteAgentAssetHtml(`<img src="${LOOPBACK_VIEW}">`)
    const src = /src="([^"]+)"/.exec(fromHtml)?.[1].replaceAll('&amp;', '&')
    const fromClassify = classifyAssetUrl(LOOPBACK_VIEW, `${PANEL}/api`)

    expect(route(src!)).toBe(
      '/ComfyBackendDirect/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output'
    )
    expect(route(fromClassify!.url)).toBe(route(src!))
  })
})

describe('rewriteAgentAssetHtml', () => {
  it('rewrites the img src the reader actually sees', () => {
    expect(
      rewriteAgentAssetHtml(`<p><img src="${LOOPBACK_VIEW}" alt="a duck"></p>`)
    ).toContain(
      `src="${window.location.origin}/api/view?filename=ComfyUI_00005_.png&amp;subfolder=&amp;type=output"`
    )
  })

  it('rewrites an anchor to a loopback asset', () => {
    expect(
      rewriteAgentAssetHtml(`<a href="${LOOPBACK_VIEW}">duck.png</a>`)
    ).toContain(`href="${window.location.origin}/api/view?`)
  })

  it('resolves every srcset candidate and keeps its descriptor', () => {
    const html =
      `<img srcset="${LOOPBACK_VIEW} 1x, http://127.0.0.1:8188/view?filename=a%402x.png 2x"` +
      ' alt="a duck">'
    const out = rewriteAgentAssetHtml(html)
    expect(out).toContain(
      `${window.location.origin}/api/view?filename=ComfyUI_00005_.png&amp;subfolder=&amp;type=output 1x`
    )
    expect(out).toContain(
      `${window.location.origin}/api/view?filename=a%402x.png 2x`
    )
    expect(out).not.toContain('127.0.0.1')
  })

  it('resolves a picture source srcset', () => {
    const out = rewriteAgentAssetHtml(
      `<picture><source srcset="http://localhost:8188/api/view?filename=a.webp"><img src="${LOOPBACK_VIEW}"></picture>`
    )
    expect(out).toContain(
      `srcset="${window.location.origin}/api/view?filename=a.webp"`
    )
    expect(out).not.toContain('localhost:8188')
  })

  // srcset separates candidates by a comma AFTER the descriptors, not by every
  // comma: a URL may carry commas of its own (a filename, a CDN transform).
  it('keeps a comma inside a candidate URL as part of that URL', () => {
    const out = rewriteAgentAssetHtml(
      '<img srcset="http://127.0.0.1:8188/view?filename=a,b.png 1x, http://127.0.0.1:8188/view?filename=c.png 2x">'
    )
    expect(out).toContain(
      `srcset="${window.location.origin}/api/view?filename=a,b.png 1x, ${window.location.origin}/api/view?filename=c.png 2x"`
    )
    expect(out).not.toContain('127.0.0.1')
  })

  it('resolves a candidate that follows leading whitespace', () => {
    const out = rewriteAgentAssetHtml(
      '<img srcset="\n   http://127.0.0.1:8188/view?filename=a.png 1x">'
    )
    expect(out).toContain(
      `srcset="${window.location.origin}/api/view?filename=a.png 1x"`
    )
  })

  it('ends a descriptor-less candidate at its trailing comma', () => {
    const out = rewriteAgentAssetHtml(
      '<img srcset="http://127.0.0.1:8188/view?filename=a.png, http://localhost:8188/view?filename=b.png">'
    )
    expect(out).toContain(
      `srcset="${window.location.origin}/api/view?filename=a.png, ${window.location.origin}/api/view?filename=b.png"`
    )
  })

  it('leaves a srcset of remote candidates alone', () => {
    const html =
      '<img srcset="https://cdn.example.com/a.png 1x, https://cdn.example.com/a@2x.png 2x">'
    expect(rewriteAgentAssetHtml(html)).toBe(html)
  })

  it('returns html with nothing to rewrite unchanged', () => {
    const untouched =
      '<p>plain <b>text</b> and <img src="/api/view?filename=a.png"></p>'
    expect(rewriteAgentAssetHtml(untouched)).toBe(untouched)
  })

  // Rewriting one URL must not edit unrelated markup. Parsing the html as a
  // whole DOCUMENT and returning `body.innerHTML` does: the parser relocates
  // what cannot sit directly in <body>, so table markup loses its wrapper
  // here, and in a real browser a leading <style> or <title> — both permitted
  // by the sanitizing in renderMarkdownToHtml — is hoisted into <head> and
  // dropped outright. The loss is conditional on some *other* URL in the same
  // reply having been rewritten, so one reply renders two ways depending on
  // whether it happens to carry a loopback asset at all.
  //
  // Only the table half is asserted: this suite runs on happy-dom, whose
  // parser does not reproduce the <head> hoisting a browser performs.
  it('leaves markup it is not rewriting exactly as it found it', () => {
    const orphan = '<tr><td>a</td></tr>'
    const out = rewriteAgentAssetHtml(
      `${orphan}<p><img src="${LOOPBACK_VIEW}"></p>`
    )
    expect(out).toContain(orphan)
    expect(out).toContain(`${window.location.origin}/api/view?`)
  })

  // A srcset needing no rewrite must come back byte-identical, even when it is
  // spelled unlike the re-serializer's output: re-emitting it would flip the
  // document to rewritten and re-serialize everything for no gain.
  it('leaves a remote srcset exactly as authored while rewriting a sibling', () => {
    const odd =
      '<img srcset="https://cdn.example.com/a.png 1x,https://cdn.example.com/b.png  2x,">'
    const out = rewriteAgentAssetHtml(`<img src="${LOOPBACK_VIEW}">${odd}`)
    expect(out).toContain(odd)
  })

  it('does not blank a srcset of only whitespace and commas', () => {
    const blankish = '<img srcset=" , ,  ">'
    const out = rewriteAgentAssetHtml(`<img src="${LOOPBACK_VIEW}">${blankish}`)
    expect(out).toContain('srcset=" , ,  "')
  })

  // The streaming path skips the parse for prose that cannot carry a loopback
  // reference, so the prefilter must not reject a spelling the classifier
  // accepts — a miss there is a silently broken preview, not a slow one.
  it.for([
    'localhost',
    'localhost.',
    'app.localhost',
    '127.0.0.1',
    '[::1]',
    '[0:0:0:0:0:0:0:1]',
    '[::ffff:127.0.0.1]',
    '0.0.0.0',
    '[::]'
  ])('still parses html whose only loopback spelling is %s', (host) => {
    const out = rewriteAgentAssetHtml(
      `<img src="http://${host}:8188/view?filename=a.png">`
    )
    expect(out).toContain(`${window.location.origin}/api/view?filename=a.png`)
  })
})

describe('htmlReplyAssets', () => {
  it('collects unique media assets from anchors and images, in order', () => {
    const html =
      `<p><a href="${view('a.png')}">a</a>` +
      `<img src="${view('mesh.glb')}" />` +
      `<a href="${view('a.png')}">duplicate</a>` +
      '<a href="https://cloud.comfy.org/docs">not an asset</a></p>'

    expect(htmlReplyAssets(html).map((asset) => asset.filename)).toEqual([
      'a.png',
      'mesh.glb'
    ])
  })

  it('returns no assets for asset-free html', () => {
    expect(htmlReplyAssets('<p>plain <b>text</b></p>')).toEqual([])
  })
})

describe('classifyAssetUrl', () => {
  it.for([
    ['ComfyUI_0001.png', 'image'],
    ['clip.mp4', 'video'],
    ['song.mp3', 'audio'],
    ['mesh.glb', '3D']
  ])('classifies %s as %s', ([filename, kind]) => {
    expect(classifyAssetUrl(view(filename))).toEqual({
      url: view(filename),
      filename,
      kind
    })
  })

  it('rejects non-media and extensionless references', () => {
    expect(classifyAssetUrl(view('notes.txt'))).toBeNull()
    expect(classifyAssetUrl('https://cloud.comfy.org/api/view')).toBeNull()
    expect(classifyAssetUrl('/view/%ZZ', 'http://localhost')).toBeNull()
  })

  it('falls back to the pathname when no filename param exists', () => {
    expect(classifyAssetUrl('https://x.com/media/output.webm')).toMatchObject({
      filename: 'output.webm',
      kind: 'video'
    })
  })
})

describe('tokenReplyAssets', () => {
  it('keeps a lone image link as prose', () => {
    const url = view('a.png')
    expect(firstTokenAssets(`[${url}](${url})`)).toBeNull()
  })

  it('keeps a mid-sentence asset link as prose', () => {
    expect(firstTokenAssets(`Here is ${view('a.png')} inline`)).toBeNull()
  })

  it('converts image syntax and carries the alt as the label', () => {
    expect(firstTokenAssets(`![Generated asset](${view('a.png')})`)).toEqual([
      {
        url: view('a.png'),
        filename: 'a.png',
        kind: 'image',
        label: 'Generated asset'
      }
    ])
  })

  it('converts a lone non-image asset link', () => {
    const url = view('clip.mp4')
    expect(firstTokenAssets(`[${url}](${url})`)).toMatchObject([
      { kind: 'video' }
    ])
  })

  it('converts a paragraph of multiple asset links', () => {
    const a = view('a.png')
    const b = view('b.png')
    expect(firstTokenAssets(`[${a}](${a}) [${b}](${b})`)).toHaveLength(2)
  })

  it('converts a list of asset links', () => {
    const a = view('a.png')
    const b = view('b.mp3')
    expect(firstTokenAssets(`- [${a}](${a})\n- [${b}](${b})`)).toMatchObject([
      { kind: 'image' },
      { kind: 'audio' }
    ])
  })

  it('leaves a list with any non-media item as prose', () => {
    const a = view('a.png')
    expect(firstTokenAssets(`- [${a}](${a})\n- plain words`)).toBeNull()
  })
})

describe('replyAssetResultItem', () => {
  it('pins the exact source url and classifies from the filename', () => {
    const item = replyAssetResultItem({
      url: 'https://x/y?filename=a.png',
      filename: 'a.png',
      kind: 'image'
    })
    expect(item.url).toBe('https://x/y?filename=a.png')
    expect(isImageResult(item)).toBe(true)
  })

  it.for([
    {
      kind: 'image' as const,
      filename: 'stored-video.mp4',
      expected: [true, false, false]
    },
    {
      kind: 'video' as const,
      filename: 'stored-image.png',
      expected: [false, true, false]
    },
    {
      kind: 'audio' as const,
      filename: 'stored-image.png',
      expected: [false, false, true]
    }
  ])(
    'keeps resolved $kind authoritative over $filename',
    ({ kind, filename, expected }) => {
      const item = replyAssetResultItem({
        url: `https://x/y?filename=${filename}`,
        filename,
        kind
      })

      expect([
        isImageResult(item),
        isVideoResult(item),
        isAudioResult(item)
      ]).toEqual(expected)
    }
  )
})
