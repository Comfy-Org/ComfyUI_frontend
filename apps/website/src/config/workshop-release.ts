/**
 * Whether Workshop is built into the site at all.
 *
 * Workshop is unfinished. `noindex` only asks a crawler to stay away; it does
 * not stop a page being live at a URL anyone can share, so until Workshop is
 * ready a production build must not emit those routes at all.
 *
 * Preview and local builds do emit them, because that is where the work is
 * reviewed. `VERCEL_ENV` is the signal the site already uses to tell a
 * production build from a preview — see `utils/cloudNodes.build.ts`, which
 * fails hard on stale data only in production.
 *
 * Launch is `WORKSHOP_IN_BUILD=1` in the production environment. That is a
 * deliberate, reversible switch, and it does not require a code change.
 */
export function isWorkshopInBuild(): boolean {
  const override = process.env.WORKSHOP_IN_BUILD
  if (override === '1') return true
  if (override === '0') return false
  return process.env.VERCEL_ENV !== 'production'
}

/** Every route Workshop owns. Kept here so the gate has one definition. */
export function isWorkshopRoute(pattern: string): boolean {
  return pattern === '/workshop' || pattern.startsWith('/workshop/')
}
