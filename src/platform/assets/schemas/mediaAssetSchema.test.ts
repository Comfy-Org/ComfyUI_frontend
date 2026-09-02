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

  it.for([
    { name: 'attachment_ref', extra: { attachment_ref: '' } },
    { name: 'media_kind', extra: { media_kind: 'hologram' } },
    { name: 'preview_url', extra: { preview_url: 'not a url' } }
  ])('rejects the whole payload when $name is malformed', ({ extra }) => {
    expect(
      parseAssetInfo(transferWith({ ...BASE_ITEM, ...extra }))
    ).toBeUndefined()
  })

  // W10 target behavior is tracked by source PR #16187.
  it.todo(
    'W10: should drop malformed optional fields without rejecting the payload'
  )

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
