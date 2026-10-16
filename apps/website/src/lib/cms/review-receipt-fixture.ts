import type { StagingReview } from './staging-review'
import { selectedVersionsDigest } from './review-receipt'
import type { ReviewReceipt } from './review-receipt'

// Explicit test data only, never a response fallback.
export async function fixtureReceipt(snapshot: StagingReview, uids: string[]) {
  const digest = await selectedVersionsDigest(snapshot, uids)
  if (!digest) throw new Error('Invalid receipt fixture selection')
  const receipt: ReviewReceipt = {
    receipt_version: 1,
    state: snapshot.state,
    selected_count: uids.length,
    unchecked_count: snapshot.items.length - uids.length,
    selected_versions_digest: digest,
    selection_digest: 'b'.repeat(64),
    publish_enabled: true
  }
  return receipt
}
