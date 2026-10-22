// The backend issues two catalog capabilities, `can_edit` and `can_apply`, and
// enforces both on every catalog request. The website's server routes repeat
// those checks to refuse early. Every place the website reads them together,
// or narrows them for a local demo/tester session, is in this module. See
// docs/adr/API-SERVER-FACTS-0042-server-facts-are-rendered-not-derived.md.

interface CatalogCapabilities {
  can_edit: boolean
  can_apply: boolean
}

/**
 * Whether a session may open the catalog administration at all: any catalog
 * capability, as the backend's review and editor endpoints accept either.
 * The backend emits no single field for this, so the two facts are read
 * together here and nowhere else.
 */
export function hasCatalogCapability(capabilities: CatalogCapabilities) {
  // oxlint-disable-next-line comfy/no-capability-recombination -- server-route authorization accepting either backend capability; the backend has no single field for "any catalog access" and re-checks each request
  return capabilities.can_edit || capabilities.can_apply
}

/** A local demo or tester role, which the backend does not know about. */
export type LocalCatalogRole = 'review' | 'edit' | 'publish'

/**
 * Narrows the server's capabilities to a local demo/tester role. A role can
 * only remove a capability the server granted, never add one: `review` keeps
 * neither, `edit` keeps editing, `publish` keeps both.
 */
export function narrowToLocalRole<T extends CatalogCapabilities>(
  capabilities: T,
  role: LocalCatalogRole
): T {
  return {
    ...capabilities,
    // oxlint-disable-next-line comfy/no-capability-recombination -- a local demo/tester role only removes a server-granted capability; it never grants one
    can_edit: capabilities.can_edit && role !== 'review',
    // oxlint-disable-next-line comfy/no-capability-recombination -- a local demo/tester role only removes a server-granted capability; it never grants one
    can_apply: capabilities.can_apply && role === 'publish'
  }
}
