import { st, t } from '@/i18n'
import type { IContextMenuValue } from '../interfaces'
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
    t('contextMenu.Rename'),
    useLinkPresentationStore().getPresentation(scope, linkId)?.label ?? '',
    (value) => renameLink(host, scope, linkId, value),
    event
  )
}

export function getLinkMenuOptions(
  scope: GraphScope,
  linkId?: LinkId
): (IContextMenuValue<string> | string | null)[] {
  const options: (IContextMenuValue<string> | string | null)[] = []
  const hidden =
    linkId !== undefined &&
    useLinkPresentationStore().getPresentation(scope, linkId)?.hidden
  if (linkId !== undefined) {
    const actions = hidden ? ['Rename', 'Show Link'] : ['Hide Link']
    for (const value of actions) {
      options.push({ content: st(`contextMenu.${value}`, value), value })
    }
    options.push(null)
  }
  options.push('Add Node')
  if (!hidden) options.push('Add Reroute')
  options.push(null, 'Delete', null)
  return options
}
