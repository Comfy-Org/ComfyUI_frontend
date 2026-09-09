/**
 * Seed-like Router parameters start EMPTY: an empty seed is omitted from the
 * request, which lets the provider randomise. A visitor who wants a
 * reproducible run types one; an example that ran with a seed prefills it so
 * the sample can be reproduced.
 */
const SEED_FIELDS: ReadonlySet<string> = new Set([
  'seed',
  'Seed',
  'model_seed',
  'texture_seed',
  'image_seed'
])

export function isSeedField(name: string): boolean {
  return SEED_FIELDS.has(name)
}
