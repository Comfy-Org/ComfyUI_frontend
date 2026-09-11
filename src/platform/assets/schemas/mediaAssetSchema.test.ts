import { describe, expect, it } from 'vitest'

import { MIME_ASSET_INFO, parseAssetInfo } from './mediaAssetSchema'

function transferWith(payload: unknown): DataTransfer {
  const dataTransfer = new DataTransfer()
  dataTransfer.setData(MIME_ASSET_INFO, JSON.stringify(payload))
  return dataTransfer
}

const BASE_ITEM = {
  filename: 'render.png',
  subfolder: 'outputs',
  type: 'output'
}

describe('parseAssetInfo', () => {
  it('parses a fully enriched drag payload', () => {
    expect(
      parseAssetInfo(
        transferWith({
          ...BASE_ITEM,
          attachment_ref: 'ref-1',
          media_kind: 'image',
          preview_url: 'https://example.com/p.png'
        })
      )
    ).toEqual({
      ...BASE_ITEM,
      attachment_ref: 'ref-1',
      media_kind: 'image',
      preview_url: 'https://example.com/p.png'
    })
  })

  it.for([
    ['attachment_ref', { attachment_ref: '' }],
    ['media_kind', { media_kind: 'hologram' }],
    ['preview_url', { preview_url: 'not a url' }]
  ] as const)('rejects a payload with malformed optional %s', ([, extra]) => {
    expect(
      parseAssetInfo(transferWith({ ...BASE_ITEM, ...extra }))
    ).toBeUndefined()
  })

  it('rejects a payload whose base fields are malformed', () => {
    expect(
      parseAssetInfo(transferWith({ ...BASE_ITEM, type: 'bogus' }))
    ).toBeUndefined()
  })

  it('returns undefined for an unparsable payload', () => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(MIME_ASSET_INFO, '{not json')

    expect(parseAssetInfo(dataTransfer)).toBeUndefined()
  })
})
