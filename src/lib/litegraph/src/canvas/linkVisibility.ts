import type { LLink } from '../LLink'
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

export function hideLink(host: LinkMutationHost, link: LLink): void {
  mutateLink(host, () => (link.hidden = true))
}

export function showLink(host: LinkMutationHost, link: LLink): void {
  mutateLink(host, () => (link.hidden = false))
}

export function renameLink(
  host: LinkMutationHost,
  link: LLink,
  value: string
): void {
  mutateLink(host, () => (link.label = value.trim() || undefined))
}

export function promptRenameLinkBadge(
  host: LinkRenameHost,
  link: LLink,
  event: CanvasPointerEvent
): void {
  host.prompt(
    'Rename',
    link.label ?? '',
    (value) => renameLink(host, link, value),
    event
  )
}
