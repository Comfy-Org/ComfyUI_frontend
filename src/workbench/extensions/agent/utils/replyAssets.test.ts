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

const LOOPBACK_VIEW =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'

function servedUnder(subpath: string) {
  const original = api.api_base
  api.api_base = subpath
  onTestFinished(() => {
    api.api_base = original
  })
}

describe('resolveAgentAssetUrl', () => {
  it('keeps the whole query, including an empty subfolder', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW)).toBe(
      `${window.location.origin}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  it('re-homes a scheme-relative loopback URL onto the page API', () => {
    expect(resolveAgentAssetUrl('//localhost:8188/view?filename=a.png')).toBe(
      `${window.location.origin}/api/view?filename=a.png`
    )
  })

  it('keeps the subpath a reverse-proxied install is served under', () => {
    servedUnder('/ComfyBackendDirect')
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW)).toBe(
      `${window.location.origin}/ComfyBackendDirect/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
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

  it('is idempotent', () => {
    const once = resolveAgentAssetUrl(LOOPBACK_VIEW)
    expect(resolveAgentAssetUrl(once)).toBe(once)
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
    expect(resolveAgentAssetUrl(remote)).toBe(remote)
  })

  it('leaves a genuinely remote ComfyUI host alone', () => {
    const remote = 'http://gpu-box.lan:8188/view?filename=a.png'
    expect(resolveAgentAssetUrl(remote)).toBe(remote)
  })

  it('leaves a cloud asset host alone', () => {
    const cloud = 'https://cloud.comfy.org/api/view?filename=a.png'
    expect(resolveAgentAssetUrl(cloud)).toBe(cloud)
  })

  it('leaves a relative URL alone', () => {
    expect(resolveAgentAssetUrl('/api/view?filename=a.png')).toBe(
      '/api/view?filename=a.png'
    )
    expect(resolveAgentAssetUrl('view?filename=a.png')).toBe(
      'view?filename=a.png'
    )
  })

  it.for([
    'http://127.0.0.1:8188/prompt',
    'http://127.0.0.1:8086/docs',
    'http://127.0.0.1:8188/view/extra?filename=a.png',
    'http://127.0.0.1:8188/viewaudio?filename=a.mp3',
    'ftp://127.0.0.1:8188/view?filename=a.png'
  ])('leaves the loopback URL %s alone', (href) => {
    expect(resolveAgentAssetUrl(href)).toBe(href)
  })

  it.for([
    ['/view?filename=a.png', '/api/view?filename=a.png'],
    ['/viewvideo?filename=a.mp4', '/api/viewvideo?filename=a.mp4'],
    ['/vhs/viewvideo?filename=a.webm', '/api/vhs/viewvideo?filename=a.webm'],
    ['/vhs/viewaudio?filename=a.wav', '/api/vhs/viewaudio?filename=a.wav'],
    ['/assets/abc123/content', '/api/assets/abc123/content'],
    ['/api/view?filename=a.png', '/api/view?filename=a.png'],
    ['/api/vhs/viewaudio?filename=a.wav', '/api/vhs/viewaudio?filename=a.wav']
  ])('re-homes the canonical media route %s', ([route, path]) => {
    expect(resolveAgentAssetUrl(`http://127.0.0.1:8188${route}`)).toBe(
      `${window.location.origin}${path}`
    )
  })

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
      resolveAgentAssetUrl(`http://${host}:8188/view?filename=a.png`)
    ).toBe(`${window.location.origin}/api/view?filename=a.png`)
  })

  it('reaches ReplyAsset urls through classifyAssetUrl', () => {
    expect(classifyAssetUrl(LOOPBACK_VIEW)).toEqual({
      url: `${window.location.origin}/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`,
      filename: 'ComfyUI_00005_.png',
      kind: 'image'
    })
  })

  it('re-homes onto the page whatever base classifyAssetUrl is handed', () => {
    servedUnder('/ComfyBackendDirect')
    expect(
      classifyAssetUrl(LOOPBACK_VIEW, 'http://100.74.161.87:8190/api')?.url
    ).toBe(
      `${window.location.origin}/ComfyBackendDirect/api/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
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
  })

  it('keeps a comma inside a candidate URL as part of that URL', () => {
    const out = rewriteAgentAssetHtml(
      '<img srcset="http://127.0.0.1:8188/view?filename=a,b.png 1x, http://127.0.0.1:8188/view?filename=c.png 2x">'
    )
    expect(out).toContain(
      `srcset="${window.location.origin}/api/view?filename=a,b.png 1x, ${window.location.origin}/api/view?filename=c.png 2x"`
    )
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

  it.for([
    ['a.png 1x ((), http://127.0.0.1:8188/view?filename=b.png 2x', true],
    ['a.png 1x (x, http://127.0.0.1:8188/view?filename=b.png 2x)', false]
  ] as const)(
    'ends a descriptor only at a comma outside parentheses in %s',
    ([srcset, rehomed]) => {
      const out = rewriteAgentAssetHtml(`<img srcset="${srcset}">`)
      expect(out.includes(`${window.location.origin}/api/view`)).toBe(rehomed)
    }
  )

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

  it('leaves markup it is not rewriting exactly as it found it', () => {
    const orphan = '<tr><td>a</td></tr>'
    const out = rewriteAgentAssetHtml(
      `${orphan}<p><img src="${LOOPBACK_VIEW}"></p>`
    )
    expect(out).toContain(orphan)
    expect(out).toContain(`${window.location.origin}/api/view?`)
  })

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

  it.for([
    'localhost',
    'localhost.',
    'app.localhost',
    '127.0.0.1',
    '[::1]',
    '[0:0:0:0:0:0:0:1]',
    '[::ffff:127.0.0.1]',
    '0.0.0.0',
    '[::]',
    '2130706433',
    '0x7f000001',
    '0'
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
