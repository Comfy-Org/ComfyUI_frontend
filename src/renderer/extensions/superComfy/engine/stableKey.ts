import { fnv1a } from '@/platform/workflow/persistence/base/hashUtil'

function compareKeys([a]: [string, unknown], [b]: [string, unknown]): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry: unknown) => stableStringify(entry)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .sort(compareKeys)
      .map(
        ([name, field]) => `${JSON.stringify(name)}:${stableStringify(field)}`
      )
    return `{${fields.join(',')}}`
  }
  if (value === undefined) return 'null'
  return JSON.stringify(value)
}

function hex8(hash: number): string {
  return hash.toString(16).padStart(8, '0')
}

export function stableKey(value: unknown): string {
  const text = stableStringify(value)
  const first = fnv1a(text)
  const second = fnv1a(`${hex8(first)}:${text}`)
  return `${hex8(first)}${hex8(second)}`
}
