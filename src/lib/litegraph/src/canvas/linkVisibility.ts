import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import type { CanvasPointerEvent } from '../types/events'

interface LinkMutationHost {
  emitBeforeChange(): void
  emitAfterChange(): void
  setDirty(fgcanvas: boolean, bgcanvas?: boolean): void
}

interface LinkRenameHost extends LinkMutationHost {
  prompt(
    title: string,
    value: string | number,
    callback: (value: string) => void,
    event: CanvasPointerEvent
  ): unknown
}

function mutateLink(host: LinkMutationHost, mutation: () => void): void {
  host.emitBeforeChange()
  try {
    mutation()
    host.setDirty(false, true)
  } finally {
    host.emitAfterChange()
  }
}

export function hideLink(
  host: LinkMutationHost,
  scope: GraphScope,
  linkId: LinkId
): void {
  mutateLink(host, () =>
    useLinkPresentationStore().patch(scope, linkId, { hidden: true })
  )
}

export function showLink(
  host: LinkMutationHost,
  scope: GraphScope,
  linkId: LinkId
): void {
  mutateLink(host, () =>
    useLinkPresentationStore().patch(scope, linkId, { hidden: false })
  )
}

export function renameLink(
  host: LinkMutationHost,
  scope: GraphScope,
  linkId: LinkId,
  value: string
): void {
  mutateLink(host, () =>
    useLinkPresentationStore().patch(scope, linkId, {
      label: value.trim() || undefined
    })
  )
}

export function promptRenameLinkBadge(
  host: LinkRenameHost,
  scope: GraphScope,
  linkId: LinkId,
  event: CanvasPointerEvent
): void {
  host.prompt(
    'Rename',
    useLinkPresentationStore().getPresentation(scope, linkId)?.label ?? '',
    (value) => renameLink(host, scope, linkId, value),
    event
  )
}
