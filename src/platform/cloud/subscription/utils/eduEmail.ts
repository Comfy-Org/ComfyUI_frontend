/**
 * Display-only Tier-1 heuristic (.edu gTLD, ac.xx / edu.xx second levels) for
 * deciding whether to nudge. The server-side classifier is authoritative and
 * also covers the ROR institution set this deliberately omits.
 */
export function isLikelyEduEmail(email: string | null | undefined): boolean {
  const domain = email?.split('@').pop()?.trim().toLowerCase() ?? ''
  if (!domain) return false
  // Second-level match restricted to 2-letter ccTLDs so .edu.com-style vanity
  // gTLDs miss; the server's PSL-anchored matcher is the precise version.
  return /(^|\.)edu$/.test(domain) || /\.(ac|edu)\.[a-z]{2}$/.test(domain)
}
