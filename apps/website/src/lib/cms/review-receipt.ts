import { zCccCheckedReviewReceipt } from '@comfyorg/ingest-types/zod'
import type { StagingReview } from './staging-review'
import { publicationState } from './staging-review'

// Generated wire validation plus the site's stricter safe-integer state.
// Do not use the generated int64 coercion output as JavaScript numbers.
export function reviewReceipt(raw: unknown) {
  const parsed = zCccCheckedReviewReceipt.strict().safeParse(raw)
  const state =
    raw && typeof raw === 'object'
      ? publicationState(Reflect.get(raw, 'state'))
      : undefined
  return parsed.success && state ? { ...parsed.data, state } : undefined
}
export type ReviewReceipt = NonNullable<ReturnType<typeof reviewReceipt>>

export async function selectedVersionsDigest(
  snapshot: StagingReview,
  uids: string[]
) {
  if (!uids.length || uids.length > 5000 || new Set(uids).size !== uids.length)
    return undefined
  const selected = new Set(uids)
  const pairs = snapshot.items
    .filter((item) => selected.has(item.content.uid))
    .map((item) => [item.content.uid, item.content.revision_uid])
    .sort(([a = ''], [b = '']) => (a < b ? -1 : a > b ? 1 : 0))
  if (
    pairs.length !== uids.length ||
    new Set(pairs.map(([uid]) => uid)).size !== uids.length
  )
    return undefined
  const raw = JSON.stringify([
    'ccc-checked-review-receipt-v1',
    [
      snapshot.state.live_rev,
      snapshot.state.draft_rev,
      snapshot.state.draft_generation
    ],
    pairs
  ])
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(raw)
    )
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  } catch {
    // No secure hash capability is not permission to display unbound review.
    return undefined
  }
}

export async function matchesReviewReceipt(
  snapshot: StagingReview,
  receipt: ReviewReceipt,
  uids: string[]
) {
  if (
    snapshot.state.live_rev !== receipt.state.live_rev ||
    snapshot.state.draft_rev !== receipt.state.draft_rev ||
    snapshot.state.draft_generation !== receipt.state.draft_generation ||
    receipt.selected_count !== uids.length
  )
    return false
  const digest = await selectedVersionsDigest(snapshot, uids)
  return digest !== undefined && digest === receipt.selected_versions_digest
}

// This client also bounds actual streamed bytes, not only Content-Length.
// Error diagnostics use the existing separate 64 KiB contract.
export async function receiptResponseJSON(
  response: Response
): Promise<unknown> {
  const limit = response.ok ? 16 << 10 : 64 << 10
  const reader = response.body?.getReader()
  if (!reader) return undefined
  try {
    if (Number(response.headers.get('Content-Length')) > limit) {
      await reader.cancel()
      return undefined
    }
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) {
        await reader.cancel()
        return undefined
      }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  } finally {
    reader.releaseLock()
  }
}
