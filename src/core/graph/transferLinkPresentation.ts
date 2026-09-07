import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'

export function transferLinkPresentation(
  scope: GraphScope,
  source: Readonly<LinkPresentation> | undefined,
  targetId: LinkId | undefined
): void {
  if (targetId === undefined || !source) return
  useLinkPresentationStore().patch(scope, targetId, source)
}
