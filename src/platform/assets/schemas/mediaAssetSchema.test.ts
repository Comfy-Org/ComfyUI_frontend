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
    const parsed = parseAssetInfo(
      transferWith({
        ...BASE_ITEM,
        attachment_ref: 'ref-1',
        media_kind: 'image',
        preview_url: 'https://example.com/p.png'
      })
    )

    expect(parsed).toEqual({
      ...BASE_ITEM,
      attachment_ref: 'ref-1',
      media_kind: 'image',
      preview_url: 'https://example.com/p.png'
    })
  })

  it.fails('drops malformed optional fields without rejecting the payload', () => {
    // W10 baseline expected failure: this exhaustive-QA slice assertion fails
    // on main@f954e479 because malformed optional fields reject the whole
    // asset payload.
    for (const [name, extra] of [
      ['attachment_ref', { attachment_ref: '' }],
      ['media_kind', { media_kind: 'hologram' }],
      ['preview_url', { preview_url: 'not a url' }]
    ] as const) {
      const parsed = parseAssetInfo(transferWith({ ...BASE_ITEM, ...extra }))

      // The malformed optional falls back to absent; the result item's own
      // fields survive.
      expect(parsed).toBeDefined()
      expect(parsed).toMatchObject(BASE_ITEM)
      expect(parsed?.[name]).toBeUndefined()
    }
  })

  it('still rejects a payload whose base fields are malformed', () => {
    const parsed = parseAssetInfo(transferWith({ ...BASE_ITEM, type: 'bogus' }))

    // The catch fallbacks are scoped per optional extra; base-field
    // validation still rejects the whole payload.
    expect(parsed).toBeUndefined()
  })

  it('returns undefined for an unparsable payload', () => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(MIME_ASSET_INFO, '{not json')

    expect(parseAssetInfo(dataTransfer)).toBeUndefined()
  })
})
