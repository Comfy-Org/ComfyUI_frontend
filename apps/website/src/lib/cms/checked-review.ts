import type { FinalReview, StagingReview } from './staging-review'

export function matchesCheckedReview(
  before: StagingReview,
  final: FinalReview,
  uids: string[]
) {
  if (
    before.state.live_rev !== final.state.live_rev ||
    before.state.draft_rev !== final.state.draft_rev ||
    before.state.draft_generation !== final.state.draft_generation ||
    !uids.length ||
    new Set(uids).size !== uids.length ||
    final.changes.length !== uids.length
  )
    return false
  const selected = new Set(uids)
  const expected = new Map(
    before.items
      .filter((item) => selected.has(item.content.uid))
      .map((item) => [item.content.uid, item.content.revision_uid])
  )
  const changes = new Map(
    final.changes.map((item) => [item.content.uid, item.content.revision_uid])
  )
  return (
    expected.size === uids.length &&
    changes.size === uids.length &&
    final.changes.every(
      (item) => expected.get(item.content.uid) === item.content.revision_uid
    ) &&
    final.deferred.every((item) => !selected.has(item.content.uid))
  )
}
