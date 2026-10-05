/**
 * Carries the active workspace onto a link to Cloud or Platform, per the
 * workspace deep-link contract (`@comfyorg/account-core/workspaceLink`).
 * Falls back to the plain link when no workspace is known (signed out) or
 * the id fails validation, so navigation never breaks.
 */
import { withWorkspaceLink } from '@comfyorg/account-core/workspaceLink'

export function workspaceLinkedHref(
  href: string,
  workspaceId: string | undefined
): string {
  if (!workspaceId) return href
  try {
    return withWorkspaceLink(new URL(href), workspaceId).href
  } catch {
    return href
  }
}
