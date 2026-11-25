import { writeClipboardText } from '@/base/common/clipboard'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@comfyorg/telemetry/reportError'

/**
 * Helpers for the shareable per-invite links (DES-1010).
 *
 * The app accepts workspace invites via the `?invite=TOKEN` query param
 * (see useInviteUrlLoader), which is the same URL shape the invite emails
 * link to. Links are email-bound on the backend: only the invited address
 * can accept, so sharing a link over any channel is safe.
 */

/** Builds the user-facing invite URL for a pending invite's token. */
// Cloud-only assumption: every surface that renders invite links is gated on
// isCloud, and Cloud builds serve from base '/'. Revisit if these surfaces
// ever ship where getBasePath() resolves a reverse-proxy prefix.
export function buildInviteLink(token: string): string {
  const url = new URL(window.location.origin)
  url.searchParams.set(PRESERVED_QUERY_NAMESPACES.INVITE, token)
  return url.toString()
}

/** Formats invite links for a bulk copy: one `email<TAB>url` pair per line. */
export function formatInviteLinksForCopy(
  rows: ReadonlyArray<{ email: string; url: string }>
): string {
  if (rows.length === 1) return rows[0].url
  return rows.map(({ email, url }) => `${email}\t${url}`).join('\n')
}

/** Copies text without user feedback and reports invite-copy failures. */
export async function copyTextSilently(text: string): Promise<boolean> {
  const copied = await writeClipboardText(text)
  if (!copied) {
    reportError(new Error('Clipboard copy reported failure'), {
      errorType: 'error_copying_invite_link',
      surface: 'workspace'
    })
  }
  return copied
}
