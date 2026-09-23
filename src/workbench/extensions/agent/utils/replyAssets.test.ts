import { marked } from 'marked'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

// FE: the local agent writes previews as absolute URLs of the ComfyUI it
// drives. Opened from any machine but the one running it, that loopback host
// is the viewer's own computer and every chat image is broken.
const PANEL = 'http://100.74.161.87:8190'
const LOOPBACK_VIEW =
  'http://127.0.0.1:8188/view?filename=ComfyUI_00005_.png&subfolder=&type=output'

describe('resolveAgentAssetUrl', () => {
  it('leaves an agent URL untouched in a cloud build', () => {
    expect(resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)).toBe(LOOPBACK_VIEW)
  })

  describe('in a standalone build', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_AGENT_STANDALONE', 'true')
    })

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
    ])('re-homes %s onto the panel origin', ([href, path]) => {
      expect(resolveAgentAssetUrl(href, PANEL)).toBe(`${PANEL}${path}`)
    })

    it('keeps the whole query, including an empty subfolder', () => {
      expect(resolveAgentAssetUrl(LOOPBACK_VIEW, PANEL)).toBe(
        `${PANEL}/view?filename=ComfyUI_00005_.png&subfolder=&type=output`
      )
    })

    it('leaves a genuinely remote ComfyUI host alone', () => {
      const remote = 'http://gpu-box.lan:8188/view?filename=a.png'
      expect(resolveAgentAssetUrl(remote, PANEL)).toBe(remote)
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
})

describe('rewriteAgentAssetHtml', () => {
  const html = `<p><img src="${LOOPBACK_VIEW}" alt="a duck"></p>`

  it('leaves rendered markdown untouched in a cloud build', () => {
    expect(rewriteAgentAssetHtml(html)).toBe(html)
  })

  describe('in a standalone build', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_AGENT_STANDALONE', 'true')
    })

    it('rewrites the img src the reader actually sees', () => {
      expect(rewriteAgentAssetHtml(html)).toContain(
        `src="${window.location.origin}/view?filename=ComfyUI_00005_.png&amp;subfolder=&amp;type=output"`
      )
    })

    it('rewrites anchors and returns asset-free html unchanged', () => {
      expect(
        rewriteAgentAssetHtml(`<a href="${LOOPBACK_VIEW}">duck.png</a>`)
      ).toContain(`href="${window.location.origin}/view?`)
      expect(rewriteAgentAssetHtml('<p>plain <b>text</b></p>')).toBe(
        '<p>plain <b>text</b></p>'
      )
    })
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
