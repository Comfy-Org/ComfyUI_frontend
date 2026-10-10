import { describe, expect, it } from 'vitest'

import type { SeedEntry } from './mock-ingest'
import { MOCK_CREDENTIAL, createMockIngest } from './mock-ingest'

const entry = (uid: string, name: string): SeedEntry => ({
  uid,
  kind: 'MODEL',
  slug: `/hub/models/${uid}`,
  enabled: true,
  visibility: 'PUBLIC',
  data: { name, slug: uid }
})
const uids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`)
const auth = `Bearer ${MOCK_CREDENTIAL}`

function ingest() {
  const call = createMockIngest(uids.map((uid, n) => entry(uid, `M${n}`)))
  const url = (path: string) => new URL(path, 'https://ingest.example')
  const review = () => {
    const [, body] = call('GET', url('/admin/api/site/review'), auth, '')
    return body as {
      draft: {
        revision_id: number
        items: Array<{ uid: string; edit_version: string; deleted: boolean }>
      }
      live: { revision_id: number; items: Array<{ data: { name: string } }> }
    }
  }
  const post = (path: string, body: unknown, method = 'POST') =>
    call(method, url(`/admin/api/site/${path}`), auth, JSON.stringify(body))
  return { call, url, review, post }
}

describe('mock ingest', () => {
  it('saves an item into the draft and refuses a stale edit', () => {
    const { review, post } = ingest()
    const { draft } = review()
    const target = draft.items.find((item) => item.uid === uids[3])
    const body = {
      draft_id: draft.revision_id,
      edit_version: target?.edit_version,
      kind: 'MODEL',
      slug: `/hub/models/${uids[3]}`,
      enabled: true,
      visibility: 'PUBLIC',
      deleted: true,
      data: { name: 'Archived', slug: uids[3] }
    }
    expect(post(`items/${uids[3]}`, body, 'PUT')[0]).toBe(200)
    expect(
      review().draft.items.find((item) => item.uid === uids[3])?.deleted
    ).toBe(true)
    expect(post(`items/${uids[3]}`, body, 'PUT')[0]).toBe(409)
  })

  it('restores any earlier published revision', () => {
    const { review, post } = ingest()
    const first = review().live
    expect(post('publish', {})[0]).toBe(204)
    expect(post('publish', {})[0]).toBe(204)
    const live = review().live.revision_id
    expect(
      post('revert', { live_id: live, target_id: first.revision_id })[0]
    ).toBe(204)
    const after = review()
    expect(after.live.revision_id).toBe(live + 1)
    expect(after.live.items.map((item) => item.data.name)).toEqual(
      first.items.map((item) => item.data.name)
    )
    expect(post('revert', { live_id: live, target_id: 1 })[0]).toBe(409)
  })

  it('publishes only approved changes and sends an edited approval back', () => {
    const { call, url, review, post } = ingest()
    const get = (path: string) =>
      call('GET', url(`/admin/api/site/${path}`), auth, '')[1]
    // The seeded draft changes uids[0] (name) and uids[1], uids[2].
    expect(
      post('staging', { items: [{ id: uids[0], status: 'APPROVED' }] })[0]
    ).toBe(204)
    expect(get('staging')).toEqual({ [uids[0]]: { status: 'APPROVED' } })
    expect(post('publish', { approved_uids: [uids[0]] })[0]).toBe(204)
    const after = review()
    const liveName = (uid: string) =>
      after.live.items.find((_, i) => uids[i] === uid)?.data.name
    expect(liveName(uids[0])).toBe('M0 (Pro)')
    // uids[1] was turned off in the draft but not approved, so it waits.
    const raw = call('GET', url('/admin/api/site/review'), auth, '')[1] as {
      draft: { items: Array<{ uid: string; enabled: boolean }> }
      live: { items: Array<{ uid: string; enabled: boolean }> }
    }
    const enabled = (items: typeof raw.live.items) =>
      items.find((item) => item.uid === uids[1])?.enabled
    expect([enabled(raw.live.items), enabled(raw.draft.items)]).toEqual([
      true,
      false
    ])
    expect(get('staging')).toEqual({})

    post('staging', { items: [{ id: uids[3], status: 'APPROVED' }] })
    const target = after.draft.items.find((item) => item.uid === uids[3])
    post(
      `items/${uids[3]}`,
      {
        draft_id: after.draft.revision_id,
        edit_version: target?.edit_version,
        kind: 'MODEL',
        slug: `/hub/models/${uids[3]}`,
        enabled: true,
        visibility: 'PUBLIC',
        deleted: false,
        data: { name: 'Edited', slug: uids[3] }
      },
      'PUT'
    )
    expect(get('staging')).toEqual({
      [uids[3]]: { status: 'NEW', reapproval: true }
    })
    const history = get(`items/${uids[3]}/history`) as Array<{
      saved_by: string
      data: { name: string }
    }>
    expect(history.map((save) => save.data.name)).toEqual(['Edited', 'M3'])
    expect(history[0].saved_by).toBe('local-designer')
  })
})
