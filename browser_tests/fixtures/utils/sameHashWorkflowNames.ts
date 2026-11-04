/**
 * Two workflow names whose draft-storage paths share a `hashPath` value.
 *
 * `ewip.json` and `4hbab.json` collide under the 32-bit draft key; the shared
 * random suffix keeps the pair unique per run while preserving the collision.
 */
export function generateSameHashWorkflowNames(): [string, string] {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return [`ewip.json-${suffix}`, `4hbab.json-${suffix}`]
}
