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

  it('is anonymous by default', () => {
    const tags = getSurveyIdentityTags()

    expect(tags.anon_id).toBeTruthy()
    expect(tags.comfy_id).toBeUndefined()
  })

  it('mints a stable anonymous id and reuses it across calls', () => {
    const anonId = getSurveyIdentityTags().anon_id

    expect(localStorage.getItem('Comfy.SurveyAnonId')).toBe(anonId)
    expect(getSurveyIdentityTags().anon_id).toBe(anonId)
  })

  it('falls back to a stable in-memory id when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    const anonId = getSurveyIdentityTags().anon_id

    expect(anonId).toBeTruthy()
    expect(getSurveyIdentityTags().anon_id).toBe(anonId)
  })

  it('resolves tags through the registered provider, dropping absent fields', () => {
    setCurrentIdentityProvider({ getIdentity: () => ({ anon_id: 'fixed' }) })

    expect(getSurveyIdentityTags()).toEqual({ anon_id: 'fixed' })
  })

  it('includes distinct_id and comfy_id when the provider supplies them', () => {
    setCurrentIdentityProvider({
      getIdentity: () => ({
        anon_id: 'fixed',
        distinct_id: 'ph-1',
        comfy_id: 'uid-9'
      })
    })

    expect(getSurveyIdentityTags()).toEqual({
      anon_id: 'fixed',
      distinct_id: 'ph-1',
      comfy_id: 'uid-9'
    })
  })
})
