import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useLinkTieStore } from '@/stores/linkTieStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

/** Drops the presentation and tie memberships of links whose topology the graph removed. */
export function releaseLinkSidecars(
  scope: GraphScope,
  linkIds: readonly LinkId[]
): void {
  const presentationStore = useLinkPresentationStore()
  for (const linkId of linkIds) presentationStore.take(scope, linkId)
  useLinkTieStore().releaseLinks(scope, linkIds)
}
