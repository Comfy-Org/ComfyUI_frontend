import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it } from 'vitest'

import { resolveAuthorProfile } from './author-profiles'

const profile = (id: string) => ({
  id,
  label: 'Ada Lovelace',
  username: 'ada-lovelace',
  avatar_url: 'https://media.comfy.org/ada.png'
})

describe('resolveAuthorProfile', () => {
  it('finds the exact account among the search results and asks once', async () => {
    const uid = 'fPc7irbKt2VLexactAccount1'
    respondToFetch(/\/admin\/content-api\/profiles\?/, () =>
      Response.json({
        items: [profile(`${uid}-other`), profile(uid)]
      })
    )
    expect(await resolveAuthorProfile(uid)).toEqual(profile(uid))
    expect(await resolveAuthorProfile(uid)).toEqual(profile(uid))
    expect(fetchRequests(/\/admin\/content-api\/profiles\?/)).toHaveLength(1)
    expect(fetchRequests()[0]?.url).toBe(`/admin/content-api/profiles?q=${uid}`)
  })

  it('resolves nothing when no public profile carries that exact ID', async () => {
    const uid = 'fPc7irbKt2VLnoPublicProfile'
    respondToFetch(/\/admin\/content-api\/profiles\?/, () =>
      Response.json({ items: [profile(`${uid}-near`)] })
    )
    expect(await resolveAuthorProfile(uid)).toBeUndefined()
  })

  it('forgets a failed lookup so a later row can retry', async () => {
    const uid = 'fPc7irbKt2VLretryAccount'
    respondToFetch(
      /\/admin\/content-api\/profiles\?/,
      () => new Response(null, { status: 503 }),
      { times: 1 }
    )
    expect(await resolveAuthorProfile(uid)).toBeUndefined()
    respondToFetch(/\/admin\/content-api\/profiles\?/, () =>
      Response.json({ items: [profile(uid)] })
    )
    expect(await resolveAuthorProfile(uid)).toEqual(profile(uid))
  })

  it('never searches with an email or other unsafe query', async () => {
    expect(await resolveAuthorProfile('ada@example.com')).toBeUndefined()
    expect(fetchRequests()).toEqual([])
  })
})
