/** @returns two unique workflow names whose draft paths share a `hashPath` value. */
export function generateSameHashWorkflowNames(): [string, string] {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return [`ewip.json-${suffix}`, `4hbab.json-${suffix}`]
}
