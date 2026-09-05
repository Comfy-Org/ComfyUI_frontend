/**
 * Whether Workshop is built into the site at all.
 *
 * Three environments, and only one of them has Workshop in it:
 *
 * | Environment      | `VERCEL_ENV` | Workshop | What it answers                |
 * | ---------------- | ------------ | -------- | ------------------------------ |
 * | Production       | `production` | out      | what is on comfy.org right now |
 * | Preview, staging | `preview`    | out      | what ships if we release today |
 * | Development      | unset        | in       | what we are building           |
 *
 * Preview and production must agree. A preview whose contents differ from the
 * next release cannot answer the only question a preview is for — if we cut a
 * release right now, for a hotfix say, what goes out? Workshop is unfinished,
 * so the answer has to be "not Workshop", and it has to be true on both.
 *
 * `noindex` cannot do this job. It asks a crawler to stay away; the page is
 * still live at a URL anyone can share. Keeping the routes out of the build is
 * the only thing that actually holds.
 *
 * So a deployed build excludes Workshop unless it is explicitly asked for.
 * Local development includes it, because that is where it is being built and
 * nothing there ships.
 *
 * `WORKSHOP_IN_BUILD` overrides both ways, and is how the other two
 * environments are reached without a code change:
 *
 * - `1` — put Workshop in. Set by CI on a PR labelled `workshop`, which is how
 *   the feature gets a review URL; and set in the production environment on
 *   the day Workshop launches.
 * - `0` — keep it out. Reproduces a release build locally.
 */

/** Environments whose builds are deployed somewhere people can reach. */
const DEPLOYED = new Set(['production', 'preview'])

export function isWorkshopInBuild(): boolean {
  const override = process.env.WORKSHOP_IN_BUILD
  if (override === '1') return true
  if (override === '0') return false

  return !DEPLOYED.has(process.env.VERCEL_ENV ?? '')
}

/** Every route Workshop owns. Kept here so the gate has one definition. */
export function isWorkshopRoute(pattern: string): boolean {
  return pattern === '/workshop' || pattern.startsWith('/workshop/')
}
