import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { reportError } from '@/platform/telemetry/reportError'

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

/**
 * Copies text to the clipboard with no built-in user feedback — each caller
 * owns its own affordance (inline label swap in the dialog, a toast on the
 * pending tab). Returns whether the copy succeeded.
 */
export async function copyTextSilently(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    try {
      el.select()
      const copied = document.execCommand('copy')
      if (!copied) {
        reportError(new Error('execCommand copy reported failure'), {
          errorType: 'error_copying_invite_link'
        })
      }
      return copied
    } catch (error) {
      reportError(error, { errorType: 'error_copying_invite_link' })
      return false
    } finally {
      el.remove()
    }
  }
}
