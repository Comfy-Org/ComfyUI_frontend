import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

/**
 * Helpers for the shareable per-invite links (DES-1010).
 *
 * The app accepts workspace invites via the `?invite=TOKEN` query param
 * (see useInviteUrlLoader), which is the same URL shape the invite emails
 * link to. Links are email-bound on the backend: only the invited address
 * can accept, so sharing a link over any channel is safe.
 */

/** Builds the user-facing invite URL for a pending invite's token. */
export function buildInviteLink(token: string): string {
  const url = new URL(window.location.origin)
  url.searchParams.set(PRESERVED_QUERY_NAMESPACES.INVITE, token)
  return url.toString()
}

/** Formats invite links for a bulk copy: one `email<TAB>url` pair per line. */
export function formatInviteLinksForCopy(
  rows: ReadonlyArray<{ email: string; url: string }>
): string {
  return rows.map(({ email, url }) => `${email}\t${url}`).join('\n')
}

/**
 * Copies text to the clipboard without surfacing a toast — invite-link copy
 * affordances give inline feedback (the button label swaps to "Copied")
 * instead. Returns whether the copy succeeded so callers can skip the
 * feedback on failure.
 */
export async function copyTextSilently(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy invite link to clipboard', error)
    return false
  }
}
