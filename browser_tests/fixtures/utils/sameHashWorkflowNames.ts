import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'

export function generateSameHashWorkflowNames(): [string, string] {
  const prefix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const nameByHash = new Map<string, string>()
  for (let i = 0; ; i++) {
    const name = `${prefix}-${i.toString(36)}`
    const hash = hashPath(`workflows/${name}.json`)
    const earlier = nameByHash.get(hash)
    if (earlier) return [earlier, name]
    nameByHash.set(hash, name)
  }
}
