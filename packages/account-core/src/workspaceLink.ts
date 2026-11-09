/**
 * The workspace deep-link contract: the one query parameter, `workspace`,
 * that every surface — the cloud app, comfy.org, and the billing SDK's entry
 * URL — reads and writes to say which workspace a link is for.
 *
 * It is the URL parameter only, never the token API field. `POST
 * /api/auth/token` still takes `{ workspace_id }` in its request body; that
 * name does not change here and this module does not touch it.
 *
 * A destination applies the link before it loads workspace-scoped content:
 * it mints a token for the named id and lets the server decide membership,
 * the same way any other mint does. A payment or billing destination fails
 * closed on a link it cannot honor and never acts on a workspace other than
 * the one named — silently falling back to the caller's own active workspace
 * would bill or expose the wrong one. A navigation destination may fall back
 * to its own active workspace when the link is absent or invalid, but must
 * show which workspace it landed on rather than switch silently. The
 * parameter is carried through the sign-in redirect like any other query
 * parameter on the path being returned to.
 */

export const WORKSPACE_LINK_PARAM = 'workspace'

export type WorkspaceLinkRead =
  | { readonly status: 'absent' }
  | { readonly status: 'ok'; readonly workspaceId: string }
  | { readonly status: 'invalid' }

/** Same charset as `@comfyorg/billing-contract`'s identifiers: no path separator, query delimiter, or percent escape survives it. */
const WORKSPACE_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isWorkspaceId(value: string): boolean {
  return WORKSPACE_ID.test(value)
}

/** Reserved by RFC 2606; only used to parse a path+query string that carries no origin of its own. */
const PARSE_BASE = 'https://workspace-link.invalid/'

function searchParamsOf(
  source: URL | URLSearchParams | string
): URLSearchParams | undefined {
  if (source instanceof URLSearchParams) return source
  if (source instanceof URL) return source.searchParams
  try {
    return new URL(source, PARSE_BASE).searchParams
  } catch {
    return undefined
  }
}

/**
 * Reads the link out of a URL, a `URLSearchParams`, or a string (a full URL
 * or the path-and-query form a router hands over). A missing parameter is
 * `absent`; a present-but-empty value is `invalid`, the same as any other
 * value outside the shared charset — an empty `workspace=` is a producer
 * bug, not "no link," and a payment destination has to fail closed on it
 * rather than treat it as though the link were never there. A repeated
 * parameter is also `invalid` rather than picking one, so a caller cannot be
 * pointed at two different workspaces by ambiguity.
 */
export function readWorkspaceLink(
  source: URL | URLSearchParams | string
): WorkspaceLinkRead {
  const params = searchParamsOf(source)
  if (!params) return { status: 'absent' }

  const values = params.getAll(WORKSPACE_LINK_PARAM)
  if (values.length === 0) return { status: 'absent' }
  if (values.length > 1) return { status: 'invalid' }

  const [value] = values
  if (!isWorkspaceId(value)) return { status: 'invalid' }

  return { status: 'ok', workspaceId: value }
}

/** Returns a new `URL` carrying the link; never mutates `url`. Throws `RangeError` on an id outside the shared charset. */
export function withWorkspaceLink(url: URL, workspaceId: string): URL {
  if (!isWorkspaceId(workspaceId))
    throw new RangeError(`not a workspace id: ${workspaceId}`)
  const next = new URL(url.href)
  next.searchParams.set(WORKSPACE_LINK_PARAM, workspaceId)
  return next
}

/** Returns a new `URL` with the link removed; never mutates `url`. */
export function withoutWorkspaceLink(url: URL): URL {
  const next = new URL(url.href)
  next.searchParams.delete(WORKSPACE_LINK_PARAM)
  return next
}
