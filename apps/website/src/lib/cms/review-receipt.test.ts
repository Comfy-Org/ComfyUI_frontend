import { assert, describe, expect, it, vi } from 'vitest'
import { fixtureReview } from './staging-fixture'
import { fixtureReceipt } from './review-receipt-fixture'
import {
  matchesReviewReceipt,
  receiptResponseJSON,
  reviewReceipt,
  selectedVersionsDigest
} from './review-receipt'

describe('compact checked review receipt', () => {
  it('matches the Go ordered-array golden hash, including a tombstone and reversed order', async () => {
    const snapshot = fixtureReview()
    const original = snapshot.items[0]
    assert.exists(original)
    snapshot.state = {
      ...snapshot.state,
      live_rev: 5,
      draft_rev: 6,
      draft_generation: 3526
    }
    snapshot.items = [3, 2].map((index) => ({
      ...original,
      content: {
        ...original.content,
        uid: `00000000-0000-4000-8000-00000000000${index}`,
        revision_uid: `00000000-0000-4000-8000-00000000001${index}`,
        is_deleted: index === 3
      }
    }))
    const uids = snapshot.items.map((item) => item.content.uid)
    const expected =
      '2d6051c41426ea0085ce76cf89e64f460039d9b29eef102c1cbc1ee14db3cfd4'
    expect(await selectedVersionsDigest(snapshot, uids)).toBe(expected)
    snapshot.items.reverse()
    expect(await selectedVersionsDigest(snapshot, [...uids].reverse())).toBe(
      expected
    )
  })
  it.for([
    'version',
    'count',
    'state',
    'digest',
    'extra',
    'unsafe state',
    'missing flag'
  ] as const)('rejects invalid wire %s', async (variant) => {
    const snapshot = fixtureReview()
    const receipt = await fixtureReceipt(
      snapshot,
      snapshot.items.map((item) => item.content.uid)
    )
    const changes = {
      version: { receipt_version: 2 },
      count: { selected_count: 5001 },
      state: { state: {} },
      digest: { selected_versions_digest: 'bad' },
      extra: { changes: snapshot.items },
      'unsafe state': {
        state: {
          ...snapshot.state,
          draft_generation: Number.MAX_SAFE_INTEGER + 1
        }
      },
      'missing flag': { publish_enabled: undefined }
    }
    expect(reviewReceipt({ ...receipt, ...changes[variant] })).toBeUndefined()
  })
  it.for(['state', 'save', 'duplicate', 'missing', 'count', 'hash'] as const)(
    'refuses a different frozen %s',
    async (variant) => {
      const snapshot = fixtureReview()
      const item = snapshot.items[0]
      assert.exists(item)
      const uids = [item.content.uid]
      const receipt = await fixtureReceipt(snapshot, uids)
      expect(await matchesReviewReceipt(snapshot, receipt, uids)).toBe(true)
      const changes = {
        state: () => {
          snapshot.state.draft_generation++
        },
        save: () => {
          item.content.revision_uid = '00000000-0000-4000-8000-000000000099'
        },
        duplicate: () => {
          uids.push(item.content.uid)
        },
        missing: () => {
          snapshot.items = []
        },
        count: () => {
          receipt.selected_count++
        },
        hash: () => {
          receipt.selected_versions_digest = 'a'.repeat(64)
        }
      }
      changes[variant]()
      expect(await matchesReviewReceipt(snapshot, receipt, uids)).toBe(false)
    }
  )
  it('fails closed when secure hashing is unavailable', async () => {
    const snapshot = fixtureReview()
    vi.stubGlobal('crypto', {})
    expect(
      await selectedVersionsDigest(
        snapshot,
        snapshot.items.map((item) => item.content.uid)
      )
    ).toBeUndefined()
  })
  it.for([false, true])(
    'bounds success bytes with Content-Length=%s',
    async (header) => {
      const cancel = vi.fn()
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('x'.repeat((16 << 10) + 1))
            )
          },
          cancel
        }),
        { headers: header ? { 'Content-Length': String((16 << 10) + 1) } : {} }
      )
      expect(await receiptResponseJSON(response)).toBeUndefined()
      expect(cancel).toHaveBeenCalledOnce()
    }
  )
  it('parses small receipts and separate error diagnostics, rejecting truncated JSON', async () => {
    expect(
      await receiptResponseJSON(Response.json({ receipt_version: 1 }))
    ).toEqual({ receipt_version: 1 })
    const errors = {
      field_errors: [{ path: '$.thumbnail', message: 'Missing media' }]
    }
    expect(
      await receiptResponseJSON(Response.json(errors, { status: 422 }))
    ).toEqual(errors)
    expect(
      await receiptResponseJSON(new Response('{"receipt_version":'))
    ).toBeUndefined()
  })
})
