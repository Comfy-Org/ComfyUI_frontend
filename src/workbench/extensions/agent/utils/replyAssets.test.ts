import { marked } from 'marked'
import { describe, expect, it } from 'vitest'

import {
  classifyAssetUrl,
  htmlReplyAssets,
  replyAssetResultItem,
  tokenReplyAssets
} from './replyAssets'

const view = (filename: string) =>
  `https://cloud.comfy.org/api/view?filename=${filename}&type=output`

function firstTokenAssets(text: string) {
  return tokenReplyAssets(marked.lexer(text)[0])
}

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
  it('[11-T1 regression] preserves a malformed percent escape as a literal filename', () => {
    expect(classifyAssetUrl('https://x/100%.png')).toMatchObject({
      filename: '100%.png',
      kind: 'image'
    })
  })
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
  })

  it('falls back to the pathname when no filename param exists', () => {
    expect(classifyAssetUrl('https://x.com/media/output.webm')).toMatchObject({
      filename: 'output.webm',
      kind: 'video'
    })
  })

  it('decodes a query filename exactly once, keeping literal percent sequences', () => {
    expect(classifyAssetUrl(view('my%2520file.png'))).toMatchObject({
      filename: 'my%20file.png',
      kind: 'image'
    })
  })

  it('decodes a pathname filename exactly once', () => {
    expect(classifyAssetUrl('https://x.com/media/my%20file.png')).toMatchObject(
      {
        filename: 'my file.png',
        kind: 'image'
      }
    )
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
    expect(item.isImage).toBe(true)
  })
})
