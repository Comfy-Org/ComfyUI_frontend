import type { LocationQuery } from 'vue-router'

// Red-step stub: returns the current (buggy) target unconditionally so the
// regression test resolves its import and fails on behaviour, not on a missing
// module. Replaced by the real implementation in the following commit.
export const resolveUnauthenticatedRedirectName = (
  _query: LocationQuery
): 'cloud-login' | 'cloud-signup' => {
  return 'cloud-login'
}
