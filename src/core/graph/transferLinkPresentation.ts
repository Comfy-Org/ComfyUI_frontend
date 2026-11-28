import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import type { GraphScope } from '@comfyorg/graph-model/graphScopeId'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { LinkPresentation } from '@comfyorg/graph-model/linkPresentation'

export function getAgreedLinkPresentation(
  presentations: readonly (Readonly<LinkPresentation> | undefined)[]
): Readonly<LinkPresentation> | undefined {
  const [first] = presentations
  return presentations.every(
    (candidate) =>
      candidate?.hidden === first?.hidden && candidate?.label === first?.label
  )
    ? first
    : undefined
}

export function transferLinkPresentation(
  scope: GraphScope,
  source: Readonly<LinkPresentation> | undefined,
  targetId: LinkId | undefined
): void {
  if (targetId === undefined || !source) return
  useLinkPresentationStore().patch(scope, targetId, source)
}
