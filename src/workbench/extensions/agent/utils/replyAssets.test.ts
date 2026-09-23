import { marked } from 'marked'
import { describe, expect, it } from 'vitest'

import { isImageResult } from '@/utils/resultItem'

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

describe('resolveAgentAssetUrl', () => {
  it.for([
    ['http://127.0.0.1:8188/view?filename=a.png', '/view?filename=a.png'],
    [
      'http://localhost:8188/api/view?filename=a.png',
      '/api/view?filename=a.png'
    ],
    ['http://[::1]:8188/view?filename=a.png', '/view?filename=a.png'],
    [
      'http://0.0.0.0:8188/viewvideo?filename=a.mp4',
      '/viewvideo?filename=a.mp4'
    ],
    [
      'http://127.1.2.3:8188/viewaudio?filename=a.mp3',
      '/viewaudio?filename=a.mp3'
    ]
  ])('re-homes %s onto the page origin', ([href, path]) => {
    expect(resolveAgentAssetUrl(href, PANEL)).toBe(`${PANEL}${path}`)
  })

  it('keeps the whole query, including an empty subfolder', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)).toBe(
      `${PANEL}/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
  })

  it('defaults to the page the panel is served from', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW)).toBe(
      `${window.location.origin}/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
    )
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

  it('leaves a loopback URL that is not a media route alone', () => {
    for (const href of [
      'http://127.0.0.1:8188/prompt',
      'http://127.0.0.1:8086/docs',
      'http://127.0.0.1:8188/view/extra?filename=a.png'
    ])
      expect(resolveAgentAssetUrl(href, PANEL)).toBe(href)
  })

  it('reaches ReplyAsset urls through classifyAssetUrl', () => {
    expect(classifyAssetUrl(LOOPBACK_VIEW, PANEL)).toEqual({
      url: `${PANEL}/view?filename=ComfyUI_00005_.png&subfolder=&type=output`,
      filename: 'ComfyUI_00005_.png',
      kind: 'image'
    })
  })
})

describe('rewriteAgentAssetHtml', () => {
  it('rewrites the img src the reader actually sees', () => {
    expect(
      rewriteAgentAssetHtml(`<p><img src="${LOOPBACK_VIEW}" alt="a duck"></p>`)
    ).toContain(
      `src="${window.location.origin}/view?filename=ComfyUI_00005_.png&amp;subfolder=&amp;type=output"`
    )
  })

  it('rewrites an anchor to a loopback asset', () => {
    expect(
      rewriteAgentAssetHtml(`<a href="${LOOPBACK_VIEW}">duck.png</a>`)
    ).toContain(`href="${window.location.origin}/view?`)
  })

  it('resolves every srcset candidate and keeps its descriptor', () => {
    const html =
      `<img srcset="${LOOPBACK_VIEW} 1x, http://127.0.0.1:8188/view?filename=a%402x.png 2x"` +
      ' alt="a duck">'
    const out = rewriteAgentAssetHtml(html)
    expect(out).toContain(
      `${window.location.origin}/view?filename=ComfyUI_00005_.png&amp;subfolder=&amp;type=output 1x`
    )
    expect(out).toContain(
      `${window.location.origin}/view?filename=a%402x.png 2x`
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
})
