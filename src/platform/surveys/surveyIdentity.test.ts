import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  anonymousIdentityProvider,
  getSurveyIdentityTags,
  setCurrentIdentityProvider
} from './surveyIdentity'

describe('survey identity', () => {
  beforeEach(() => {
    localStorage.clear()
    setCurrentIdentityProvider(anonymousIdentityProvider)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is anonymous by default', async () => {
    const tags = await getSurveyIdentityTags()

    expect(tags.anon_id).toBeTruthy()
    expect(tags.comfy_id).toBeUndefined()
  })

  it('mints a stable anonymous id and reuses it across calls', async () => {
    const anonId = (await getSurveyIdentityTags()).anon_id

    expect(localStorage.getItem('Comfy.SurveyAnonId')).toBe(anonId)
    expect((await getSurveyIdentityTags()).anon_id).toBe(anonId)
  })

  it('falls back to a stable in-memory id when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    const anonId = (await getSurveyIdentityTags()).anon_id

    expect(anonId).toBeTruthy()
    expect((await getSurveyIdentityTags()).anon_id).toBe(anonId)
  })

  it('resolves tags through the registered provider, dropping absent fields', async () => {
    setCurrentIdentityProvider({ getIdentity: () => ({ anon_id: 'fixed' }) })

    expect(await getSurveyIdentityTags()).toEqual({ anon_id: 'fixed' })
  })

  it('backfills the anon id when an async provider omits it', async () => {
    setCurrentIdentityProvider({
      getIdentity: () => Promise.resolve({ distinct_id: 'ph-1' })
    })

    const tags = await getSurveyIdentityTags()
    expect(tags.anon_id).toBeTruthy()
    expect(tags.distinct_id).toBe('ph-1')
  })

  it('includes distinct_id and comfy_id when the provider supplies them', async () => {
    setCurrentIdentityProvider({
      getIdentity: () =>
        Promise.resolve({
          anon_id: 'fixed',
          distinct_id: 'ph-1',
          comfy_id: 'uid-9'
        })
    })

    expect(await getSurveyIdentityTags()).toEqual({
      anon_id: 'fixed',
      distinct_id: 'ph-1',
      comfy_id: 'uid-9'
    })
  })
})
