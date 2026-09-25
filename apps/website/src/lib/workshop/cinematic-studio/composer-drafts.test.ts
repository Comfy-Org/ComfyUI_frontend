import { describe, expect, it } from 'vitest'
import { AUTO_DIRECTION } from './catalog'
import {
  composerDraftKey,
  parseComposerDrafts,
  serializeComposerDrafts
} from './composer-drafts'

describe('scoped composer draft metadata', () => {
  it('validates both modes and strips credentials, URLs and file objects', () => {
    const mode = {
      scene: 'Harbor',
      direction: AUTO_DIRECTION,
      enhance: true,
      modelSlug: 'model',
      aspect: '3:2'
    }
    const parsed = parseComposerDrafts(
      JSON.stringify({
        version: 1,
        mode: 'image',
        image: {
          ...mode,
          token: 'secret',
          url: 'https://signed',
          file: 'bytes'
        },
        video: { ...mode, scene: 'Moving' },
        token: 'secret'
      })
    )
    expect(JSON.parse(serializeComposerDrafts(parsed))).toEqual({
      version: 1,
      mode: 'image',
      image: mode,
      video: { ...mode, scene: 'Moving' }
    })
    expect(composerDraftKey('demo')).not.toBe(
      composerDraftKey('["user","workspace"]')
    )
    expect(() => composerDraftKey('')).toThrow()
    expect(() => parseComposerDrafts(' '.repeat(1000001))).toThrow()
    expect(() =>
      parseComposerDrafts(
        JSON.stringify({
          ...parsed,
          image: { ...mode, referenceBundleId: 'https://signed' }
        })
      )
    ).toThrow()
  })
})
